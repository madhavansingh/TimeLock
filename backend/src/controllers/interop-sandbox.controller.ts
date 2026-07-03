import { Request, Response } from 'express';
import crypto from 'crypto';
import { EnterpriseSecurityService } from '../services/integration/security.service';
import { logger } from '../config/logger';

export class InteropSandboxController {
  private static processedNonces = new Set<string>();
  private static driftLimitMs = 5 * 60 * 1000;

  /**
   * Main incoming request router and cryptographic validator.
   */
  public static async handleAction(req: Request, res: Response): Promise<void> {
    const { connectorName, action } = req.params;
    const method = req.method;
    const path = req.originalUrl.split('?')[0];

    const signature = req.headers['x-signature'] as string;
    const timestamp = Number(req.headers['x-timestamp']);
    const nonce = req.headers['x-nonce'] as string;
    const correlationId = req.headers['x-correlation-id'] as string || 'sandbox-corr';

    logger.info(`[InteropSandbox] Received incoming request on "${connectorName}/${action}"`, { correlationId });

    // 1. Cryptographic Zero-Trust Validation on incoming requests
    if (signature && timestamp && nonce) {
      // Validate Drift
      const drift = Math.abs(Date.now() - timestamp);
      if (drift > InteropSandboxController.driftLimitMs) {
        res.status(401).json({ error: 'Sandbox: Timestamp expired (replay threat)' });
        return;
      }

      // Validate Nonce Replay
      if (InteropSandboxController.processedNonces.has(nonce)) {
        res.status(401).json({ error: 'Sandbox: Duplicate request detected (replay threat)' });
        return;
      }
      InteropSandboxController.processedNonces.add(nonce);
      setTimeout(() => InteropSandboxController.processedNonces.delete(nonce), InteropSandboxController.driftLimitMs * 2);

      // Verify Signature using EnterpriseSecurityService
      const verify = EnterpriseSecurityService.verifyPayload(
        method,
        path,
        timestamp,
        nonce,
        signature,
        req.body,
        req.headers['x-operator-id'] as string
      );

      if (!verify.isValid) {
        res.status(401).json({ error: 'Sandbox: Signature verification failed', reason: verify.reason });
        return;
      }
    } else {
      // Enforce mandatory cryptographic signing
      res.status(401).json({ error: 'Sandbox: Unauthorized. Missing mandatory EIF cryptographic headers.' });
      return;
    }

    // 2. Process Action and Generate Canonical Response Payload
    let responsePayload: any = { success: true };
    const nameUpper = connectorName.toUpperCase();

    if (nameUpper === 'GOVERNMENT_REGISTRY') {
      if (action === 'verifyProperty') {
        responsePayload = {
          data: {
            isValid: true,
            ownerName: 'Plot 402 LLC',
            ownerNameHash: req.body.propertyId ? EnterpriseSecurityService.computeHash({ owner: 'Plot 402 LLC' }) : 'hash',
            registryStatus: 'ACTIVE',
            lastRegistryAttestation: new Date().toISOString()
          }
        };
      } else if (action === 'updatePropertyOwner') {
        responsePayload = {
          data: {
            success: true,
            transactionHash: '0xgov-' + crypto.randomBytes(16).toString('hex'),
            syncedAt: new Date().toISOString()
          }
        };
      }
    } else if (nameUpper === 'BANKING_PLATFORM') {
      responsePayload = {
        data: {
          success: true,
          reference: 'bank-clear-' + crypto.randomBytes(8).toString('hex'),
          escrowStatus: 'CLEARED',
          clearedAt: new Date().toISOString()
        }
      };
    } else if (nameUpper === 'E_SIGN_PROVIDER') {
      responsePayload = {
        data: {
          signature: 'esign-sig-' + crypto.randomBytes(32).toString('hex'),
          signedAt: new Date().toISOString()
        }
      };
    } else if (nameUpper === 'COURT_SYSTEM') {
      responsePayload = {
        data: {
          activeLitigation: false,
          disputesCount: 0,
          verifiedOrders: [],
          status: 'COMPLIANT'
        }
      };
    } else if (nameUpper === 'NOTIFICATION_PROVIDER') {
      responsePayload = {
        data: {
          success: true,
          messageId: 'msg-' + crypto.randomBytes(12).toString('hex'),
          delivered: true
        }
      };
    } else if (nameUpper === 'CLOUD_STORAGE') {
      responsePayload = {
        data: {
          cid: 'Qm' + crypto.randomBytes(21).toString('hex'),
          size: 1024,
          url: 'ipfs://Qm...'
        }
      };
    } else if (nameUpper === 'PAYMENT_GATEWAY') {
      responsePayload = {
        data: {
          id: 'pay_' + crypto.randomBytes(14).toString('hex'),
          status: 'captured',
          amount: req.body.amount || 1000
        }
      };
    }

    // 3. Cryptographically Sign Response Payload (Zero-Trust Backwards Loop)
    const respPath = `${path}-response`;
    const { signature: resSig, timestamp: resTime, nonce: resNonce } = EnterpriseSecurityService.signPayload(
      'POST',
      respPath,
      responsePayload.data || responsePayload,
      'sandbox-gateway'
    );

    res.setHeader('X-Sandbox-Signature', resSig);
    res.setHeader('X-Sandbox-Timestamp', String(resTime));
    res.setHeader('X-Sandbox-Nonce', resNonce);

    res.status(200).json(responsePayload);
  }

  /**
   * Health-check ping.
   */
  public static async ping(req: Request, res: Response): Promise<void> {
    res.status(200).json({ status: 'HEALTHY', sandbox: 'EIF_INTEROP_SANDBOX_V2' });
  }
}
