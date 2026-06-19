import { Request, Response, NextFunction } from 'express';
import { NotaryOnboardSchema } from '../../../shared/validation';
import { prisma } from '../config/db';
import { DbDocumentStatus } from '@prisma/client';

export class NotaryController {
  /**
   * Register a new notary with their Class 3 DSC certificate details.
   */
  public static async onboardNotary(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = NotaryOnboardSchema.parse(req.body);

      const notary = await prisma.notary.create({
        data: {
          name: payload.name,
          dscCertificateSerial: payload.dscCertificateSerial,
          publicKey: payload.publicKeyBase64,
          certStatus: 'active'
        }
      });

      res.status(201).json({
        data: {
          notaryId: notary.notaryId,
          message: 'Notary onboarded successfully.'
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves pending documents queue for the authenticated notary user.
   */
  public static async getPendingQueue(req: Request, res: Response, next: NextFunction) {
    try {
      // Find all documents in ONCHAIN_CONFIRMED (waiting for notary signature)
      const documents = await prisma.document.findMany({
        where: {
          status: DbDocumentStatus.ONCHAIN_CONFIRMED
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      res.status(200).json({
        data: documents,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
