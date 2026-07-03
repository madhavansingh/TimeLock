import { logger } from '../config/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number; // consecutive failures before tripping
  cooldownMs: number;       // time in open state before half-open attempt
  timeoutMs: number;        // maximum duration for a single execution
}

export interface DLQEntry {
  id: string;
  serviceName: string;
  error: string;
  timestamp: Date;
  args: any[];
}

export class ResilienceService {
  private static circuits = new Map<string, {
    state: CircuitState;
    consecutiveFailures: number;
    lastStateChange: number;
  }>();

  private static dlq: DLQEntry[] = [];
  private static MAX_DLQ_SIZE = 100;

  private static defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    cooldownMs: 10000, // 10 seconds
    timeoutMs: 30000,  // 30 seconds
  };

  /**
   * Executes an async operation wrapped in a Circuit Breaker, Timeout, and Retry wrapper.
   */
  public static async execute<T>(
    serviceName: string,
    operation: (...args: any[]) => Promise<T>,
    args: any[] = [],
    customOptions?: Partial<CircuitBreakerOptions>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...customOptions };
    const circuit = this.getOrCreateCircuit(serviceName);

    // 1. Check Circuit Status
    if (circuit.state === 'OPEN') {
      const timeSinceOpen = Date.now() - circuit.lastStateChange;
      if (timeSinceOpen > opts.cooldownMs) {
        // Transition to HALF_OPEN to attempt recovery
        this.transitionTo(serviceName, 'HALF_OPEN');
        logger.warn(`[Resilience] Circuit for "${serviceName}" transitioned to HALF_OPEN (cooldown expired).`);
      } else {
        // Circuit is open, execute fallback or reject immediately
        const remainingCooldown = Math.ceil((opts.cooldownMs - timeSinceOpen) / 1000);
        logger.warn(`[Resilience] Circuit for "${serviceName}" is OPEN. Rejecting request. Cooldown: ${remainingCooldown}s remaining.`);
        if (fallback) {
          logger.info(`[Resilience] Invoking fallback handler for "${serviceName}".`);
          return await fallback();
        }
        throw new Error(`[Resilience] Circuit breaker is OPEN for service "${serviceName}". Cooldown active.`);
      }
    }

    const startTime = Date.now();

    try {
      // 2. Execute with Timeout Protection
      const result = await this.executeWithTimeout(
        () => operation(...args),
        opts.timeoutMs,
        serviceName
      );

      // 3. Success handling - Reset Circuit Breaker
      if (circuit.state === 'HALF_OPEN') {
        logger.info(`[Resilience] Service "${serviceName}" recovered. Closing circuit.`);
      }
      this.resetCircuit(serviceName);
      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[Resilience] Execution failed for "${serviceName}" in ${duration}ms: ${error.message}`);

      // 4. Failure handling - Increment failures and trip circuit
      circuit.consecutiveFailures++;
      if (circuit.consecutiveFailures >= opts.failureThreshold) {
        this.transitionTo(serviceName, 'OPEN');
        logger.error(`[Resilience] Circuit for "${serviceName}" TRIPPED to OPEN state. consecutiveFailures=${circuit.consecutiveFailures}`);
      }

      // Add to Dead Letter Queue (DLQ) if it was a final failure
      this.addToDLQ(serviceName, error.message, args);

      // 5. Invoke Fallback if provided, else propagate error
      if (fallback) {
        logger.info(`[Resilience] Invoking fallback handler for "${serviceName}" following error.`);
        try {
          return await fallback();
        } catch (fallbackError: any) {
          logger.error(`[Resilience] Fallback handler failed for "${serviceName}": ${fallbackError.message}`);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  /**
   * Runs an operation with automatic exponential backoff retry.
   */
  public static async executeWithRetry<T>(
    serviceName: string,
    operation: () => Promise<T>,
    maxAttempts = 3,
    initialDelayMs = 1000
  ): Promise<T> {
    let attempt = 1;
    let delay = initialDelayMs;

    while (attempt <= maxAttempts) {
      try {
        return await operation();
      } catch (error: any) {
        logger.warn(`[Resilience] Attempt ${attempt}/${maxAttempts} failed for "${serviceName}": ${error.message}`);
        
        if (attempt === maxAttempts) {
          throw error;
        }

        // Add full jitter to prevent thundering herd problem
        const jitter = Math.random() * 200; 
        const backoffDelay = delay + jitter;
        
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        attempt++;
        delay *= 2; // Exponential backoff
      }
    }
    throw new Error(`[Resilience] Max attempts reached for "${serviceName}".`);
  }

  /**
   * Wrap execution in a timeout promise
   */
  private static async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    serviceName: string
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: Service "${serviceName}" exceeded execution limit of ${timeoutMs}ms.`)), timeoutMs)
      ),
    ]);
  }

  private static getOrCreateCircuit(serviceName: string) {
    let circuit = this.circuits.get(serviceName);
    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastStateChange: Date.now(),
      };
      this.circuits.set(serviceName, circuit);
    }
    return circuit;
  }

  private static transitionTo(serviceName: string, state: CircuitState) {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = state;
    circuit.lastStateChange = Date.now();
  }

  private static resetCircuit(serviceName: string) {
    const circuit = this.getOrCreateCircuit(serviceName);
    circuit.state = 'CLOSED';
    circuit.consecutiveFailures = 0;
    circuit.lastStateChange = Date.now();
  }

  private static addToDLQ(serviceName: string, errorMessage: string, args: any[]) {
    const entry: DLQEntry = {
      id: Math.random().toString(36).substring(2, 11),
      serviceName,
      error: errorMessage,
      timestamp: new Date(),
      args: JSON.parse(JSON.stringify(args || []))
    };
    
    this.dlq.push(entry);
    
    // Cap DLQ size
    if (this.dlq.length > this.MAX_DLQ_SIZE) {
      this.dlq.shift();
    }
    
    logger.warn(`[Resilience] Added entry to Dead Letter Queue (DLQ) for "${serviceName}". DLQ size: ${this.dlq.length}`);
  }

  public static getDLQ(): DLQEntry[] {
    return this.dlq;
  }

  public static clearDLQ(): void {
    this.dlq = [];
  }

  public static getCircuitStatus(serviceName: string) {
    return this.getOrCreateCircuit(serviceName);
  }

  public static getAllCircuits() {
    const statusObj: Record<string, any> = {};
    for (const [key, value] of this.circuits.entries()) {
      statusObj[key] = {
        state: value.state,
        consecutiveFailures: value.consecutiveFailures,
        lastStateChange: new Date(value.lastStateChange).toISOString()
      };
    }
    return statusObj;
  }
}
