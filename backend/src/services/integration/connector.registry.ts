import { IConnector } from './connector.interface';
import { prisma } from '../../config/db';

export class ConnectorRegistry {
  private static connectors = new Map<string, IConnector>();

  /**
   * Registers a connector instance in memory and synchronizes its state in the database.
   */
  public static async register(connector: IConnector, ownerEmail = 'admin@timelock.network'): Promise<void> {
    const name = connector.getName();
    this.connectors.set(name, connector);

    const capabilities = connector.getCapabilities();

    try {
      // Synchronize connector configuration in PostgreSQL
      await prisma.connectorConfig.upsert({
        where: { name },
        update: {
          type: connector.getType(),
          lifecycleState: connector.getLifecycleState(),
          version: connector.getVersion(),
          capabilities: capabilities as any,
          status: 'HEALTHY',
          updatedAt: new Date(),
        },
        create: {
          name,
          type: connector.getType(),
          lifecycleState: connector.getLifecycleState(),
          version: connector.getVersion(),
          endpoint: 'http://localhost:5001/v1/interop-sandbox/' + name.toLowerCase().replace(/_/g, '-'),
          authType: capabilities.authType,
          authConfig: { secretKeyName: 'JWT_SECRET' },
          retryPolicy: capabilities.retryPolicy as any,
          timeoutMs: capabilities.timeoutMs,
          capabilities: capabilities as any,
          owner: ownerEmail,
          approvalStatus: 'APPROVED',
          complianceStatus: 'COMPLIANT',
          deploymentHistory: [{ version: connector.getVersion(), deployedAt: new Date().toISOString() }],
          status: 'HEALTHY',
        },
      });
    } catch (err) {
      console.error(`[ConnectorRegistry] Failed to sync database config for connector ${name}:`, err);
    }
  }

  /**
   * Discovers a connector by its unique name.
   */
  public static get(name: string): IConnector | undefined {
    return this.connectors.get(name);
  }

  /**
   * Retrieves all registered connectors.
   */
  public static getAll(): IConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Updates the lifecycle state of a connector in memory and persistent storage.
   */
  public static async updateLifecycle(name: string, state: string): Promise<void> {
    const connector = this.connectors.get(name);
    if (connector) {
      connector.setLifecycleState(state);
      try {
        await prisma.connectorConfig.update({
          where: { name },
          data: { lifecycleState: state, updatedAt: new Date() },
        });
      } catch (err) {
        console.error(`[ConnectorRegistry] Failed to update database lifecycle for ${name}:`, err);
      }
    }
  }
}
