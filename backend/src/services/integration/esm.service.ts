import { ConnectorRegistry } from './connector.registry';
import { SchemaRegistryService } from './schema-registry.service';
import { EnterpriseSecurityService } from './security.service';
import { ProductionHealthService } from '../production-health.service';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export class EnterpriseServiceMeshService {
  /**
   * Discovers and executes an action on an external connector within the Service Mesh.
   * Handles validation, version negotiation, auditing, and health metrics.
   */
  public static async execute(
    connectorName: string,
    action: string,
    payload: any,
    context: any = {}
  ): Promise<any> {
    const startTime = Date.now();
    const correlationId = context.correlationId || 'mesh-corr-' + crypto.randomUUID();
    const traceId = context.traceId || 'mesh-trace-' + crypto.randomUUID();
    const operatorId = context.operatorId || 'system';

    // 1. Service Discovery
    const connector = ConnectorRegistry.get(connectorName);
    if (!connector) {
      const errorMsg = `Service Discovery Failed: Connector "${connectorName}" is not registered in the Service Mesh.`;
      logger.error(`[ESM] ${errorMsg}`, { correlationId, traceId });
      throw new Error(errorMsg);
    }

    // 2. Connector Lifecycle Guard
    const state = connector.getLifecycleState();
    if (state === 'SUSPENDED' || state === 'OFFLINE' || state === 'RETIRED') {
      const errorMsg = `Routing Blocked: Connector "${connectorName}" is currently in a "${state}" state.`;
      logger.warn(`[ESM] ${errorMsg}`, { correlationId, traceId });
      throw new Error(errorMsg);
    }

    // 3. Version Negotiation
    const requestedVersion = context.requestedVersion || '2.0.0';
    const connectorVersion = connector.getVersion();
    const isCompatible = this.negotiateVersion(requestedVersion, connectorVersion);
    if (!isCompatible) {
      const errorMsg = `Version Negotiation Failed: Requested version "${requestedVersion}" is incompatible with connector version "${connectorVersion}" on "${connectorName}".`;
      logger.error(`[ESM] ${errorMsg}`, { correlationId, traceId });
      throw new Error(errorMsg);
    }

    // 4. Canonical Request Schema Validation (Zero Trust)
    const schemaName = `${connectorName}_${action.toUpperCase()}_REQ`;
    const isRequestVal = await SchemaRegistryService.validatePayload(schemaName, payload);
    if (!isRequestVal.isValid) {
      const errorMsg = `Request Payload Validation Failed: ${isRequestVal.reason}`;
      logger.error(`[ESM] ${errorMsg}`, { correlationId, traceId });
      throw new Error(errorMsg);
    }

    let result = null;
    let errorReason: string | undefined;
    let retryCount = 0;

    try {
      // 5. Route to Connector and Execute (wrapping retries and circuit breakers inside the connector)
      const executionContext = {
        correlationId,
        traceId,
        operatorId,
        idempotencyKey: context.idempotencyKey,
      };

      result = await connector.execute(action, payload, executionContext);

      // 6. Canonical Response Schema Validation
      const respSchemaName = `${connectorName}_${action.toUpperCase()}_RES`;
      const isResponseVal = await SchemaRegistryService.validatePayload(respSchemaName, result);
      if (!isResponseVal.isValid) {
        logger.warn(`[ESM] Warning: Response Schema Validation mismatch: ${isResponseVal.reason}`, { correlationId, traceId });
      }

      return result;
    } catch (err: any) {
      errorReason = err.message || 'Unknown integration error';
      logger.error(`[ESM] Execution failed on connector "${connectorName}": ${errorReason}`, { correlationId, traceId });
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      const success = !errorReason;

      // 7. Map Subsystem to ProductionHealthService for observability
      const mappedSubsystem = this.mapConnectorToSubsystem(connectorName);
      ProductionHealthService.registerExecution(
        mappedSubsystem,
        duration,
        success,
        errorReason,
        retryCount
      );

      // 8. Cryptographic Audit Logging to Database
      try {
        const payloadHash = EnterpriseSecurityService.computeHash(payload);
        const responseHash = EnterpriseSecurityService.computeHash(result);
        
        await prisma.integrationAudit.create({
          data: {
            connectorName,
            endpoint: `${connector.getName()}/${action}`,
            correlationId,
            traceId,
            payloadHash,
            responseHash,
            executionDurationMs: duration,
            retryCount,
            result: success ? 'SUCCESS' : 'FAILED',
            errorReason,
            operatorId,
            provenance: {
              clientSignature: context.idempotencyKey ? 'verified' : 'none',
              nonceUsed: context.idempotencyKey || 'none',
              timestamp: new Date().toISOString()
            } as any
          }
        });
      } catch (dbErr) {
        logger.error('[ESM] Failed to write integration audit log:', { error: String(dbErr) });
      }
    }
  }

  /**
   * Helper: Performs semver range validation for version negotiations.
   */
  private static negotiateVersion(requested: string, available: string): boolean {
    const reqMajor = parseInt(requested.split('.')[0], 10);
    const availMajor = parseInt(available.split('.')[0], 10);
    
    // In enterprise systems, breaking changes (major version mismatches) block communication.
    // EIF v2.0 preserves full backward compatibility with v1.0.
    if (reqMajor === 1 && availMajor === 2) {
      return true;
    }
    return reqMajor === availMajor;
  }

  /**
   * Helper: Maps EIF connector names to ProductionHealthService subsystems.
   */
  private static mapConnectorToSubsystem(connectorName: string): string {
    switch (connectorName) {
      case 'SOLANA_BLOCKCHAIN': return 'SOLANA_RPC';
      case 'CLOUD_STORAGE': return 'PINATA_IPFS';
      case 'NOTIFICATION_PROVIDER': return 'NOTIFICATION_SERVICES';
      case 'NEMOTRON_AI': return 'NVIDIA_NEMOTRON';
      default: return 'BACKGROUND_WORKERS';
    }
  }
}
