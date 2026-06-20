import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LocalRegisterDocumentSchema, LocalRecordSignatureSchema } from '../validation/document.validation';
import { DocumentService } from '../services/document.service';
import { VplService } from '../services/vpl.service';
import { StorageService } from '../services/storage.service';
import { prisma } from '../config/db';
import { QrService } from '../services/qr.service';
import { FraudService } from '../services/fraud.service';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { logger } from '../config/logger';
import { AiAssessmentService } from '../services/ai/ai-assessment.service';

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
        body.requiredSigners || 1,
        body.surveyNumber,
        body.propertyId,
        body.registrationNumber,
        body.ownerName,
        body.paymentId
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
  public static async resolveViewProfile(doc: any, reqUser: any): Promise<'PUBLIC_VIEW' | 'OWNER_VIEW' | 'ASSIGNED_NOTARY_VIEW' | 'INSTITUTION_VIEW' | 'ADMIN_VIEW'> {
    if (!reqUser) {
      return 'PUBLIC_VIEW';
    }

    const { userId, role } = reqUser;

    // 1. Admin check
    if (role === 'ADMIN') {
      return 'ADMIN_VIEW';
    }

    // 2. Institution check (Bank Officer, Court Clerk)
    if (['BANK_OFFICER', 'COURT_CLERK'].includes(role)) {
      return 'INSTITUTION_VIEW';
    }

    // 3. Owner check
    if (role === 'CITIZEN' && doc.ownerUserId === userId) {
      return 'OWNER_VIEW';
    }

    // 4. Assigned Notary check
    if (role === 'NOTARY') {
      const userProfile = await prisma.user.findUnique({
        where: { userId },
        select: { notaryId: true }
      });
      if (userProfile?.notaryId && doc.assignedNotaryId === userProfile.notaryId) {
        return 'ASSIGNED_NOTARY_VIEW';
      }
    }

    return 'PUBLIC_VIEW';
  }

  public static async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({
        where: { documentId: id },
        include: {
          signatures: { include: { notary: true } },
          verificationEvents: { orderBy: { occurredAt: 'asc' } },
          ipfsReference: true,
          assignedNotary: true,
          verificationCase: { include: { evidence: true } },
          metadata: true,
          owner: true
        }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const ownershipRecords = await prisma.ownershipRecord.findMany({
        where: { documentId: id },
        orderBy: { startDate: 'asc' }
      });
      const latestTransfer = ownershipRecords.filter((r) => r.previousOwnerId !== null).pop();

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      const completedSignatures = doc.signatures.length;
      const notarySig = doc.signatures.find((s) => s.signerRole === DbSignerRole.NOTARY);

      const hasNotarySig = !!notarySig;
      const hasBlockchainTx = !!doc.onchainTxSignature;

      if (viewProfile === 'PUBLIC_VIEW') {
        return res.status(200).json({
          data: {
            documentId: doc.documentId,
            title: doc.title,
            type: doc.type,
            status: doc.status,
            contentHash: '[REDACTED]',
            onchainTxSignature: doc.onchainTxSignature,
            onchainPda: '[REDACTED]',
            timestamp: doc.createdAt.toISOString(),
            assignedNotary: doc.assignedNotary
              ? {
                  name: doc.assignedNotary.name,
                  certStatus: doc.assignedNotary.certStatus
                }
              : null,
            notarySummary: notarySig
              ? {
                  notaryId: notarySig.notaryId,
                  name: notarySig.notary.name,
                  dscCertificateSerial: notarySig.notary.dscCertificateSerial,
                  signedAt: notarySig.signedAt.toISOString()
                }
              : null,
            signers: {
              required: doc.requiredSigners,
              completed: completedSignatures
            },
            ipfsReference: null,
            verificationEvents: [],
            riskAnalysis: null,
            viewProfile,
            metadata: doc.metadata ? {
              surveyNumber: doc.metadata.surveyNumber,
              propertyId: doc.metadata.propertyId,
              registrationNumber: '[REDACTED]',
              ownerName: doc.metadata.ownerName
            } : null,
            verificationCase: doc.verificationCase ? {
              caseId: doc.verificationCase.caseId,
              status: doc.verificationCase.status,
              trustScore: doc.verificationCase.trustScore,
              vplProofHash: doc.verificationCase.vplProofHash,
              vplOnchainTx: doc.verificationCase.vplOnchainTx,
              evidenceCount: doc.verificationCase.evidence.length,
              checklist: (doc.verificationCase.checklist as any[]).map(item => ({ id: item.id, label: item.label, status: item.status }))
            } : null,
            ownershipSummary: {
              verifiedOwnerEmailHash: doc.owner.emailHash,
              historyCount: Math.max(0, ownershipRecords.length - 1),
              latestTransferDate: latestTransfer ? latestTransfer.startDate.toISOString() : null,
              transferStatus: doc.status === 'FULLY_EXECUTED' ? 'FINALIZED' : 'ACTIVE'
            }
          },
          error: null,
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const { score: riskScore, signals: riskSignals } = FraudService.calculateRiskScore({
        hashMismatch: doc.status === DbDocumentStatus.DISPUTED,
        missingBlockchainTx: !hasBlockchainTx,
        missingNotarySignature: !hasNotarySig,
        expiredVerification: false
      });

      res.status(200).json({
        data: {
          documentId: doc.documentId,
          title: doc.title,
          type: doc.type,
          status: doc.status,
          contentHash: doc.contentHash,
          onchainTxSignature: doc.onchainTxSignature,
          onchainPda: doc.onchainPda || undefined,
          timestamp: doc.createdAt.toISOString(),
          assignedNotary: doc.assignedNotary
            ? {
                notaryId: doc.assignedNotary.notaryId,
                name: doc.assignedNotary.name,
                dscCertificateSerial: doc.assignedNotary.dscCertificateSerial,
                certStatus: doc.assignedNotary.certStatus
              }
            : null,
          notarySummary: notarySig
            ? {
                notaryId: notarySig.notaryId,
                name: notarySig.notary.name,
                dscCertificateSerial: notarySig.notary.dscCertificateSerial,
                signedAt: notarySig.signedAt.toISOString()
              }
            : null,
          signers: {
            required: doc.requiredSigners,
            completed: completedSignatures
          },
          ipfsReference: doc.ipfsReference
            ? {
                cid: doc.ipfsReference.cid,
                keyReference: doc.ipfsReference.keyReference,
                uploadedAt: doc.ipfsReference.uploadedAt.toISOString()
              }
            : null,
          verificationEvents: doc.verificationEvents.map((e) => ({
            eventId: e.eventId,
            eventType: e.eventType,
            occurredAt: e.occurredAt.toISOString(),
            actorLabel: e.actorLabel,
            onchainTxRef: e.onchainTxRef || undefined
          })),
          riskAnalysis: {
            score: riskScore,
            signals: riskSignals
          },
          viewProfile,
          metadata: doc.metadata,
          verificationCase: doc.verificationCase,
          ownershipSummary: {
            verifiedOwnerEmailHash: doc.owner.emailHash,
            historyCount: Math.max(0, ownershipRecords.length - 1),
            latestTransferDate: latestTransfer ? latestTransfer.startDate.toISOString() : null,
            transferStatus: doc.status === 'FULLY_EXECUTED' ? 'FINALIZED' : 'ACTIVE'
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
      const doc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      if (viewProfile === 'PUBLIC_VIEW') {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'Access denied. You do not have permission to retrieve this QR code.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

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

      const doc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const actorLabel = req.user ? `${req.user.role} User` : 'Anonymous Verifier';
      const actorUserId = req.user?.userId;

      const result = await DocumentService.verifyScan(id, req.file.buffer, actorLabel, actorUserId);

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      if (viewProfile === 'PUBLIC_VIEW') {
        result.expectedHash = '[REDACTED]';
      }

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

      // Enforce citizen ownership check
      if (req.user?.role === 'CITIZEN') {
        const doc = await prisma.document.findUnique({
          where: { documentId: id }
        });
        if (!doc) {
          return res.status(404).json({
            data: null,
            error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
            requestId: reqId
          });
        }
        if (doc.ownerUserId !== req.user.userId) {
          return res.status(403).json({
            data: null,
            error: { code: 'FORBIDDEN', message: 'You do not own this document.' },
            requestId: reqId
          });
        }
      }

      // Determine notary ID: request body, or session user lookup, or first notary in DB
      let notaryId = body.notaryId;
      if (req.user?.role === 'NOTARY') {
        const userWithNotary = await prisma.user.findUnique({
          where: { userId: req.user.userId },
          include: { notary: true }
        });
        if (!userWithNotary || !userWithNotary.notaryId) {
          return res.status(403).json({
            data: null,
            error: {
              code: 'NOTARY_PROFILE_NOT_FOUND',
              message: 'No notary profile associated with this user.'
            },
            requestId: reqId
          });
        }
        notaryId = userWithNotary.notaryId;
        logger.info(`[SIGNATURE] Resolved notaryId from logged-in Notary session user: ${notaryId}`);
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
      const doc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document registry not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      if (viewProfile === 'PUBLIC_VIEW') {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'Access denied. You do not have permission to view internal custody trail.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const timeline = await prisma.verificationEvent.findMany({
        where: { documentId: id },
        orderBy: { occurredAt: 'asc' }
      });

      res.status(200).json({
        data: {
          documentId: id,
          timeline,
          viewProfile
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

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      const pdfBuffer = await DocumentService.generateVerificationCertificatePDF(id, viewProfile);
      const qrDataUrl = await QrService.generateQrCodeDataUrl(id);

      // Record verification event for certificate download
      await prisma.verificationEvent.create({
        data: {
          documentId: id,
          eventType: 'CERTIFICATE_DOWNLOADED',
          actorUserId: req.user?.userId || null,
          actorLabel: req.user ? `${req.user.role} User` : 'Anonymous Viewer',
          onchainTxRef: doc.onchainTxSignature || null
        }
      });

      if (req.query.download === 'true' || req.headers.accept?.includes('application/pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.title.replace(/\s+/g, '_')}_verification_certificate.pdf"`);
        return res.send(pdfBuffer);
      }

      res.status(200).json({
        data: {
          documentId: id,
          timestamp: doc.createdAt.toISOString(),
          onchainTxSignature: doc.onchainTxSignature || 'N/A',
          status: doc.status,
          qrCodeUrl: qrDataUrl,
          pdfBase64: pdfBuffer.toString('base64'),
          viewProfile
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

  /**
   * Fetch all documents registered by the currently authenticated citizen user.
   */
  public static async getMyDocuments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'User context not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const userId = req.user.userId;
      const docs = await DocumentService.fetchMyDocuments(userId);

      const mapped = docs.map((doc) => ({
        id: doc.documentId,
        documentId: doc.documentId,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        hash: doc.contentHash,
        contentHash: doc.contentHash,
        transactionSignature: doc.onchainTxSignature || undefined,
        onchainTxSignature: doc.onchainTxSignature || undefined,
        qrCodeUrl: `/v1/documents/${doc.documentId}/qr`,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.createdAt.toISOString()
      }));

      res.status(200).json({
        data: mapped,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Records that a notary has started reviewing a document.
   */
  public static async startReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notaryUser = await prisma.user.findUnique({
        where: { userId: req.user!.userId },
        include: { notary: true }
      });

      if (!notaryUser || !notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'Notary profile not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

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

      if (doc.assignedNotaryId !== notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'This document is assigned to another notary.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Check if event already exists
      const existingEvent = await prisma.verificationEvent.findFirst({
        where: {
          documentId: id,
          eventType: 'NOTARY_REVIEW_STARTED'
        }
      });

      if (!existingEvent) {
        await prisma.verificationEvent.create({
          data: {
            documentId: id,
            eventType: 'NOTARY_REVIEW_STARTED',
            actorUserId: req.user!.userId,
            actorLabel: `Notary: ${notaryUser.notary?.name || 'Advocate'}`
          }
        });
      }

      await prisma.document.update({
        where: { documentId: id },
        data: { status: DbDocumentStatus.NOTARY_REVIEW_STARTED }
      });

      res.status(200).json({
        data: { message: 'Review started.' },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload supporting evidence file, store in IPFS and link to the case.
   */
  public static async uploadEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { title } = req.body;
      if (!req.file) {
        return res.status(400).json({
          data: null,
          error: { code: 'FILE_REQUIRED', message: 'Evidence file copy is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }
      if (!title) {
        return res.status(400).json({
          data: null,
          error: { code: 'TITLE_REQUIRED', message: 'Evidence document title type is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // 1. Upload to IPFS
      const { cid } = await StorageService.uploadDocument(req.file.buffer, req.file.originalname);

      // 2. Add to case evidence list and resolve missing evidence challenges
      const evidence = await VplService.addEvidence(id, title, cid);

      res.status(201).json({
        data: evidence,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resolves a challenge question with a notary justification string.
   */
  public static async resolveChallenge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { challengeId, justification } = req.body;
      if (!challengeId || !justification) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'challengeId and justification are required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const updatedCase = await VplService.resolveChallenge(id, challengeId, justification);

      res.status(200).json({
        data: updatedCase,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Updates case checklist state.
   */
  public static async updateChecklist(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { checklist } = req.body;
      if (!checklist || !Array.isArray(checklist)) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'checklist array is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const updatedCase = await VplService.updateChecklist(id, checklist);

      res.status(200).json({
        data: updatedCase,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Finalizes case verification checklist, hashes the Proof Record, and anchors to Solana.
   */
  public static async anchorVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updatedCase = await VplService.anchorVerificationProof(id, req.user!.userId);

      res.status(200).json({
        data: {
          caseId: updatedCase.caseId,
          status: updatedCase.status,
          trustScore: updatedCase.trustScore,
          vplProofHash: updatedCase.vplProofHash,
          vplOnchainTx: updatedCase.vplOnchainTx
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Transition document status to READY_FOR_SIGNATURE (Awaiting Signature)
   */
  public static async approveForSignature(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const notaryUser = await prisma.user.findUnique({
        where: { userId: req.user!.userId },
        include: { notary: true }
      });

      if (!notaryUser || !notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'Notary profile not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

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

      if (doc.assignedNotaryId !== notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'This document is assigned to another notary.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      await prisma.document.update({
        where: { documentId: id },
        data: { status: DbDocumentStatus.READY_FOR_SIGNATURE }
      });

      await prisma.verificationEvent.create({
        data: {
          documentId: id,
          eventType: 'READY_FOR_SIGNATURE',
          actorUserId: req.user!.userId,
          actorLabel: `Notary: ${notaryUser.notary?.name || 'Advocate'}`
        }
      });

      res.status(200).json({
        data: { message: 'Document approved for signature.' },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request additional evidence document, adding a MISSING_EVIDENCE challenge to case.
   */
  public static async requestAdditionalEvidence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'Evidence title is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const notaryUser = await prisma.user.findUnique({
        where: { userId: req.user!.userId },
        include: { notary: true }
      });

      if (!notaryUser || !notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'Notary profile not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

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

      if (doc.assignedNotaryId !== notaryUser.notaryId) {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'This document is assigned to another notary.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const updatedCase = await VplService.addEvidenceRequest(id, title);

      await prisma.evidenceRecommendation.updateMany({
        where: { documentId: id, recommendedDoc: title },
        data: { requested: true }
      });

      await prisma.verificationEvent.create({
        data: {
          documentId: id,
          eventType: 'EVIDENCE_REQUESTED',
          actorUserId: req.user!.userId,
          actorLabel: `Evidence Requested: ${title}`
        }
      });

      res.status(200).json({
        data: updatedCase,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves AI verification insights (advisory).
   */
  public static async getAiInsights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

      // Check access permission (owner, notary, institution, admin)
      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      if (viewProfile === 'PUBLIC_VIEW') {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to view AI insights for this document.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      let assessment = await prisma.aiAssessment.findUnique({
        where: { documentId: id }
      });

      if (!assessment) {
        // Trigger first-time generation synchronously to populate the data
        logger.info(`[DocumentController] AI Assessment not found for ${id}. Generating...`);
        await AiAssessmentService.runAnalysis(id, 'INITIAL_TRIGGER');
        assessment = await prisma.aiAssessment.findUnique({
          where: { documentId: id }
        });
      }

      const recommendations = await prisma.evidenceRecommendation.findMany({
        where: { documentId: id }
      });

      res.status(200).json({
        data: {
          ...assessment,
          evidenceRecommendations: recommendations
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually regenerates AI verification insights.
   */
  public static async regenerateAiInsights(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

      const viewProfile = await DocumentController.resolveViewProfile(doc, req.user);
      if (viewProfile === 'PUBLIC_VIEW') {
        return res.status(403).json({
          data: null,
          error: { code: 'FORBIDDEN', message: 'You are not authorized to regenerate AI insights for this document.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      logger.info(`[DocumentController] Manual AI Assessment regeneration requested for ${id}`);
      await AiAssessmentService.runAnalysis(id, 'MANUAL');

      const assessment = await prisma.aiAssessment.findUnique({
        where: { documentId: id }
      });

      const recommendations = await prisma.evidenceRecommendation.findMany({
        where: { documentId: id }
      });

      res.status(200).json({
        data: {
          ...assessment,
          evidenceRecommendations: recommendations
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
