import * as crypto from 'crypto';
import { logger } from '../../config/logger';
import { AIServiceError } from '../../config/errors';
import { getNvidiaApiKey } from '../../config/context';

export interface NemotronRequest {
  systemPrompt: string;
  userPrompt: string;
  cacheKey: string;
  fallbackGenerator: () => any;
}

export class NemotronService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL

  /**
   * Main entry point to invoke Nemotron with system prompt, user prompt, and fallback logic.
   * STRICT NO-MOCK POLICY: If credentials are mock or API fails, throw AIServiceError.
   */
  public static async invoke(req: NemotronRequest): Promise<any> {
    const { systemPrompt, userPrompt, cacheKey, fallbackGenerator } = req;

    // 1. Check Cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
      logger.info(`[Nemotron] Cache hit for key: ${cacheKey}`);
      return cached.data;
    }

    const customKey = getNvidiaApiKey();
    const apiKey = customKey || process.env.NVIDIA_API_KEY;
    const isMock = !apiKey || apiKey.trim() === '' || apiKey.startsWith('mock_');

    if (isMock) {
      logger.error('[Nemotron ERROR] NVIDIA_API_KEY is not set or is mock. STRICT NO-MOCK POLICY is active.');
      throw new AIServiceError('NVIDIA Nemotron API key is not configured or is invalid. Please configure NVIDIA_API_KEY in the environment to perform AI analysis.');
    }

    // 2. Call NVIDIA API with Retries and Timeout protection
    try {
      const result = await this.executeWithRetryAndTimeout(systemPrompt, userPrompt);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err: any) {
      logger.error(`[Nemotron Fatal] NVIDIA API call failed after retries: ${err.message}`);
      throw new AIServiceError(`NVIDIA Nemotron AI analysis failed: ${err.message}`, err);
    }
  }

  /**
   * Clears the cache for a document if its data changes.
   */
  public static clearCache(cacheKey: string) {
    this.cache.delete(cacheKey);
  }

  /**
   * Helper to execute API call with 3 retries and 8s timeout.
   */
  private static async executeWithRetryAndTimeout(systemPrompt: string, userPrompt: string): Promise<any> {
    const maxRetries = 3;
    let attempt = 1;
    let delay = 1000; // 1s initial delay

    while (attempt <= maxRetries) {
      try {
        return await Promise.race([
          this.callNvidiaApi(systemPrompt, userPrompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('NVIDIA API request timeout.')), 45000))
        ]);
      } catch (err: any) {
        logger.warn(`[Nemotron] API Call Attempt ${attempt} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // Exponential backoff
      }
    }
  }

  /**
   * Real HTTP client request to NVIDIA API.
   */
  private static async callNvidiaApi(systemPrompt: string, userPrompt: string): Promise<any> {
    const customKey = getNvidiaApiKey();
    const apiKey = customKey || process.env.NVIDIA_API_KEY;
    const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-4-340b-instruct';

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API responded with status ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      logger.error(`[Nemotron] Empty content from NVIDIA. Response data: ${JSON.stringify(data)}`);
      throw new Error('NVIDIA API returned empty choice content.');
    }

    // Attempt to parse JSON from content
    try {
      return JSON.parse(content.trim());
    } catch (parseErr) {
      try {
        // Find JSON block (object or array) if wrapped in markdown formatting
        const jsonMatch = content.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON object or array found in the response content.');
      } catch (innerErr: any) {
        throw new Error(`Failed to parse Nemotron JSON output: ${innerErr.message}. Content was: ${content}`);
      }
    }
  }

  /**
   * Generates a unique cache key based on the document's state.
   */
  public static generateCacheKey(documentId: string, stateObject: any): string {
    const serialized = JSON.stringify(stateObject);
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    return `${documentId}_${hash.slice(0, 16)}`;
  }
}
