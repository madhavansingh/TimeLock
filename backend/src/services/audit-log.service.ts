import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { getRequestId } from '../config/context';

export interface AuditLogPayload {
  action: 'DOCUMENT_REGISTRATION' | 'AI_ANALYSIS' | 'EVIDENCE_UPLOAD' | 'NOTARY_REVIEW' | 'SIGNATURE' | 'OWNERSHIP_TRANSFER' | 'TRUST_GRAPH_UPDATE' | 'AVCC_EXECUTION' | 'JUDGE_REVIEW';
  message: string;
  actorId?: string | null;
  actorRole?: string | null;
  entityType?: 'DOCUMENT' | 'PROPERTY' | 'TRANSFER' | 'CASE' | null;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: any;
}

export class AuditLogService {
  /**
   * Commits an audit event record to the database and prints a structured warning/info log.
   */
  public static async log(payload: AuditLogPayload): Promise<void> {
    const requestId = getRequestId();
    try {
      await prisma.auditLog.create({
        data: {
          action: payload.action,
          message: payload.message,
          actorId: payload.actorId || null,
          actorRole: payload.actorRole || null,
          entityType: payload.entityType || null,
          entityId: payload.entityId || null,
          requestId,
          ipAddress: payload.ipAddress || null,
          metadata: payload.metadata || {}
        }
      });

      logger.info(`[AUDIT] ${payload.action}: ${payload.message}`, {
        action: payload.action,
        actorId: payload.actorId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        requestId
      });
    } catch (err: any) {
      logger.error(`[AUDIT ERROR] Failed to write audit log: ${err.message}`, {
        action: payload.action,
        requestId
      });
    }
  }
}
