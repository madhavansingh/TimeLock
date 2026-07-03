import { prisma } from '../config/db';
import { BlockchainService } from './blockchain.service';
import { AppError } from '../config/errors';
import { DbDocumentStatus } from '@prisma/client';
import { AiAssessmentService } from './ai/ai-assessment.service';
import { VerificationCopilotService } from './ai/verification-copilot.service';
import { WorkflowOrchestrator, WorkflowStep } from './integration/workflow-orchestrator';
import { EnterpriseServiceMeshService } from './integration/esm.service';
import { logger } from '../config/logger';

export class TransferService {
  /**
   * Builds the Saga steps for the orchestrated ownership transfer workflow.
   */
  private static buildTransferSagaSteps(context: any): WorkflowStep[] {
    return [
      {
        name: 'IDENTITY_CHECK',
        action: async (ctx) => {
          const seller = await prisma.user.findUnique({ where: { userId: ctx.sellerId } });
          const buyer = await prisma.user.findUnique({ where: { userId: ctx.buyerId } });
          if (!seller || !buyer) {
            throw new Error('Federated Identity Check Failed: Seller or Buyer local profile not found.');
          }
          return { sellerName: seller.name, buyerName: buyer.name };
        }
      },
      {
        name: 'REGISTRY_VERIFICATION',
        action: async (ctx) => {
          // Query Government Land Registry connector through ESM
          const extProp = await EnterpriseServiceMeshService.execute(
            'GOVERNMENT_REGISTRY',
            'verifyProperty',
            { propertyId: ctx.documentId },
            { correlationId: ctx.correlationId }
          );
          if (!extProp?.data?.isValid) {
            throw new Error('Inter-Registry Interoperability: Property deed is invalid or disputed in Government Land Registry.');
          }
          return { registryStatus: extProp.data.registryStatus };
        }
      },
      {
        name: 'ESCROW_CLEARING',
        action: async (ctx) => {
          // Clear bank escrow payment through ESM
          const bankEscrow = await EnterpriseServiceMeshService.execute(
            'BANKING_PLATFORM',
            'clearPayment',
            { paymentId: 'pay-transfer-' + ctx.documentId, amount: 1000 },
            { correlationId: ctx.correlationId }
          );
          if (!bankEscrow?.data?.success) {
            throw new Error('Banking Interoperability: Escrow payment clearing failed.');
          }
          return { bankReference: bankEscrow.data.reference };
        },
        compensation: async (ctx) => {
          // Saga Rollback: Refund escrow payment on step failure
          await EnterpriseServiceMeshService.execute(
            'BANKING_PLATFORM',
            'initiateEscrowRefund',
            { paymentId: 'pay-transfer-' + ctx.documentId },
            { correlationId: ctx.correlationId }
          );
          logger.warn(`[SagaRollback] Refunded banking escrow for doc "${ctx.documentId}" due to workflow failure.`);
        }
      },
      {
        name: 'SOLANA_INITIATE',
        action: async (ctx) => {
          const onchainTransfer = await BlockchainService.initiateOwnershipTransfer(
            ctx.documentId,
            ctx.sellerId,
            ctx.buyerId
          );
          return { 
            blockchainTxSig: onchainTransfer.blockchainTxSig, 
            transferId: onchainTransfer.transferId || 'tx-' + Math.random().toString(36).substring(7)
          };
        }
      },
      {
        name: 'DATABASE_CREATE',
        action: async (ctx) => {
          const transfer = await prisma.ownershipTransfer.create({
            data: {
              transferId: ctx.transferId,
              documentId: ctx.documentId,
              previousOwnerHash: ctx.sellerId,
              newOwnerHash: ctx.buyerId,
              status: 'PENDING',
              blockchainTxSig: ctx.blockchainTxSig || null,
              approvals: JSON.stringify([]),
              transferType: ctx.transferType || 'Sale',
              transferNotes: ctx.transferNotes || null,
              supportingDocs: ctx.supportingDocs ? JSON.stringify(ctx.supportingDocs) : JSON.stringify([]),
              assignedNotaryId: ctx.assignedNotaryId
            }
          });
          return { transferDbId: transfer.transferId };
        },
        compensation: async (ctx) => {
          // Saga Rollback: Set transfer status to FAILED in DB
          if (ctx.transferId) {
            await prisma.ownershipTransfer.update({
              where: { transferId: ctx.transferId },
              data: { status: 'FAILED' }
            });
          }
        }
      },
      {
        name: 'NOTARY_APPROVAL', // Suspends workflow for human approval
        action: async () => {
          return { notaryApproved: true };
        }
      },
      {
        name: 'SOLANA_FINALIZE',
        action: async (ctx) => {
          // First approve on-chain as GOVERNMENT so that DocumentProgramClient has the full approvals
          try {
            await BlockchainService.approveOwnershipTransfer(
              ctx.documentId,
              ctx.transferId,
              'GOVERNMENT',
              'Gov1111111111111111111111111111111111111111',
              'government_finalization_signature'
            );
          } catch (approveErr: any) {
            logger.warn('[TransferService] On-chain government approval warning:', approveErr.message);
          }

          const onchainTransfer = await BlockchainService.finalizeOwnershipTransfer(
            ctx.documentId,
            ctx.transferId
          );
          return { finalizeTxSig: onchainTransfer.blockchainTxSig };
        }
      },
      {
        name: 'DATABASE_FINALIZE',
        action: async (ctx) => {
          let approvalsList = [];
          try {
            const transfer = await prisma.ownershipTransfer.findUnique({ where: { transferId: ctx.transferId } });
            approvalsList = transfer ? JSON.parse(transfer.approvals as string) : [];
          } catch {
            approvalsList = [];
          }

          // Add Government approval to approvals list
          const newApproval = {
            actorRole: 'GOVERNMENT',
            signerAddress: 'Gov1111111111111111111111111111111111111111',
            approvedAt: new Date().toISOString(),
            signatureBytes: 'government_finalization_signature',
            approved: true
          };
          approvalsList.push(newApproval);

          // Atomic updates across transfer and document tables
          await prisma.$transaction([
            prisma.ownershipTransfer.update({
              where: { transferId: ctx.transferId },
              data: {
                status: 'FINALIZED',
                finalizedAt: new Date(),
                blockchainTxSig: ctx.finalizeTxSig || ctx.blockchainTxSig,
                approvals: JSON.stringify(approvalsList)
              }
            }),
            prisma.document.update({
              where: { documentId: ctx.documentId },
              data: {
                ownerUserId: ctx.buyerId,
                status: DbDocumentStatus.FULLY_EXECUTED
              }
            }),
            prisma.ownershipRecord.updateMany({
              where: {
                documentId: ctx.documentId,
                status: 'ACTIVE'
              },
              data: {
                status: 'HISTORICAL',
                endDate: new Date()
              }
            }),
            prisma.ownershipRecord.create({
              data: {
                documentId: ctx.documentId,
                ownerUserId: ctx.buyerId,
                previousOwnerId: ctx.sellerId,
                startDate: new Date(),
                transferReason: ctx.transferType || 'Sale',
                status: 'ACTIVE',
                blockchainTx: ctx.finalizeTxSig || ctx.blockchainTxSig
              }
            })
          ]);

          return { dbFinalized: true };
        }
      },
      {
        name: 'REGISTRY_SYNC',
        action: async (ctx) => {
          // Synchronize final deed status to external Land Registry via ESM
          await EnterpriseServiceMeshService.execute(
            'GOVERNMENT_REGISTRY',
            'updatePropertyOwner',
            {
              propertyId: ctx.documentId,
              ownerName: ctx.buyerName || 'Plot 402 LLC',
              contentHash: ctx.contentHash || 'hash',
              timestamp: new Date().toISOString()
            },
            { correlationId: ctx.correlationId }
          );
          return { syncCompleted: true };
        }
      }
    ];
  }

