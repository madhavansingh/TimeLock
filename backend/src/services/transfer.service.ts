import { prisma } from '../config/db';
import { BlockchainService } from './blockchain.service';
import { AppError } from '../config/errors';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { AiAssessmentService } from './ai/ai-assessment.service';
import { VerificationCopilotService } from './ai/verification-copilot.service';

export class TransferService {
  /**
   * Initiates a multi-approval ownership transfer workflow.
   */
  public static async initiateTransfer(
    userId: string,
    documentId: string,
    newOwnerId: string,
    transferType?: string,
    transferNotes?: string,
    supportingDocs?: any
  ) {
    // 1. Find document
    const doc = await prisma.document.findUnique({
      where: { documentId }
    });

    if (!doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    // 2. Verify that the requester is the current owner
    if (doc.ownerUserId !== userId) {
      throw new AppError('Only the current document owner can initiate a transfer.', 403, 'UNAUTHORIZED');
    }

    // 3. Find buyer (new owner)
    const buyer = await prisma.user.findUnique({
      where: { userId: newOwnerId }
    });

    if (!buyer) {
      throw new AppError('Buyer not found.', 404, 'BUYER_NOT_FOUND');
    }

    // 4. Check for any existing active transfer
    const existing = await prisma.ownershipTransfer.findFirst({
      where: {
        documentId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    });

    if (existing) {
      throw new AppError('An active transfer is already in progress for this document.', 400, 'TRANSFER_IN_PROGRESS');
    }

    // 5. Call Solana Program via BlockchainService
    let txSig = '';
    let onchainTransfer: any;
    try {
      onchainTransfer = await BlockchainService.initiateOwnershipTransfer(
        documentId,
        doc.ownerUserId,
        newOwnerId
      );
      txSig = onchainTransfer.blockchainTxSig || '';
    } catch (err: any) {
      console.error('[TransferService] Blockchain initiate transfer failed:', err);
      // If STRICT_MODE is true, propagate the actual error
      if (process.env.STRICT_MODE === 'true') {
        throw new AppError(`Blockchain transaction failed: ${err.message}`, 500, 'BLOCKCHAIN_ERROR');
      }
    }

    // 6. Record in Database
    const transfer = await prisma.ownershipTransfer.create({
      data: {
        transferId: onchainTransfer?.transferId || undefined,
        documentId,
        previousOwnerHash: doc.ownerUserId, // Using userId as owner identity representation
        newOwnerHash: newOwnerId,
        status: 'PENDING',
        blockchainTxSig: txSig || null,
        approvals: JSON.stringify([]),
        transferType: transferType || 'Sale',
        transferNotes: transferNotes || null,
        supportingDocs: supportingDocs ? JSON.stringify(supportingDocs) : JSON.stringify([]),
        assignedNotaryId: doc.assignedNotaryId
      }
    });

    // Record verification event
    await prisma.verificationEvent.create({
      data: {
        documentId,
        eventType: 'TRANSFER_INITIATED',
        actorUserId: userId,
        actorLabel: 'Citizen Owner',
        onchainTxRef: txSig || null
      }
    });

    // Asynchronously trigger AI Assessment Phase 2 & 3
    AiAssessmentService.triggerRegeneration(documentId, 'TRANSFER_INITIATED');
    VerificationCopilotService.triggerRegeneration(documentId, 'TRANSFER_INITIATED');

    return transfer;
  }

  /**
   * Approves a pending ownership transfer workflow.
   */
  public static async approveTransfer(
    userId: string,
    transferId: string,
    role: string,
    signerAddress: string,
    signatureBytes: string
  ) {
    // 1. Find transfer
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

    // 2. Validate Role Permissions
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
      // Must be a notary user
      const user = await prisma.user.findUnique({ where: { userId } });
      if (!user || user.role !== 'NOTARY') {
        throw new AppError('Only a registered notary can approve as NOTARY.', 403, 'UNAUTHORIZED');
      }
    } else if (roleUpper === 'GOVERNMENT') {
      // Must be admin or gov authority
      const user = await prisma.user.findUnique({ where: { userId } });
      if (!user || (user.role !== 'ADMIN')) {
        throw new AppError('Only a government authority can approve as GOVERNMENT.', 403, 'UNAUTHORIZED');
      }
    } else {
      throw new AppError('Invalid approval role.', 400, 'INVALID_ROLE');
    }

    // 3. Call Solana program
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
      console.error('[TransferService] Blockchain approve transfer failed:', err);
      if (process.env.STRICT_MODE === 'true') {
        throw new AppError(`Blockchain transaction failed: ${err.message}`, 500, 'BLOCKCHAIN_ERROR');
      }
    }

    // 4. Update Database approvals
    let approvalsList: any[] = [];
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

    const existingIdx = approvalsList.findIndex((a) => a.actorRole === roleUpper);
    if (existingIdx !== -1) {
      approvalsList[existingIdx] = newApproval;
    } else {
      approvalsList.push(newApproval);
    }

    // Check if we have gathered all base approvals
    const rolesCollected = approvalsList.map((a) => a.actorRole);
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

    // Record verification event
    await prisma.verificationEvent.create({
      data: {
        documentId: transfer.documentId,
        eventType: `TRANSFER_APPROVED_${roleUpper}`,
        actorUserId: userId,
        actorLabel: `${roleUpper} Approver`,
        onchainTxRef: txSig || null
      }
    });

    // Asynchronously trigger AI Assessment Phase 2 & 3
    AiAssessmentService.triggerRegeneration(transfer.documentId, 'TRANSFER_APPROVED');
    VerificationCopilotService.triggerRegeneration(transfer.documentId, 'TRANSFER_APPROVED');

    return updatedTransfer;
  }

