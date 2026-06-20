import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { DocumentService } from '../services/document.service';
import { AiAssessmentService } from '../services/ai/ai-assessment.service';
import { VerificationCopilotService } from '../services/ai/verification-copilot.service';
import { VplService } from '../services/vpl.service';
import { TransferService } from '../services/transfer.service';
import { VerificationCommandCenterService } from '../services/ai/verification-command-center.service';
import { AuditLogService } from '../services/audit-log.service';
import { DbDocumentStatus, DbSignerRole, DbUserRole } from '@prisma/client';
import crypto from 'crypto';

export class JudgeController {
  /**
   * Resets and seeds the database for the Judge Guided Demo.
   */
  public static async demoSetup(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('[JUDGE DEMO] Starting database reset and seed...');

      // 1. Transactionally clean all transactional tables to prevent foreign key errors
      await prisma.$transaction([
        prisma.auditLog.deleteMany(),
        prisma.networkAnomalyHistory.deleteMany(),
        prisma.networkAnomaly.deleteMany(),
        prisma.chainIntegrityAssessmentHistory.deleteMany(),
        prisma.chainIntegrityAssessment.deleteMany(),
        prisma.nationalTrustRatingHistory.deleteMany(),
        prisma.nationalTrustRating.deleteMany(),
        prisma.entityRiskAssessmentHistory.deleteMany(),
        prisma.entityRiskAssessment.deleteMany(),
        prisma.trustGraphEdgeHistory.deleteMany(),
        prisma.trustGraphEdge.deleteMany(),
        prisma.trustGraphNodeHistory.deleteMany(),
        prisma.trustGraphNode.deleteMany(),
        prisma.aiAssessmentHistory.deleteMany(),
        prisma.aiAssessment.deleteMany(),
        prisma.aiConflictAssessmentHistory.deleteMany(),
        prisma.aiConflictAssessment.deleteMany(),
        prisma.aiApprovalPredictionHistory.deleteMany(),
        prisma.aiApprovalPrediction.deleteMany(),
        prisma.aiCrossExaminationHistory.deleteMany(),
        prisma.aiCrossExamination.deleteMany(),
        prisma.aiDecisionRecommendationHistory.deleteMany(),
        prisma.aiDecisionRecommendation.deleteMany(),
        prisma.signature.deleteMany(),
        prisma.ownershipRecord.deleteMany(),
        prisma.ownershipTransfer.deleteMany(),
        prisma.evidence.deleteMany(),
        prisma.verificationCase.deleteMany(),
        prisma.documentMetadata.deleteMany(),
        prisma.ipfsReference.deleteMany(),
        prisma.verificationEvent.deleteMany(),
        prisma.document.deleteMany()
      ]);

      // 2. Clear out demo users if they exist, and recreate them
      const emailSeller = 'demo_seller@ltn.demo';
      const emailBuyer = 'demo_buyer@ltn.demo';
      const emailNotary = 'demo_notary@ltn.demo';
      const emailGovt = 'demo_govt@ltn.demo';

      await prisma.user.deleteMany({
        where: { emailHash: { in: [emailSeller, emailBuyer, emailNotary, emailGovt] } }
      });

      // Create Notary profile
      const notaryId = 'notary-demo-id-999';
      await prisma.notary.deleteMany({ where: { notaryId } });
      const notaryProfile = await prisma.notary.create({
        data: {
          notaryId,
          name: 'Advocate Vikram Malhotra',
          dscCertificateSerial: 'DSC-8899-7711-XX',
          publicKey: Buffer.from(crypto.randomBytes(32)).toString('base64'),
          certStatus: 'active',
          isAccredited: true
        }
      });

      // Recreate users
      const seller = await prisma.user.create({
        data: {
          role: DbUserRole.CITIZEN,
          phoneHash: '1111111111',
          emailHash: emailSeller
        }
      });

      const buyer = await prisma.user.create({
        data: {
          role: DbUserRole.CITIZEN,
          phoneHash: '2222222222',
          emailHash: emailBuyer
        }
      });

      const notaryUser = await prisma.user.create({
        data: {
          role: DbUserRole.NOTARY,
          phoneHash: '3333333333',
          emailHash: emailNotary,
          notaryId: notaryProfile.notaryId
        }
      });

      const govt = await prisma.user.create({
        data: {
          role: DbUserRole.ADMIN,
          phoneHash: '4444444444',
          emailHash: emailGovt
        }
      });

      await AuditLogService.log({
        action: 'TRUST_GRAPH_UPDATE',
        message: 'Database reset and demo environment initialized successfully.',
        actorId: govt.userId,
        actorRole: 'ADMIN'
      });

      res.status(200).json({
        data: {
          message: 'Database reset and seeded with demo entities successfully.',
          users: {
            seller: seller.userId,
            buyer: buyer.userId,
            notary: notaryUser.userId,
            notaryId: notaryProfile.notaryId,
            govt: govt.userId
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
   * Executes steps of the Guided Demo Flow on behalf of seeded accounts.
   */
  public static async executeStep(req: Request, res: Response, next: NextFunction) {
    try {
      const step = parseInt(req.body.step as string, 10);
      const { sellerId, buyerId, notaryId, govtId, documentId, propertyId, surveyNumber, transferId } = req.body;

      if (!step || step < 1 || step > 11) {
        return res.status(400).json({
          data: null,
          error: { code: 'INVALID_STEP', message: 'Step must be a number between 1 and 11.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      logger.info(`[JUDGE DEMO] Executing Step ${step}...`);

      switch (step) {
        case 1: {
          // Step 1: Citizen uploads deed
          const uniqueId = Date.now();
          const propId = propertyId || `PROP-${uniqueId}`;
          const svNum = surveyNumber || `SURVEY-${uniqueId}`;
          const regNum = `REG-${uniqueId}`;

          const doc = await DocumentService.uploadAndRegister(
            sellerId,
            `Registry Deed Plot ${uniqueId}`,
            'Sale Deed',
            Buffer.from(`plot registry details for survey ${svNum}`),
            `deed_${uniqueId}.pdf`,
            notaryId,
            1,
            svNum,
            propId,
            regNum,
            'Sellers Group'
          );

          // Seed an active ownership record
          await prisma.ownershipRecord.create({
            data: {
              documentId: doc.documentId,
              ownerUserId: sellerId,
              startDate: new Date(),
              status: 'ACTIVE',
              transferReason: 'Initial Registration'
            }
          });

          await AuditLogService.log({
            action: 'DOCUMENT_REGISTRATION',
            message: `Document ${doc.documentId} registered under property ${propId}.`,
            actorId: sellerId,
            actorRole: 'CITIZEN',
            entityType: 'DOCUMENT',
            entityId: doc.documentId
          });

          return res.status(200).json({
            data: {
              step: 1,
              documentId: doc.documentId,
              propertyId: propId,
              surveyNumber: svNum,
              status: doc.status,
              txSignature: doc.onchainTxSignature
            },
            error: null
          });
        }

        case 2: {
          // Step 2: AI analyzes deed (Nemotron)
          await AiAssessmentService.runAnalysis(documentId, 'INITIAL_TRIGGER');
          const assessment = await prisma.aiAssessment.findUnique({
            where: { documentId }
          });

          await AuditLogService.log({
            action: 'AI_ANALYSIS',
            message: `AI Assessment generated for document ${documentId}.`,
            entityType: 'DOCUMENT',
            entityId: documentId
          });

          return res.status(200).json({
            data: { step: 2, assessment },
            error: null
          });
        }

        case 3: {
          // Step 3: Conflict Investigator runs (Copilot)
          await VerificationCopilotService.runCopilot(documentId, 'INITIAL_TRIGGER');
          const conflict = await prisma.aiConflictAssessment.findUnique({ where: { documentId } });
          const prediction = await prisma.aiApprovalPrediction.findUnique({ where: { documentId } });
          const questions = await prisma.aiCrossExamination.findUnique({ where: { documentId } });
          const recommendation = await prisma.aiDecisionRecommendation.findUnique({ where: { documentId } });

          await AuditLogService.log({
            action: 'AI_ANALYSIS',
            message: `Copilot sequential reasoning completed for document ${documentId}.`,
            entityType: 'DOCUMENT',
            entityId: documentId
          });

          return res.status(200).json({
            data: { step: 3, conflict, prediction, questions, recommendation },
            error: null
          });
        }

        case 4: {
          // Step 4: Notary starts review
          const updatedDoc = await prisma.document.update({
            where: { documentId },
            data: { status: DbDocumentStatus.NOTARY_REVIEW_STARTED }
          });
          return res.status(200).json({
            data: { step: 4, documentId, status: updatedDoc.status },
            error: null
          });
        }

        case 5: {
          // Step 5: Notary resolves missing evidence challenges and checklist ticks
          const caseRec = await prisma.verificationCase.findUnique({
            where: { documentId }
          });
          if (!caseRec) throw new Error('VerificationCase not found.');

          // 1. Upload mandatory evidence files (simulated)
          await VplService.addEvidence(documentId, 'Identity Proof', 'QmIdentityProofMockCID123456');
          await VplService.addEvidence(documentId, 'Prior Title Deed', 'QmPriorDeedMockCID123456');
          await VplService.addEvidence(documentId, 'Tax Receipt', 'QmTaxReceiptMockCID123456');

          // 2. Resolve conflict challenges if any
          const challenges = caseRec.challenges as any[];
          for (const ch of challenges) {
            if (!ch.resolved) {
              await VplService.resolveChallenge(documentId, ch.id, 'Metadata verified with local survey office records.');
            }
          }

          // 3. Tick checklist items as PASSED
          const checklist = caseRec.checklist as any[];
          const updatedChecklist = checklist.map(item => ({ ...item, status: 'PASSED' as const }));
          await VplService.updateChecklist(documentId, updatedChecklist);

          const finalCase = await prisma.verificationCase.findUnique({
            where: { documentId },
            include: { evidence: true }
          });

          await AuditLogService.log({
            action: 'NOTARY_REVIEW',
            message: `Notary resolved all challenges and completed checklist for document ${documentId}.`,
            actorId: notaryId,
            actorRole: 'NOTARY',
            entityType: 'DOCUMENT',
            entityId: documentId
          });

          return res.status(200).json({
            data: { step: 5, case: finalCase },
            error: null
          });
        }

        case 6: {
          // Step 6 & 7: VPL generated & Solana anchored
          const notaryUser = await prisma.user.findFirst({
            where: { notaryId }
          });
          if (!notaryUser) throw new Error('Notary user profile not found.');

          // Anchor VPL proof hash to Solana Devnet RPC
          const anchoredCase = await VplService.anchorVerificationProof(documentId, notaryUser.userId);

          await AuditLogService.log({
            action: 'SIGNATURE',
            message: `VPL Proof hash anchored on Solana Devnet for document ${documentId}.`,
            actorId: notaryUser.userId,
            actorRole: 'NOTARY',
            entityType: 'DOCUMENT',
            entityId: documentId,
            metadata: { tx: anchoredCase.vplOnchainTx }
          });

          return res.status(200).json({
            data: {
              step: 6,
              status: 'VERIFIED',
              vplProofHash: anchoredCase.vplProofHash,
              blockchainTx: anchoredCase.vplOnchainTx
            },
            error: null
          });
        }

        case 7: {
          // Step 8: Verification Portal validates
          const doc = await prisma.document.findUnique({
            where: { documentId },
            include: {
              signatures: { include: { notary: true } },
              verificationEvents: { orderBy: { occurredAt: 'asc' } },
              assignedNotary: true,
              verificationCase: { include: { evidence: true } },
              metadata: true,
              owner: true
            }
          });

          return res.status(200).json({
            data: { step: 7, doc },
            error: null
          });
        }

        case 8: {
          // Step 9: Ownership transfer initiated
          const sellerUser = await prisma.user.findUnique({ where: { userId: sellerId } });
          const buyerUser = await prisma.user.findUnique({ where: { userId: buyerId } });
          if (!sellerUser || !buyerUser) throw new Error('Seller or Buyer user not found.');

          const transfer = await TransferService.initiateTransfer(
            sellerId,
            documentId,
            buyerId,
            'Sale',
            'Sovereign deed purchase demo',
            [{ title: 'Sale Agreement', ipfsCid: 'QmSaleAgreementMockCID998877' }]
          );

          await AuditLogService.log({
            action: 'OWNERSHIP_TRANSFER',
            message: `Ownership transfer ${transfer.transferId} initiated for document ${documentId}.`,
            actorId: sellerId,
            actorRole: 'CITIZEN',
            entityType: 'TRANSFER',
            entityId: transfer.transferId
          });

          return res.status(200).json({
            data: { step: 8, transfer },
            error: null
          });
        }

        case 9: {
          // Step 9 Approval: Seller, Buyer, Notary approve
          const sellerUser = await prisma.user.findUnique({ where: { userId: sellerId } });
          const buyerUser = await prisma.user.findUnique({ where: { userId: buyerId } });
          const notaryUser = await prisma.user.findFirst({ where: { notaryId } });

          // Record signatures
          await TransferService.approveTransfer(sellerUser!.userId, transferId, 'OWNER', '5h3K1111111111111111111111111111111111111111', 'mock_seller_sig_bytes');
          await TransferService.approveTransfer(buyerUser!.userId, transferId, 'BUYER', '5h3K1111111111111111111111111111111111111112', 'mock_buyer_sig_bytes');
          await TransferService.approveTransfer(notaryUser!.userId, transferId, 'NOTARY', '5h3K1111111111111111111111111111111111111113', 'mock_notary_sig_bytes');

          const updatedTransfer = await prisma.ownershipTransfer.findUnique({
            where: { transferId }
          });

          return res.status(200).json({
            data: { step: 9, transfer: updatedTransfer },
            error: null
          });
        }

        case 10: {
          // Step 10: Finalize transfer as Government Officer
          const finalizedTransfer = await TransferService.finalizeTransfer(govtId, transferId);

          await AuditLogService.log({
            action: 'OWNERSHIP_TRANSFER',
            message: `Deed ${documentId} ownership transferred to buyer ${buyerId}.`,
            actorId: govtId,
            actorRole: 'ADMIN',
            entityType: 'TRANSFER',
            entityId: transferId,
            metadata: { tx: finalizedTransfer.blockchainTxSig }
          });

          return res.status(200).json({
            data: {
              step: 10,
              status: finalizedTransfer.status,
              blockchainTx: finalizedTransfer.blockchainTxSig
            },
            error: null
          });
        }

        case 11: {
          // Step 11: Rebuild Trust Graph & Recalculate National Rating
          const graphResult = await VerificationCommandCenterService.orchestrate(propertyId);

          await AuditLogService.log({
            action: 'TRUST_GRAPH_UPDATE',
            message: `National trust graph compiled and ratings updated for property ${propertyId}.`,
            entityType: 'PROPERTY',
            entityId: propertyId
          });

          return res.status(200).json({
            data: { step: 11, result: graphResult },
            error: null
          });
        }
      }
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Fetches all registry cases for the Judge review experience.
   */
  public static async getCases(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await prisma.document.findMany({
        include: {
          verificationCase: {
            include: { evidence: true }
          },
          metadata: true,
          verificationEvents: {
            orderBy: { occurredAt: 'desc' }
          },
          signatures: {
            include: {
              notary: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        data: items,
        error: null
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Submits a Judge review decision (APPROVE, REVIEW, ESCALATE, REJECT) with rationale.
   */
  public static async submitReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { decision, rationale, judgeId } = req.body;

      if (!decision || !['APPROVE', 'REVIEW', 'ESCALATE', 'REJECT'].includes(decision)) {
        return res.status(400).json({
          data: null,
          error: { code: 'INVALID_DECISION', message: 'Decision must be one of APPROVE, REVIEW, ESCALATE, REJECT.' }
        });
      }

      logger.info(`[JudgeController] Judge review decision submitted for document ${id}: ${decision}`);

      let newStatus: DbDocumentStatus | undefined;
      if (decision === 'APPROVE') {
        newStatus = DbDocumentStatus.FULLY_EXECUTED;
      } else if (decision === 'REJECT') {
        newStatus = DbDocumentStatus.DISPUTED;
      }

      const updateData: any = {};
      if (newStatus) {
        updateData.status = newStatus;
      }

      const doc = await prisma.document.findUnique({
        where: { documentId: id }
      });

      if (!doc) {
        return res.status(404).json({
          data: null,
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
        });
      }

      const updatedDoc = await prisma.document.update({
        where: { documentId: id },
        data: updateData,
        include: {
          verificationCase: true
        }
      });

      await AuditLogService.log({
        action: 'JUDGE_REVIEW',
        message: `Judge decision submitted: ${decision}. Rationale: ${rationale || 'None provided'}`,
        actorId: judgeId || 'system-judge',
        actorRole: 'COURT_CLERK',
        entityType: 'DOCUMENT',
        entityId: id,
        metadata: {
          decision,
          rationale,
          previousStatus: doc.status,
          newStatus: updatedDoc.status
        }
      });

      await prisma.verificationEvent.create({
        data: {
          documentId: id,
          eventType: `JUDGE_${decision}`,
          actorLabel: 'Presiding Judge'
        }
      });

      res.status(200).json({
        data: {
          documentId: id,
          status: updatedDoc.status,
          decision
        },
        error: null
      });
    } catch (err) {
      next(err);
    }
  }
}

