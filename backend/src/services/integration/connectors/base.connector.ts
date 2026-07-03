import { IConnector } from '../connector.interface';
import { EnterpriseSecurityService } from '../security.service';
import { ResilienceService } from '../../resilience.service';
import { requestContextStorage } from '../../../config/context';

export abstract class BaseConnector implements IConnector {
  protected id: string;
  protected name: string;
  protected type: string;
  protected version: string;
  protected lifecycleState: string;
  protected endpoint: string;
  protected capabilities: {
    operations: string[];
    events: string[];
    resources: string[];
    authType: string;
    retryPolicy: {
      attempts: number;
      backoffMs: number;
    };
    timeoutMs: number;
  };

  constructor(
    id: string,
    name: string,
    type: string,
    version: string,
    capabilities: any,
    endpoint?: string
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.version = version;
    this.lifecycleState = 'REGISTERED';
    this.capabilities = capabilities;
    this.endpoint = endpoint || `http://localhost:5001/v1/interop-sandbox/${name.toLowerCase().replace(/_/g, '-')}`;
  }

  public getId(): string { return this.id; }
  public getName(): string { return this.name; }
  public getType(): string { return this.type; }
  public getVersion(): string { return this.version; }
  public getLifecycleState(): string { return this.lifecycleState; }
  public setLifecycleState(state: string): void { this.lifecycleState = state; }
  
  public getCapabilities() {
    return this.capabilities;
  }

  /**
   * Core execution method that wraps the outgoing HTTP call in the Resilience Service,
   * signs the payload, and validates response cryptographic integrity.
   */
  public async execute(action: string, payload: any, context: any = {}): Promise<any> {
    if (this.lifecycleState !== 'ACTIVE' && this.lifecycleState !== 'DEGRADED') {
      throw new Error(`[Connector:${this.name}] Cannot execute action "${action}". Connector is in "${this.lifecycleState}" state.`);
    }

    const targetUrl = `${this.endpoint}/${action}`;
    const ctx = (requestContextStorage.getStore() || {}) as any;
    const correlationId = context.correlationId || ctx.requestId || 'system';
    const traceId = context.traceId || ctx.requestId || 'system';
    const idempotencyKey = context.idempotencyKey || `idem-${this.name.toLowerCase()}-${action}-${Date.now()}`;

    // Cryptographically sign payload for outgoing integrity checks
    const { signature, timestamp, nonce } = EnterpriseSecurityService.signPayload(
      'POST',
      `/v1/interop-sandbox/${this.name.toLowerCase().replace(/_/g, '-')}/${action}`,
      payload,
      context.operatorId || 'system'
    );

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      'X-Timestamp': String(timestamp),
      'X-Nonce': nonce,
      'X-Signature': signature,
      'X-Correlation-Id': correlationId,
      'X-Trace-Id': traceId,
    };

    const executeCall = async () => {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`External API failure (${response.status}): ${errText}`);
      }

      const resData = (await response.json()) as any;

      // Zero-Trust: Verify signed response from sandbox gateway if signature headers are present
      const resSig = response.headers.get('X-Sandbox-Signature');
      const resTime = Number(response.headers.get('X-Sandbox-Timestamp'));
      const resNonce = response.headers.get('X-Sandbox-Nonce');

      if (resSig && resTime && resNonce) {
        const verify = EnterpriseSecurityService.verifyPayload(
          'POST',
          `/v1/interop-sandbox/${this.name.toLowerCase().replace(/_/g, '-')}/${action}-response`,
          resTime,
          resNonce,
          resSig,
          resData.data || resData,
          'sandbox-gateway'
        );
        if (!verify.isValid) {
          throw new Error(`[Connector:${this.name}] Response cryptographic validation failed: ${verify.reason}`);
        }
      }

      return resData;
    };

    // Execute with circuit breakers, timeouts, and retries
    return ResilienceService.execute(
      this.name,
      () => ResilienceService.executeWithRetry(
        this.name,
        executeCall,
        this.capabilities.retryPolicy.attempts,
        this.capabilities.retryPolicy.backoffMs
      ),
      [],
      { timeoutMs: this.capabilities.timeoutMs }
    );
  }

  /**
   * Health-check ping endpoint.
   */
  public async ping(): Promise<boolean> {
    try {
      const targetUrl = `${this.endpoint}/ping`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'X-Correlation-Id': 'ping' }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
