import { logger } from '../../config/logger';
import { ModelRegistryService } from './model-registry.service';
import crypto from 'crypto';

export interface QueuedTask {
  taskId: string;
  agentName: string;
  priority: number; // Higher numbers represent higher priority (e.g. Judicial: 3, Notary: 2, Citizen: 1)
  payload: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

export class AiOrchestratorService {
  private static activeExecutions = 0;
  private static MAX_CONCURRENT_EXECUTIONS = 4; // limit parallel GPU streams
  private static taskQueue: QueuedTask[] = [];

  // In-memory cache for prompt deduplication
  private static deduplicationCache = new Map<string, { result: any; timestamp: number }>();
  private static CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache TTL

  /**
   * Orchestrates and executes an AI agent task.
   * Leverages deduplication caching, priority queue balancing, and model registry resolution.
   */
  public static async executeAgentTask(
    agentName: string,
    payload: any,
    priority: number = 1 // Default: 1 (CITIZEN), 2 (NOTARY), 3 (ADMIN/JUDGE)
  ): Promise<any> {
    // 1. Resolve prompt and model versions dynamically from the Model Registry
    const { modelVersion, promptVersion } = await ModelRegistryService.resolveActiveVersion(agentName);
    
    // 2. Perform Deduplication Caching Check
    const cacheKey = this.generateCacheKey(agentName, promptVersion, payload);
    const cached = this.deduplicationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      logger.info(`[AiOrchestrator] Cache HIT for agent ${agentName} (Prompt: ${promptVersion}). Skipping GPU execution.`);
      return cached.result;
    }

    // 3. Queue the task and wait for GPU capacity
    return new Promise((resolve, reject) => {
      const task: QueuedTask = {
        taskId: crypto.randomUUID(),
        agentName,
        priority,
        payload: { ...payload, modelVersion, promptVersion },
        resolve,
        reject,
        timestamp: Date.now()
      };

      logger.info(`[AiOrchestrator] Enqueuing task ${task.taskId} for ${agentName} (Priority: ${priority}, Queue Depth: ${this.taskQueue.length})`);
      this.taskQueue.push(task);
      
      // Sort queue by priority (descending) and timestamp (ascending)
      this.taskQueue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

      // Attempt to trigger the next execution in the loop
      this.processNextTask();
    });
  }

  /**
   * Processes the next task in the priority queue if GPU capacity is available.
   */
  private static async processNextTask(): Promise<void> {
    if (this.activeExecutions >= this.MAX_CONCURRENT_EXECUTIONS) {
      return;
    }

    const nextTask = this.taskQueue.shift();
    if (!nextTask) return;

    this.activeExecutions++;
    logger.info(`[AiOrchestrator] Starting task ${nextTask.taskId} for ${nextTask.agentName}. Active GPU streams: ${this.activeExecutions}`);

    try {
      // Simulate Nemotron model execution with dynamic parameters
      const startTime = Date.now();
      const result = await this.simulateAgentInference(nextTask.agentName, nextTask.payload);
      
      // Cache the result for deduplication
      const cacheKey = this.generateCacheKey(nextTask.agentName, nextTask.payload.promptVersion, nextTask.payload);
      this.deduplicationCache.set(cacheKey, { result, timestamp: Date.now() });

      logger.info(`[AiOrchestrator] Completed task ${nextTask.taskId} in ${Date.now() - startTime}ms.`);
      nextTask.resolve(result);
    } catch (err: any) {
      logger.error(`[AiOrchestrator] Task ${nextTask.taskId} failed: ${err.message}`);
      nextTask.reject(err);
    } finally {
      this.activeExecutions--;
      // Trigger the next task in the queue
      this.processNextTask();
    }
  }

  /**
   * Generates a deterministic hash cache key for prompt deduplication.
   */
  private static generateCacheKey(agentName: string, promptVersion: string, payload: any): string {
    const serializedInput = JSON.stringify({ agentName, promptVersion, payload });
    return crypto.createHash('sha256').update(serializedInput).digest('hex');
  }

  /**
   * Simulates the actual LLM inference run.
   */
  private static async simulateAgentInference(agentName: string, payload: any): Promise<any> {
    // In a real execution, this coordinates RPC requests to the private Nvidia Nemotron container.
    // Here we simulate the response, strictly matching the required agent schema format.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 'SUCCESS',
          decision: payload.decisionOverride || 'ALLOW',
          confidence: 92,
          quality: 90,
          completeness: 95,
          reliability: 96,
          agentName,
          modelVersion: payload.modelVersion,
          promptVersion: payload.promptVersion,
          timestamp: new Date().toISOString()
        });
      }, 100);
    });
  }

  /**
   * Clears the prompt deduplication cache (called on global refreshes or model rollbacks).
   */
  public static clearCache(): void {
    this.deduplicationCache.clear();
    logger.info('[AiOrchestrator] Deduplication cache successfully cleared.');
  }
}
