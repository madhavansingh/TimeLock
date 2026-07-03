import { PlatformEvent } from './event-catalog';
import { logger } from '../../config/logger';

export type EventSubscriber = (event: PlatformEvent) => Promise<void>;

export class EventBus {
  private static subscribers = new Map<string, Set<EventSubscriber>>();
  private static eventHistory: PlatformEvent[] = [];
  private static maxHistorySize = 1000;

  /**
   * Subscribes a callback handler to a specific versioned platform event.
   */
  public static subscribe(eventName: string, handler: EventSubscriber): void {
    let subs = this.subscribers.get(eventName);
    if (!subs) {
      subs = new Set<EventSubscriber>();
      this.subscribers.set(eventName, subs);
    }
    subs.add(handler);
    logger.info(`[EventBus] Subscriber registered for event "${eventName}"`);
  }

  /**
   * Publishes an immutable PlatformEvent to all registered subscribers.
   * Caches the event in a circular buffer to support real-time replay.
   */
  public static async publish(event: PlatformEvent): Promise<void> {
    const subs = this.subscribers.get(event.eventName);
    
    // Store in circular history buffer for replays
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    if (!subs || subs.size === 0) {
      logger.info(`[EventBus] Published event "${event.eventName}" with 0 subscribers.`, { correlationId: event.correlationId });
      return;
    }

    logger.info(`[EventBus] Dispatching event "${event.eventName}" to ${subs.size} subscribers.`, { correlationId: event.correlationId });
    
    const promises = Array.from(subs).map(async (handler) => {
      try {
        await handler(event);
      } catch (err: any) {
        logger.error(`[EventBus] Subscriber execution failed for event "${event.eventName}": ${err.message}`, { correlationId: event.correlationId });
      }
    });

    // Run subscribers concurrently
    await Promise.all(promises);
  }

  /**
   * Replays cached history events for a specific correlationId or event range.
   */
  public static async replayHistory(eventName: string, handler: EventSubscriber): Promise<number> {
    const matches = this.eventHistory.filter(e => e.eventName === eventName);
    logger.info(`[EventBus] Initiating replay of ${matches.length} historical events for "${eventName}"`);
    
    for (const event of matches) {
      try {
        await handler(event);
      } catch (err: any) {
        logger.error(`[EventBus] Historical replay failed for event ID "${event.eventId}": ${err.message}`);
      }
    }

    return matches.length;
  }

  /**
   * Clears all subscribers (primarily for clean testing teardown).
   */
  public static clear(): void {
    this.subscribers.clear();
    this.eventHistory = [];
  }
}