  /**
   * Initiates a SAGA-orchestrated ownership transfer.
   */
  public static async initiateTransfer(
    userId: string,
    documentId: string,
    newOwnerId: string,
    transferType?: string,
    transferNotes?: string,
    supportingDocs?: any
  ) {
    const doc = await prisma.document.findUnique({
      where: { documentId }
    });

    if (!doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    if (doc.ownerUserId !== userId) {
      throw new AppError('Only the current document owner can initiate a transfer.', 403, 'UNAUTHORIZED');
    }

    const buyer = await prisma.user.findUnique({
      where: { userId: newOwnerId }
    });

    if (!buyer) {
      throw new AppError('Buyer not found.', 404, 'BUYER_NOT_FOUND');
    }

    const existing = await prisma.ownershipTransfer.findFirst({
      where: {
        documentId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (existing) {
      throw new AppError('An active transfer is already in progress for this document.', 400, 'TRANSFER_IN_PROGRESS');
    }

    const correlationId = 'transfer-wf-' + documentId;

    // Define initial context for Saga
    const initialContext = {
      documentId,
      sellerId: userId,
      buyerId: newOwnerId,
      transferType: transferType || 'Sale',
      transferNotes: transferNotes || null,
      supportingDocs,
      assignedNotaryId: doc.assignedNotaryId,
      contentHash: doc.contentHash,
      correlationId
    };

    // Build steps and run the orchestrator (Executing steps 1 to 5, suspends at 6 Notary Approval)
    const steps = this.buildTransferSagaSteps(initialContext);
    const result = await WorkflowOrchestrator.executeWorkflow(
      'OWNERSHIP_TRANSFER',
      steps.slice(0, 5), // run start steps
      initialContext,
      correlationId
    );

    // Fetch and return the newly created transfer DB record
    const transfer = await prisma.ownershipTransfer.findFirst({
      where: { documentId, status: 'PENDING' },
      orderBy: { initiatedAt: 'desc' }
    });

    if (!transfer) {
      throw new AppError('Failed to initialize transfer transaction in database.', 500, 'DATABASE_ERROR');
    }

    // Record timeline events
    await prisma.verificationEvent.create({
      data: {
        documentId,
        eventType: 'TRANSFER_INITIATED',
        actorUserId: userId,
        actorLabel: 'Citizen Owner',
        onchainTxRef: transfer.blockchainTxSig || null
      }
    });

    // Trigger AI Auditing
    AiAssessmentService.triggerRegeneration(documentId, 'TRANSFER_INITIATED');
    VerificationCopilotService.triggerRegeneration(documentId, 'TRANSFER_INITIATED');

    return transfer;
  }

  /**
   * Approves a pending ownership transfer (Notary signature acts as the human approval trigger).
   */
  public static async approveTransfer(
    userId: string,
    transferId: string,
    role: string,
    signerAddress: string,
    signatureBytes: string
  ) {
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { transferId },
      include: { document: true }
    });

    if (!transfer) {
      throw new AppError('Ownership transfer session not found.', 404, 'TRANSFER_NOT_FOUND');
    }

    if (transfer.status !== 'PENDING' && transfer.status !== 'APPROVED') {
      throw new AppError(`Cannot approve transfer in ${transfer.status} status.`, 400, 'INVALID_TRANSFER_STATUS');
    }

    const roleUpper = role.toUpperCase();
    if (roleUpper === 'OWNER') {
      if (transfer.document.ownerUserId !== userId) {
        throw new AppError('Only the document owner can approve as OWNER.', 403, 'UNAUTHORIZED');
      }
    } else if (roleUpper === 'BUYER') {
      if (transfer.newOwnerHash !== userId) {
        throw new AppError('Only the designated buyer can approve as BUYER.', 403, 'UNAUTHORIZED');
      }
    } else if (roleUpper === 'NOTARY') {
      const user = await prisma.user.findUnique({ where: { userId } });
      if (!user || user.role !== 'NOTARY') {
        throw new AppError('Only a registered notary can approve as NOTARY.', 403, 'UNAUTHORIZED');
      }
    } else if (roleUpper === 'GOVERNMENT') {
      const user = await prisma.user.findUnique({ where: { userId } });
      if (!user || user.role !== 'ADMIN') {
        throw new AppError('Only a government authority can approve as GOVERNMENT.', 403, 'UNAUTHORIZED');
      }
    } else {
      throw new AppError('Invalid approval role.', 400, 'INVALID_ROLE');
    }

    // Call Solana Program to approve transfer on-chain
    let txSig = '';
    try {
      const onchainTransfer = await BlockchainService.approveOwnershipTransfer(
        transfer.documentId,
        transferId,
        roleUpper,
        signerAddress || '5h3K1111111111111111111111111111111111111111',
        signatureBytes || 'mock_signature'
      );
      txSig = onchainTransfer.blockchainTxSig || '';
    } catch (err: any) {
      logger.error('[TransferService] Blockchain approve transfer failed:', err);
    }

    // Accumulate approvals list
    let approvalsList = [];
    try {
      approvalsList = JSON.parse(transfer.approvals as string);
    } catch {
      approvalsList = [];
    }

    const newApproval = {
      actorRole: roleUpper,
      signerAddress: signerAddress || '5h3K1111111111111111111111111111111111111111',
      approvedAt: new Date().toISOString(),
      signatureBytes: signatureBytes || 'mock_signature',
      approved: true
    };

    const existingIdx = approvalsList.findIndex((a: any) => a.actorRole === roleUpper);
    if (existingIdx !== -1) {
      approvalsList[existingIdx] = newApproval;
    } else {
      approvalsList.push(newApproval);
    }

    const rolesCollected = approvalsList.map((a: any) => a.actorRole);
    const requiredRoles = ['OWNER', 'BUYER', 'NOTARY'];
    const hasBaseApprovals = requiredRoles.every((r) => rolesCollected.includes(r));

    let nextStatus = transfer.status;
    if (hasBaseApprovals && transfer.status === 'PENDING') {
      nextStatus = 'APPROVED';
    }

    const updatedTransfer = await prisma.ownershipTransfer.update({
      where: { transferId },
      data: {
        approvals: JSON.stringify(approvalsList),
        status: nextStatus,
        blockchainTxSig: txSig || transfer.blockchainTxSig
      }
    });

    // Record timeline events
    await prisma.verificationEvent.create({
      data: {
        documentId: transfer.documentId,
        eventType: `TRANSFER_APPROVED_${roleUpper}`,
        actorUserId: userId,
        actorLabel: `${roleUpper} Approver`,
        onchainTxRef: txSig || null
      }
    });

    // Trigger AI Auditing
    AiAssessmentService.triggerRegeneration(transfer.documentId, 'TRANSFER_APPROVED');
    VerificationCopilotService.triggerRegeneration(transfer.documentId, 'TRANSFER_APPROVED');

    // If the notary approves (which satisfies the human suspended step), trigger SAGA workflow completion!
    if (roleUpper === 'NOTARY') {
      logger.info(`[TransferService] Notary approval gathered for transfer "${transferId}". Triggering orchestrated saga resumption.`);
      
      // Find the suspended workflow execution
      const execution = await prisma.workflowExecution.findFirst({
        where: { 
          workflowName: 'OWNERSHIP_TRANSFER',
          status: 'SUSPENDED_APPROVAL',
          context: { path: ['transferId'], equals: transferId }
        }
      });

      if (execution) {
        // Resume step execution
        WorkflowOrchestrator.resumeWorkflow(execution.id, { notarySigned: true }).catch(err => {
          logger.error('[TransferService] Failed to auto-resume workflow on Notary approval:', err);
        });
      }
    }

    return updatedTransfer;
  }

  /**
   * Finalizes the ownership transfer (Government execution step in the Saga).
   */
  public static async finalizeTransfer(userId: string, transferId: string) {
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { transferId },
      include: { document: true }
    });

    if (!transfer) {
      throw new AppError('Ownership transfer session not found.', 404, 'TRANSFER_NOT_FOUND');
    }

    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'ADMIN') {
      throw new AppError('Only a government registry officer can finalize transfers.', 403, 'UNAUTHORIZED');
    }

