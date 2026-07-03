import { prisma } from '../../config/db';
import { EventBus } from './event-bus';
import { EnterpriseServiceMeshService } from './esm.service';
import { logger } from '../../config/logger';

export class OutboxWorker {
  private static isRunning = false;
  private static intervalInstance: NodeJS.Timeout | null = null;
  private static pollIntervalMs = 2000; // Poll every 2 seconds

  /**
   * Starts the background outbox worker polling loop.
   */
  public static start(): void {
    if (this.intervalInstance) return;

    logger.info(`[OutboxWorker] Starting transactional outbox background worker (polling: ${this.pollIntervalMs}ms)`);
    this.intervalInstance = setInterval(() => {
      this.poll().catch(err => {
        logger.error('[OutboxWorker] Error in background polling iteration:', err);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Gracefully stops the outbox background worker.
   */
  public static stop(): void {
    if (this.intervalInstance) {
      clearInterval(this.intervalInstance);
      this.intervalInstance = null;
      logger.info('[OutboxWorker] Background worker stopped.');
    }
  }

  /**
   * Core polling loop iteration. Retrieves and processes pending events sequentially.
   */
  public static async poll(): Promise<void> {
    if (this.isRunning) return; // Prevent concurrent polling runs
    this.isRunning = true;

    try {
      // Fetch pending outbox events ordered by priority (highest first) and sequence (lowest first)
      const events = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        orderBy: [
          { priority: 'desc' },
          { sequenceNumber: 'asc' },
          { createdAt: 'asc' }
        ],
        take: 10 // process in batches of 10
      });

      if (events.length === 0) {
        this.isRunning = false;
        return;
      }

      logger.info(`[OutboxWorker] Polled ${events.length} pending outbox events for processing.`);

      for (const entry of events) {
        const correlationId = entry.correlationId || 'outbox-corr';
        const traceId = entry.traceId || 'outbox-trace';

        // 1. Expiration Check (DLQ routing)
        if (entry.expiresAt && entry.expiresAt.getTime() < Date.now()) {
          logger.warn(`[OutboxWorker] Event "${entry.id}" has expired. Moving to DLQ.`, { correlationId });
          await prisma.outboxEvent.update({
            where: { id: entry.id },
            data: { 
              status: 'EXPIRED', 
              lastError: 'Message expired before processing.' 
            }
          });
          continue;
        }

        // 2. Poison Message Check (DLQ routing)
        if (entry.attempts >= 5) {
          logger.error(`[OutboxWorker] Poison event "${entry.id}" detected (attempts: ${entry.attempts}). Moving to DLQ.`, { correlationId });
          await prisma.outboxEvent.update({
            where: { id: entry.id },
            data: { 
              status: 'POISON', 
              lastError: `Poison message threshold exceeded. Attempts: ${entry.attempts}` 
            }
          });
          
          // Generate a security incident for audit alert
          await prisma.securityIncident.create({
            data: {
              severity: 'HIGH',
              failureReason: `Poison message threshold exceeded for outbox event "${entry.eventType}" (Event ID: ${entry.id})`,
              sourceIpHash: 'local-outbox-worker',
              headers: {} as any,
              correlationId,
              metadata: { eventId: entry.id } as any
            }
          });
          continue;
        }

        // Increment attempts count before execution to prevent double processing in crash loops
        await prisma.outboxEvent.update({
          where: { id: entry.id },
          data: { attempts: entry.attempts + 1 }
        });

        try {
          // Construct the versioned platform event package
          const platformEvent = {
            eventId: entry.id,
            eventName: entry.eventType,
            version: entry.eventVersion,
            producer: 'OUTBOX_WORKER',
            consumer: 'MESH',
            schemaVersion: entry.eventVersion,
            timestamp: entry.createdAt,
            correlationId,
            traceId,
            payloadHash: 'hash',
            replayId: entry.id,
            retentionPolicyDays: 365,
            payload: entry.payload
          };

          // 3. Dispatch to internal Event Bus
          await EventBus.publish(platformEvent);

          // 4. Dispatch to external interop gateways via ESM if applicable
          if (entry.eventType === 'DOCUMENT_REGISTERED') {
            await EnterpriseServiceMeshService.execute(
              'GOVERNMENT_REGISTRY',
              'verifyProperty', // simulate property sync validation
              { propertyId: (entry.payload as any).documentId || 'test-prop-id' },
              { correlationId, traceId }
            );
          } else if (entry.eventType === 'OWNERSHIP_TRANSFER_COMPLETED') {
            await EnterpriseServiceMeshService.execute(
              'GOVERNMENT_REGISTRY',
              'updatePropertyOwner',
              { propertyId: (entry.payload as any).documentId || 'test-prop-id' },
              { correlationId, traceId }
            );
          }

          // 5. Update outbox entry status to PROCESSED
          await prisma.outboxEvent.update({
            where: { id: entry.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
              lastError: null
            }
          });

          logger.info(`[OutboxWorker] Event "${entry.id}" (${entry.eventType}) processed successfully.`, { correlationId });
        } catch (err: any) {
          const errMsg = err.message || 'Unknown processing error';
          logger.warn(`[OutboxWorker] Retrying event "${entry.id}" due to error: ${errMsg}`, { correlationId });
          
          // Record the error but leave state as PENDING for retry loop
          await prisma.outboxEvent.update({
            where: { id: entry.id },
            data: { 
              lastError: errMsg 
            }
          });
        }
      }
    } catch (globalErr) {
      logger.error('[OutboxWorker] Global polling error:', { error: String(globalErr) });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Replays a dead, poison, or processed outbox event by resetting its state.
   */
  public static async replayEvent(eventId: string): Promise<void> {
    const entry = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!entry) {
      throw new Error(`[OutboxWorker] Event with ID "${eventId}" not found.`);
    }

    await prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'PENDING',
        attempts: 0,
        processedAt: null,
        lastError: 'Admin triggered event replay.',
      }
    });

    logger.info(`[OutboxWorker] Admin triggered event replay for event ID "${eventId}"`);
  }
}
