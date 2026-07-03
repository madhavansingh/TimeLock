import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { Connection } from '@solana/web3.js';

export type HealthStatus = 'HEALTHY' | 'WARNING' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | 'RECOVERING';

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  availability: number; // percentage (e.g., 99.9)
  latencyMs: number;
  queueLength: number;
  errorCount: number;
  retryCount: number;
  uptimeSeconds: number;
  lastSuccessfulExecution: string | null;
  lastFailure: string | null;
  recoveryState: string;
}

export interface AiAgentStats {
  name: string;
  activeModel: string;
  version: string;
  status: 'ACTIVE' | 'IDLE' | 'ERROR';
  executionCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  averageRuntimeMs: number;
  averageTokens: number;
  averageConfidence: number;
  queueLength: number;
  lastExecution: string | null;
  lastException: string | null;
}

export class ProductionHealthService {
  private static bootTime = Date.now();
  private static collector = new Map<string, {
    executions: number;
    successes: number;
    latencies: number[];
    consecutiveFailures: number;
    errorCount: number;
    retryCount: number;
    lastSuccess: number | null;
    lastFailure: number | null;
    lastFailureReason: string | null;
    queueLength: number;
    status: HealthStatus;
  }>();

  private static aiAgents = new Map<string, {
    activeModel: string;
    version: string;
    status: 'ACTIVE' | 'IDLE' | 'ERROR';
    executionCount: number;
    successCount: number;
    failureCount: number;
    retryCount: number;
    runtimes: number[];
    tokens: number[];
    confidences: number[];
    queueLength: number;
    lastExecution: number | null;
    lastException: string | null;
  }>();

  private static AGENTS_LIST = [
    'DocumentLegalityAgent',
    'ChainIntegrityAgent',
    'ConflictInvestigatorAgent',
    'CrossExaminationAgent',
    'DecisionCopilotAgent',
    'EvidenceRecommendationAgent',
    'FraudRiskAgent',
    'NationalRiskAgent',
    'RegistrationPredictorAgent',
    'TrustScoreAgent',
    'AnomalyAgent'
  ];

  private static SUBSYSTEMS = [
    'API_GATEWAY',
    'POSTGRESQL',
    'SOLANA_RPC',
    'PINATA_IPFS',
    'NVIDIA_NEMOTRON',
    'DIGITAL_TWIN_ENGINE',
    'AVE_ORCHESTRATION',
    'TRUST_GRAPH',
    'AVCC',
    'UPLOAD_PIPELINE',
    'VERIFICATION_PIPELINE',
    'OWNERSHIP_REGISTRY',
    'NOTIFICATION_SERVICES',
    'BACKGROUND_WORKERS',
    'AI_QUEUES'
  ];

  static {
    // Initialize all subsystems with default healthy profiles
    for (const sys of this.SUBSYSTEMS) {
      this.collector.set(sys, {
        executions: 0,
        successes: 0,
        latencies: [],
        consecutiveFailures: 0,
        errorCount: 0,
        retryCount: 0,
        lastSuccess: null,
        lastFailure: null,
        lastFailureReason: null,
        queueLength: 0,
        status: 'HEALTHY'
      });
    }

    // Initialize all AI agents
    const defaultModel = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-30b-a3b';
    for (const agent of this.AGENTS_LIST) {
      this.aiAgents.set(agent, {
        activeModel: defaultModel,
        version: '1.0.0',
        status: 'IDLE',
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        retryCount: 0,
        runtimes: [],
        tokens: [],
        confidences: [],
        queueLength: 0,
        lastExecution: null,
        lastException: null
      });
    }
  }

  /**
   * Registers a service execution event for real-time telemetry.
   */
  public static registerExecution(
    subsystem: string,
    durationMs: number,
    success: boolean,
    errorMsg?: string,
    retryCount = 0,
    queueLength = 0
  ): void {
    const stats = this.collector.get(subsystem);
    if (!stats) return;

    stats.executions++;
    stats.retryCount += retryCount;
    stats.queueLength = queueLength;

    if (success) {
      stats.successes++;
      stats.consecutiveFailures = 0;
      stats.lastSuccess = Date.now();
      
      // Transition out of degraded/warning states
      if (stats.status === 'CRITICAL' || stats.status === 'DEGRADED' || stats.status === 'OFFLINE') {
        stats.status = 'RECOVERING';
      } else {
        stats.status = 'HEALTHY';
      }
    } else {
      stats.errorCount++;
      stats.consecutiveFailures++;
      stats.lastFailure = Date.now();
      stats.lastFailureReason = errorMsg || 'Unknown operational failure';

      // Degrade status based on consecutive failure count
      if (stats.consecutiveFailures >= 5) {
        stats.status = 'CRITICAL';
      } else if (stats.consecutiveFailures >= 3) {
        stats.status = 'DEGRADED';
      } else {
        stats.status = 'WARNING';
      }
      
      logger.error(`[HealthEngine] Subsystem "${subsystem}" reported failure: ${stats.lastFailureReason}. consecutiveFailures=${stats.consecutiveFailures}`);
    }

    // Keep sliding window of last 10 latencies
    stats.latencies.push(durationMs);
    if (stats.latencies.length > 10) {
      stats.latencies.shift();
    }
  }