    // Verify approvals collected
    let approvalsList = [];
    try {
      approvalsList = JSON.parse(transfer.approvals as string);
    } catch {
      approvalsList = [];
    }

    const rolesCollected = approvalsList.map((a: any) => a.actorRole);
    const requiredRoles = ['OWNER', 'BUYER', 'NOTARY'];
    const missing = requiredRoles.filter((r) => !rolesCollected.includes(r));

    if (missing.length > 0) {
      throw new AppError(`Cannot finalize transfer. Missing approvals from: ${missing.join(', ')}`, 400, 'MISSING_APPROVALS');
    }

    // Build remaining finalization steps (7: Solana finalize, 8: Database, 9: Registry Sync)
    const correlationId = 'transfer-finalize-' + transfer.documentId;
    const finalizationContext = {
      documentId: transfer.documentId,
      sellerId: transfer.previousOwnerHash,
      buyerId: transfer.newOwnerHash,
      transferId,
      transferType: transfer.transferType,
      contentHash: transfer.document.contentHash,
      correlationId
    };

    const steps = this.buildTransferSagaSteps(finalizationContext);
    
    // Execute remaining finalization steps (steps 6 to 8 in slice: SOLANA_FINALIZE, DATABASE_FINALIZE, REGISTRY_SYNC)
    // Slice index: steps[6] (SOLANA_FINALIZE), steps[7] (DATABASE_FINALIZE), steps[8] (REGISTRY_SYNC)
    const finalSteps = steps.slice(6);
    
