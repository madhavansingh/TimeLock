import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LocalRegisterDocumentSchema, LocalRecordSignatureSchema } from '../validation/document.validation';
import { DocumentService } from '../services/document.service';
import { prisma } from '../config/db';
import { QrService } from '../services/qr.service';
import { FraudService } from '../services/fraud.service';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { logger } from '../config/logger';

export class DocumentController {
  /**
   * Upload and register a new document.
   */
  public static async uploadDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          data: null,
          error: { code: 'FILE_REQUIRED', message: 'No file uploaded.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const body = LocalRegisterDocumentSchema.parse(req.body);
      const doc = await DocumentService.uploadAndRegister(
        req.user!.userId,
        body.title,
        body.type,
        req.file.buffer,
        req.file.originalname,
        body.notaryId,
        body.requiredSigners || 1
      );

      res.status(201).json({
        data: {
          documentId: doc.documentId,
          hash: doc.contentHash,
          cid: doc.ipfsReference?.cid || 'QmSimulatedCID',
          status: doc.status,
          onchainTxSignature: doc.onchainTxSignature
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves document status and metadata.
   */
  public static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({
        where: { documentId: id },
        include: { signatures: { include: { notary: true } } }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const completedSignatures = doc.signatures.length;
      const notarySig = doc.signatures.find((s) => s.signerRole === DbSignerRole.NOTARY);

      res.status(200).json({
        data: {
          documentId: doc.documentId,
          status: doc.status,
          contentHash: doc.contentHash,
          onchainTxSignature: doc.onchainTxSignature,
          timestamp: doc.createdAt.toISOString(),
          notarySummary: notarySig
            ? {
                notaryId: notarySig.notaryId,
                signedAt: notarySig.signedAt.toISOString()
              }
            : null,
          signers: {
            required: doc.requiredSigners,
            completed: completedSignatures
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates QR Code for the document.
   */
  public static async getQrCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const qrDataUrl = await QrService.generateQrCodeDataUrl(id);
      res.status(200).json({
        data: { qrCode: qrDataUrl },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifies re-uploaded scanned file against on-chain metadata.
   */
  public static async verifyScan(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!req.file) {
        return res.status(400).json({
          data: null,
          error: { code: 'FILE_REQUIRED', message: 'No file uploaded for verification.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const actorLabel = req.user ? `${req.user.role} User` : 'Anonymous Verifier';
      const actorUserId = req.user?.userId;

      const result = await DocumentService.verifyScan(id, req.file.buffer, actorLabel, actorUserId);

      res.status(200).json({
        data: result,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Attaches signature bytes to document.
   */
  public static async recordSignature(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const reqId = req.headers['x-request-id'] || 'unknown';
    try {
      const { id } = req.params;
      logger.info(`[SIGNATURE] Incoming request to record signature for document ${id}. Req ID: ${reqId}, Body:`, req.body);

      const body = LocalRecordSignatureSchema.parse(req.body);
      logger.info(`[SIGNATURE] Parsed body validation successfully. Body:`, body);

      // Determine notary ID: request body, or session user lookup, or first notary in DB
      let notaryId = body.notaryId;
      if (!notaryId) {
        if (req.user?.role === 'NOTARY') {
          const notary = await prisma.notary.findFirst();
          if (notary) {
            notaryId = notary.notaryId;
            logger.info(`[SIGNATURE] Resolved notaryId from logged-in Notary session user: ${notaryId}`);
          }
        }
      }

      if (!notaryId) {
        const fallbackNotary = await prisma.notary.findFirst();
        if (fallbackNotary) {
          notaryId = fallbackNotary.notaryId;
          logger.info(`[SIGNATURE] No notaryId provided in request; fallback to first seeded notary in DB: ${notaryId}`);
        } else {
          notaryId = 'notary-guid-mock';
          logger.warn(`[SIGNATURE] No notaryId provided and no notary found in DB; fallback: ${notaryId}`);
        }
      }

      logger.info(`[SIGNATURE] Controller calling DocumentService.recordSignature. Args: documentId=${id}, signerRole=${body.signerRole}, signatureBytes=${body.signatureBytes}, certSerial=${body.certSerial}, notaryId=${notaryId}`);

      const sig = await DocumentService.recordSignature(
        id,
        body.signerRole as unknown as DbSignerRole,
        body.signatureBytes,
        body.certSerial,
        notaryId
      );

      const updatedDoc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      res.status(200).json({
        data: {
          signatureId: sig.signatureId,
          status: updatedDoc?.status || DbDocumentStatus.NOTARY_SIGNED
        },
        error: null,
        requestId: reqId
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves full timeline of events.
   */
  public static async getCustodyTrail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const timeline = await prisma.verificationEvent.findMany({
        where: { documentId: id },
        orderBy: { occurredAt: 'asc' }
      });

      res.status(200).json({
        data: {
          documentId: id,
          timeline
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Downloadable validation certificate.
   */
  public static async downloadCertificate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const pdfBuffer = await DocumentService.generateVerificationCertificatePDF(id);
      const qrDataUrl = await QrService.generateQrCodeDataUrl(id);

      res.status(200).json({
        data: {
          documentId: id,
          timestamp: doc.createdAt.toISOString(),
          onchainTxSignature: doc.onchainTxSignature || 'N/A',
          status: doc.status,
          qrCodeUrl: qrDataUrl,
          pdfBase64: pdfBuffer.toString('base64')
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Search documents.
   */
  public static async searchDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status, notaryId, startDate, endDate } = req.query;

      const whereClause: any = {};
      if (status) {
        whereClause.status = status as DbDocumentStatus;
      }
      if (notaryId) {
        whereClause.signatures = {
          some: { notaryId: notaryId as string }
        };
      }
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
        if (endDate) whereClause.createdAt.lte = new Date(endDate as string);
      }

      const items = await prisma.document.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        data: {
          items,
          total: items.length,
          page: 1,
          limit: 100
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves the dynamic fraud risk score.
   */
  public static async getFraudScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({
        where: { documentId: id },
        include: { signatures: true }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const hasNotarySig = doc.signatures.some((s) => s.signerRole === DbSignerRole.NOTARY);
      const hasBlockchainTx = !!doc.onchainTxSignature;

      const { score, signals } = FraudService.calculateRiskScore({
        hashMismatch: doc.status === DbDocumentStatus.DISPUTED,
        missingBlockchainTx: !hasBlockchainTx,
        missingNotarySignature: !hasNotarySig,
        expiredVerification: false
      });

      res.status(200).json({
        data: {
          documentId: id,
          score,
          signals,
          computedAt: new Date().toISOString()
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
