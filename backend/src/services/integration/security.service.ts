import crypto from 'crypto';
import { ConfigurationProvider } from './config-provider';

export class EnterpriseSecurityService {
  private static processedNonces = new Set<string>();
  private static driftLimitMs = 5 * 60 * 1000; // 5 minutes

  /**
   * Generates a cryptographic signature and request metadata for outgoing requests.
   */
  public static signPayload(
    method: string,
    path: string,
    payload: any,
    operatorId?: string
  ): { signature: string; timestamp: number; nonce: string } {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = path.toLowerCase();
    const bodyStr = payload ? JSON.stringify(payload) : '';

    // Create message representation
    const message = [
      normalizedMethod,
      normalizedPath,
      String(timestamp),
      nonce,
      bodyStr,
      operatorId || 'system'
    ].join('|');

    // Sign the message using the EIF secret key from the configuration provider
    const secret = ConfigurationProvider.get('JWT_SECRET');
    const signature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    return { signature, timestamp, nonce };
  }

  /**
   * Cryptographically verifies an incoming payload signature, checking timestamps, nonces, and drift.
   */
  public static verifyPayload(
    method: string,
    path: string,
    timestamp: number,
    nonce: string,
    signature: string,
    payload: any,
    operatorId?: string
  ): { isValid: boolean; reason?: string } {
    const now = Date.now();

    // 1. Validate Timestamp Drift (Replay mitigation)
    const drift = Math.abs(now - timestamp);
    if (drift > this.driftLimitMs) {
      return { 
        isValid: false, 
        reason: `Request timestamp expired. Drift: ${drift}ms, Limit: ${this.driftLimitMs}ms. Local time: ${new Date(now).toISOString()}, Request time: ${new Date(timestamp).toISOString()}` 
      };
    }

    // 2. Validate Replay Nonce
    if (this.processedNonces.has(nonce)) {
      return { isValid: false, reason: `Duplicate request detected. Nonce "${nonce}" already processed.` };
    }

    // 3. Recreate Message and Verify Signature
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = path.toLowerCase();
    const bodyStr = payload ? JSON.stringify(payload) : '';

    const message = [
      normalizedMethod,
      normalizedPath,
      String(timestamp),
      nonce,
      bodyStr,
      operatorId || 'system'
    ].join('|');

    const secret = ConfigurationProvider.get('JWT_SECRET');
    const expectedSignature = crypto.createHmac('sha256', secret).update(message).digest('hex');

    if (signature !== expectedSignature) {
      return { isValid: false, reason: 'Cryptographic signature mismatch. Payload integrity check failed.' };
    }

    // Mark nonce as processed
    this.processedNonces.add(nonce);
    
    // Garbage collect nonces older than drift limits to prevent memory growth
    setTimeout(() => {
      this.processedNonces.delete(nonce);
    }, this.driftLimitMs * 2);

    return { isValid: true };
  }

  /**
   * Computes SHA256 hashes for request payloads/responses for the audit trail.
   */
  public static computeHash(payload: any): string {
    const str = payload ? JSON.stringify(payload) : '';
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
