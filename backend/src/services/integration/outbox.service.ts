import { Prisma } from '@prisma/client';
import { EventCatalog } from './event-catalog';
import { logger } from '../../config/logger';

export class OutboxService {
  /**
   * Commits a versioned PlatformEvent transactionally to the OutboxEvent table.
   * Ensures that events are atomically committed alongside the core business mutations.
   */
  public static async publishTransactionally(
    tx: Prisma.TransactionClient,
    eventType: string,
    payload: any,
    options: {
      priority?: number;
      sequenceNumber?: number;
      expiresAt?: Date;
      correlationId?: string;
      traceId?: string;
    } = {}
  ): Promise<void> {
    try {
      // 1. Create a versioned, immutable canonical event package from the catalog
      const event = EventCatalog.createEvent(
        eventType,
        payload,
        options.correlationId,
        options.traceId
      );

      // 2. Persist to outbox inside the active transaction
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          eventType: event.eventName,
          eventVersion: event.version,
          payload: event.payload as any,
          correlationId: event.correlationId,
          traceId: event.traceId,
          status: 'PENDING',
          priority: options.priority || 0,
          sequenceNumber: options.sequenceNumber || 0,
          expiresAt: options.expiresAt,
          attempts: 0,
        },
      });

      logger.info(`[OutboxService] Transactionally staged event "${eventType}" in Outbox. (Event ID: ${event.eventId})`, {
        correlationId: event.correlationId,
        traceId: event.traceId,
      });
    } catch (err: any) {
      logger.error(`[OutboxService] Failed to stage outbox event: ${err.message}`);
      throw err;
    }
  }
}