  /**
   * Manually sets status of a subsystem (e.g., if background check detects failure)
   */
  public static setStatus(subsystem: string, status: HealthStatus, errorMsg?: string): void {
    const stats = this.collector.get(subsystem);
    if (!stats) return;
    stats.status = status;
    if (errorMsg) {
      stats.lastFailure = Date.now();
      stats.lastFailureReason = errorMsg;
    }
  }

  /**
   * Dynamically evaluates database and blockchain connection health, then returns the full report.
   */
  public static async getHealthReport(): Promise<SubsystemHealth[]> {
    // 1. Dynamic Check for PostgreSQL
    const dbStart = Date.now();
    let dbSuccess = false;
    let dbError: string | undefined;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbSuccess = true;
    } catch (err: any) {
      dbError = err.message;
    }
    this.registerExecution('POSTGRESQL', Date.now() - dbStart, dbSuccess, dbError);

    // 2. Dynamic Check for Solana RPC (Devnet)
    const solStart = Date.now();
    let solSuccess = false;
    let solError: string | undefined;
    try {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      await connection.getSlot();
      solSuccess = true;
    } catch (err: any) {
      solError = err.message;
    }
    this.registerExecution('SOLANA_RPC', Date.now() - solStart, solSuccess, solError);

    // 3. Compile full report
    const uptimeSeconds = Math.floor((Date.now() - this.bootTime) / 1000);
    const report: SubsystemHealth[] = [];

    for (const [name, stats] of this.collector.entries()) {
      const avgLatency = stats.latencies.length > 0
        ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
        : 0;

      const availability = stats.executions > 0
        ? parseFloat(((stats.successes / stats.executions) * 100).toFixed(2))
        : 100.00; // default to 100% if no executions yet

      // Clean up recovery states
      let recoveryState = 'Operational';
      if (stats.status === 'RECOVERING') {
        recoveryState = 'Verification in progress, incoming transactions stable';
      } else if (stats.status === 'CRITICAL' || stats.status === 'DEGRADED') {
        recoveryState = stats.lastFailureReason || 'Subsystem error detected';
      } else if (stats.status === 'WARNING') {
        recoveryState = `Minor warning: ${stats.lastFailureReason || 'Transient failure detected'}`;
      }

      report.push({
        name,
        status: stats.status,
        availability,
        latencyMs: avgLatency,
        queueLength: stats.queueLength,
        errorCount: stats.errorCount,
        retryCount: stats.retryCount,
        uptimeSeconds,
        lastSuccessfulExecution: stats.lastSuccess ? new Date(stats.lastSuccess).toISOString() : null,
        lastFailure: stats.lastFailure ? new Date(stats.lastFailure).toISOString() : null,
        recoveryState
      });
    }

    return report;
  }

  /**
   * Registers an execution event for a specific AI Agent.
   */
  public static registerAiAgentExecution(
    name: string,
    durationMs: number,
    success: boolean,
    tokens = 0,
    confidence = 0,
    errorMsg?: string,
    retryCount = 0,
    queueLength = 0
  ): void {
    const stats = this.aiAgents.get(name);
    if (!stats) return;

    stats.executionCount++;
    stats.retryCount += retryCount;
    stats.queueLength = queueLength;
    stats.lastExecution = Date.now();

    if (success) {
      stats.successCount++;
      stats.status = 'IDLE';
      stats.lastException = null;
    } else {
      stats.failureCount++;
      stats.status = 'ERROR';
      stats.lastException = errorMsg || 'AI service failure';
    }

    if (durationMs > 0) stats.runtimes.push(durationMs);
    if (tokens > 0) stats.tokens.push(tokens);
    if (confidence > 0) stats.confidences.push(confidence);

    // Limit sliding windows to 20 runs
    if (stats.runtimes.length > 20) stats.runtimes.shift();
    if (stats.tokens.length > 20) stats.tokens.shift();
    if (stats.confidences.length > 20) stats.confidences.shift();
  }

  /**
   * Retrieves live metrics report for all registered AI agents.
   */
  public static getAiAgentsReport(): AiAgentStats[] {
    const report: AiAgentStats[] = [];

    for (const [name, stats] of this.aiAgents.entries()) {
      const avgRuntime = stats.runtimes.length > 0
        ? Math.round(stats.runtimes.reduce((a, b) => a + b, 0) / stats.runtimes.length)
        : 0;

      const avgTokens = stats.tokens.length > 0
        ? Math.round(stats.tokens.reduce((a, b) => a + b, 0) / stats.tokens.length)
        : 0;

      const avgConfidence = stats.confidences.length > 0
        ? Math.round(stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length)
        : 0;

      report.push({
        name,
        activeModel: stats.activeModel,
        version: stats.version,
        status: stats.status,
        executionCount: stats.executionCount,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        retryCount: stats.retryCount,
        averageRuntimeMs: avgRuntime,
        averageTokens: avgTokens,
        averageConfidence: avgConfidence,
        queueLength: stats.queueLength,
        lastExecution: stats.lastExecution ? new Date(stats.lastExecution).toISOString() : null,
        lastException: stats.lastException
      });
    }

    return report;
  }
}
