import { EnterpriseServiceMeshService } from '../integration/esm.service';
import { logger } from '../../config/logger';

export type NotificationChannel = 'SMS' | 'EMAIL' | 'PUSH' | 'WEBHOOK';

export class NotificationOrchestrator {
  /**
   * Dispatches a notification across prioritized channels with failover routing.
   */
  public static async sendNotification(
    userId: string,
    channels: NotificationChannel[],
    subject: string,
    message: string,
    payload: any = {}
  ): Promise<{ success: boolean; dispatchedChannel?: NotificationChannel; error?: string }> {
    logger.info(`[NotificationOrchestrator] Dispatching notification to user "${userId}". Channels: ${channels.join(', ')}`);

    let lastError: string | undefined;

    for (const channel of channels) {
      try {
        logger.info(`[NotificationOrchestrator] Attempting delivery on channel "${channel}"`);
        
        let operation = '';
        let targetPayload: any = {};

        switch (channel) {
          case 'SMS':
            operation = 'sendSms';
            targetPayload = { recipient: userId, message };
            break;
          case 'EMAIL':
            operation = 'sendEmail';
            targetPayload = { recipient: userId, subject, body: message };
            break;
          case 'PUSH':
            operation = 'sendPush';
            targetPayload = { recipient: userId, title: subject, body: message };
            break;
          case 'WEBHOOK':
            operation = 'triggerWebhook';
            targetPayload = { url: payload.webhookUrl || 'http://localhost:3000/webhook', event: subject, data: payload };
            break;
        }

        // Route external message dispatch through the Enterprise Service Mesh (ESM)
        await EnterpriseServiceMeshService.execute(
          'NOTIFICATION_PROVIDER',
          operation,
          targetPayload,
          { correlationId: 'notify-' + userId }
        );

        logger.info(`[NotificationOrchestrator] Delivery succeeded on channel "${channel}"`);
        return { success: true, dispatchedChannel: channel };
      } catch (err: any) {
        lastError = err.message || 'Unknown notification error';
        logger.warn(`[NotificationOrchestrator] Delivery failed on channel "${channel}": ${lastError}. Trying fallback...`);
      }
    }

    logger.error(`[NotificationOrchestrator] All notification channels failed for user "${userId}". Final error: ${lastError}`);
    return { success: false, error: lastError };
  }
}