  /**
   * Finalizes the ownership transfer (requires Government and base approvals).
   */
  public static async finalizeTransfer(userId: string, transferId: string) {
    // 1. Find transfer
    const transfer = await prisma.ownershipTransfer.findUnique({
      where: { transferId },
      include: { document: true }
    });

    if (!transfer) {
      throw new AppError('Ownership transfer session not found.', 404, 'TRANSFER_NOT_FOUND');
    }

    // 2. Verify current user role (must be admin/government)
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user || user.role !== 'ADMIN') {
      throw new AppError('Only a government registry officer can finalize transfers.', 403, 'UNAUTHORIZED');
    }

    // 3. Verify approvals collected
    let approvalsList: any[] = [];
    try {
      approvalsList = JSON.parse(transfer.approvals as string);
    } catch {
      approvalsList = [];
    }

    const rolesCollected = approvalsList.map((a) => a.actorRole);
    const requiredRoles = ['OWNER', 'BUYER', 'NOTARY'];
    const missing = requiredRoles.filter((r) => !rolesCollected.includes(r));

    if (missing.length > 0) {
      throw new AppError(`Cannot finalize transfer. Missing approvals from: ${missing.join(', ')}`, 400, 'MISSING_APPROVALS');
    }

    // 4. Call Solana finalize instruction
    let txSig = '';
    try {
      // First approve on-chain as GOVERNMENT so that DocumentProgramClient has the full approvals
      try {
        await BlockchainService.approveOwnershipTransfer(
          transfer.documentId,
          transferId,
          'GOVERNMENT',
          'Gov1111111111111111111111111111111111111111',
          'government_finalization_signature'
        );
      } catch (approveErr: any) {
        console.warn('[TransferService] On-chain government approval failed (might be in fallback mode):', approveErr.message);
      }

      const onchainTransfer = await BlockchainService.finalizeOwnershipTransfer(
        transfer.documentId,
        transferId
      );
      txSig = onchainTransfer.blockchainTxSig || '';
    } catch (err: any) {
      console.error('[TransferService] Blockchain finalize transfer failed:', err);
      if (process.env.STRICT_MODE === 'true') {
        throw new AppError(`Blockchain transaction failed: ${err.message}`, 500, 'BLOCKCHAIN_ERROR');
      }
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

    // 5. Update Database transfer and Document owner
    await prisma.$transaction([
      prisma.ownershipTransfer.update({
        where: { transferId },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          blockchainTxSig: txSig || transfer.blockchainTxSig,
          approvals: JSON.stringify(approvalsList)
        }
      }),
      prisma.document.update({
        where: { documentId: transfer.documentId },
        data: {
          ownerUserId: transfer.newOwnerHash, // Set new owner
          status: DbDocumentStatus.FULLY_EXECUTED // Ensure document is in fully executed status
        }
      }),
      prisma.ownershipRecord.updateMany({
        where: {
          documentId: transfer.documentId,
          status: 'ACTIVE'
        },
        data: {
          status: 'HISTORICAL',
          endDate: new Date()
        }
      }),
      prisma.ownershipRecord.create({
        data: {
          documentId: transfer.documentId,
          ownerUserId: transfer.newOwnerHash,
          previousOwnerId: transfer.previousOwnerHash,
          startDate: new Date(),
          transferReason: transfer.transferType,
          status: 'ACTIVE',
          blockchainTx: txSig || transfer.blockchainTxSig
        }
      })
    ]);

    // Record timeline events
    await prisma.verificationEvent.create({
      data: {
        documentId: transfer.documentId,
        eventType: 'TRANSFER_FINALIZED',
        actorUserId: userId,
        actorLabel: 'Government Registry Officer',
        onchainTxRef: txSig || null
      }
    });

    // Asynchronously trigger AI Assessment Phase 2 & 3
    AiAssessmentService.triggerRegeneration(transfer.documentId, 'TRANSFER_FINALIZED');
    VerificationCopilotService.triggerRegeneration(transfer.documentId, 'TRANSFER_FINALIZED');

    return { transferId, status: 'FINALIZED', newOwner: transfer.newOwnerHash, blockchainTxSig: txSig || transfer.blockchainTxSig };
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
