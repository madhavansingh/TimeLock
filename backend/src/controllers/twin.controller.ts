import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AutonomousVerificationEngine } from '../services/ai/ave.service';
import { logger } from '../config/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
    email: string;
  };
}

export class TwinController {
  /**
   * Retrieves the active Digital Twin and Verification Passport for a document.
   */
  public static async getActiveTwin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      // Check if document exists
      const docExists = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!docExists) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      let twin = await prisma.digitalTwin.findUnique({
        where: { documentId: id }
      });

      // If no twin exists yet (e.g. legacy document), generate one on-the-fly!
      if (!twin) {
        logger.info(`[TwinController] Active twin not found for legacy document ${id}. Creating on-the-fly...`);
        try {
          twin = await AutonomousVerificationEngine.recalculate(id, 'SYSTEM_MIGRATION');
        } catch (err: any) {
          logger.error(`[TwinController] Failed to generate legacy twin on-the-fly: ${err.message}`);
        }
      }

      res.status(200).json({
        data: twin,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves the version history list of the Digital Twin.
   */
  public static async getTwinHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const history = await prisma.digitalTwinHistory.findMany({
        where: { documentId: id },
        orderBy: { version: 'desc' }
      });

      res.status(200).json({
        data: history,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually triggers a recalculation run of the Digital Twin.
   */
  public static async recalculateTwin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const docExists = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!docExists) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const twin = await AutonomousVerificationEngine.recalculate(id, 'MANUAL_RECALCULATION');

      res.status(200).json({
        data: twin,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Exposes global AVE operational observability metrics.
   */
  public static async getGlobalMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // Expose metrics for notary and admins
      const metrics = await AutonomousVerificationEngine.getGlobalMetrics();

      res.status(200).json({
        data: metrics,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
