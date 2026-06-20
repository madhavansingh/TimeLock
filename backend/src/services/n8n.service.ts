import { config } from '../config/env';
import { logger } from '../config/logger';

export class N8nService {
  /**
   * Triggers the n8n webhook when a document is assigned/registered.
   * Runs asynchronously in a fire-and-forget manner to remain non-blocking.
   */
  public static notifyDocumentAssigned(document: {
    documentId: string;
    title: string;
    type: string;
    status: string;
    ownerUserId: string;
    surveyNumber?: string | null;
    metadata?: { surveyNumber?: string | null } | null;
  }): void {
    const url = config.n8nDocumentAssignedWebhook;
    if (!url) {
      logger.warn('[N8N] Document assigned webhook URL is not configured.');
      return;
    }

    const payload = {
      documentId: document.documentId,
      propertyId: document.surveyNumber || document.metadata?.surveyNumber || 'N/A',
      title: document.title,
      ownerName: `User_${document.ownerUserId.slice(0, 8)}`,
      documentType: document.type,
      status: document.status,
      timestamp: new Date().toISOString()
    };

    // Async fire-and-forget
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        logger.info(`N8N_DOCUMENT_ASSIGNED_SENT - Document ${document.documentId} assigned webhook successfully sent.`);
      })
      .catch((err) => {
        logger.error(`N8N_WEBHOOK_FAILED - Failed to send document assigned webhook: ${err.message}`, {
          error: err,
          payload
        });
      });
  }

  /**
   * Triggers the n8n webhook when a document is verified by notary/advocate.
   * Runs asynchronously in a fire-and-forget manner to remain non-blocking.
   */
  public static notifyDocumentVerified(
    document: {
      documentId: string;
      status: string;
      surveyNumber?: string | null;
      metadata?: { surveyNumber?: string | null } | null;
    },
    verifiedBy: string,
    role: string,
    trustScore: number | string
  ): void {
    const url = config.n8nDocumentVerifiedWebhook;
    if (!url) {
      logger.warn('[N8N] Document verified webhook URL is not configured.');
      return;
    }

    const payload = {
      documentId: document.documentId,
      propertyId: document.surveyNumber || document.metadata?.surveyNumber || 'N/A',
      verifiedBy,
      role,
      trustScore: String(trustScore),
      status: document.status,
      timestamp: new Date().toISOString()
    };

    // Async fire-and-forget
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        logger.info(`N8N_DOCUMENT_VERIFIED_SENT - Document ${document.documentId} verified webhook successfully sent.`);
      })
      .catch((err) => {
        logger.error(`N8N_WEBHOOK_FAILED - Failed to send document verified webhook: ${err.message}`, {
          error: err,
          payload
        });
      });
  }
}
