export interface IConnector {
  getId(): string;
  getName(): string;
  getType(): string;
  getVersion(): string;
  getLifecycleState(): string;
  setLifecycleState(state: string): void;
  execute(action: string, payload: any, context?: any): Promise<any>;
  ping(): Promise<boolean>;
  getCapabilities(): {
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
}