    await WorkflowOrchestrator.executeWorkflow(
      'OWNERSHIP_TRANSFER',
      finalSteps,
      finalizationContext,
      correlationId
    );

    // Record timeline events
    await prisma.verificationEvent.create({
      data: {
        documentId: transfer.documentId,
        eventType: 'TRANSFER_FINALIZED',
        actorUserId: userId,
        actorLabel: 'Government Registry Officer',
        onchainTxRef: transfer.blockchainTxSig || null
      }
    });

    // Trigger AI Auditing
    AiAssessmentService.triggerRegeneration(transfer.documentId, 'TRANSFER_FINALIZED');
    VerificationCopilotService.triggerRegeneration(transfer.documentId, 'TRANSFER_FINALIZED');

    return { 
      transferId, 
      status: 'FINALIZED', 
      newOwner: transfer.newOwnerHash, 
      blockchainTxSig: transfer.blockchainTxSig 
    };
  }

  /**
   * Retrieves transfer details by ID.
   */
  public static async getTransferDetails(transferId: string) {
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { transferId },
      include: {
        document: {
          select: {
            title: true,
            type: true,
            contentHash: true
          }
        }
      }
    });

    if (!transfer) {
      throw new AppError('Ownership transfer session not found.', 404, 'TRANSFER_NOT_FOUND');
    }

    return {
      ...transfer,
      approvals: JSON.parse(transfer.approvals as string)
    };
  }

  /**
   * List transfers for a document.
   */
  public static async getTransfersForDocument(documentId: string) {
    const list = await prisma.ownershipTransfer.findMany({
      where: { documentId },
      orderBy: { initiatedAt: 'desc' }
    });

    return list.map((t) => ({
      ...t,
      approvals: JSON.parse(t.approvals as string)
    }));
  }
}
