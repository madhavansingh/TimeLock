import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { DocumentController } from './document.controller';
import { VerificationCopilotService } from '../services/ai/verification-copilot.service';
import { EvidenceRecommendationAgentService } from '../services/ai/evidence-recommendation-agent.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class CopilotController {
  private static async getDocumentAndAuthorize(req: AuthenticatedRequest, res: Response): Promise<any | null> {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({
      where: { documentId: id }
    });

    if (!doc) {
      res.status(404).json({
        data: null,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' },
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return null;
    }

    const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
    if (viewProfile === 'PUBLIC_VIEW') {
      res.status(403).json({
        data: null,
        error: { code: 'FORBIDDEN', message: 'You are not authorized to access AI Copilot analytics for this document.' },
        requestId: req.headers['x-request-id'] || 'unknown'
      });
      return null;
    }

    return doc;
  }

  private static async ensureCopilotExecuted(documentId: string) {
    const check = await prisma.aiConflictAssessment.findUnique({
      where: { documentId }
    });
    if (!check) {
      logger.info(`[CopilotController] AI Copilot records missing for ${documentId}. Triggering lazy execution...`);
      await VerificationCopilotService.runCopilot(documentId, 'LAZY_INITIALIZATION');
    }

    const checkEvidence = await prisma.evidenceRecommendation.findFirst({
      where: { documentId }
    });
    if (!checkEvidence) {
      logger.info(`[CopilotController] AI Evidence Recommendation records missing for ${documentId}. Triggering execution...`);
      try {
        await EvidenceRecommendationAgentService.runAnalysis(documentId);
      } catch (err: any) {
        logger.warn(`[CopilotController] EvidenceRecommendationAgent failed: ${err.message}`);
      }
    }
  }

  public static async getConflict(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      await CopilotController.ensureCopilotExecuted(doc.documentId);
      const data = await prisma.aiConflictAssessment.findUnique({
        where: { documentId: doc.documentId }
      });

      res.status(200).json({
        data,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPrediction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      await CopilotController.ensureCopilotExecuted(doc.documentId);
      const data = await prisma.aiApprovalPrediction.findUnique({
        where: { documentId: doc.documentId }
      });

      res.status(200).json({
        data,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      await CopilotController.ensureCopilotExecuted(doc.documentId);
      const data = await prisma.aiCrossExamination.findUnique({
        where: { documentId: doc.documentId }
      });

      res.status(200).json({
        data,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getRecommendation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      await CopilotController.ensureCopilotExecuted(doc.documentId);
      const data = await prisma.aiDecisionRecommendation.findUnique({
        where: { documentId: doc.documentId }
      });

      res.status(200).json({
        data,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getCopilot(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      await CopilotController.ensureCopilotExecuted(doc.documentId);
      const [conflict, prediction, questions, recommendation, evidenceRecommendations] = await Promise.all([
        prisma.aiConflictAssessment.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiApprovalPrediction.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiCrossExamination.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiDecisionRecommendation.findUnique({ where: { documentId: doc.documentId } }),
        prisma.evidenceRecommendation.findMany({ where: { documentId: doc.documentId } })
      ]);

      res.status(200).json({
        data: {
          conflict,
          prediction,
          questions,
          recommendation,
          evidenceRecommendations
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  public static async regenerate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const doc = await CopilotController.getDocumentAndAuthorize(req, res);
      if (!doc) return;

      logger.info(`[CopilotController] Manual copilot regeneration requested for document ${doc.documentId}`);
      await VerificationCopilotService.runCopilot(doc.documentId, 'MANUAL_REGENERATION');
      try {
        await EvidenceRecommendationAgentService.runAnalysis(doc.documentId);
      } catch (err: any) {
        logger.warn(`[CopilotController] Manual EvidenceRecommendationAgent failed: ${err.message}`);
      }

      const [conflict, prediction, questions, recommendation, evidenceRecommendations] = await Promise.all([
        prisma.aiConflictAssessment.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiApprovalPrediction.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiCrossExamination.findUnique({ where: { documentId: doc.documentId } }),
        prisma.aiDecisionRecommendation.findUnique({ where: { documentId: doc.documentId } }),
        prisma.evidenceRecommendation.findMany({ where: { documentId: doc.documentId } })
      ]);

      res.status(200).json({
        data: {
          conflict,
          prediction,
          questions,
          recommendation,
          evidenceRecommendations
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
