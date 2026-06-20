import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { TransferService } from '../services/transfer.service';
import { prisma } from '../config/db';
import { StorageService } from '../services/storage.service';

export class TransferController {
  /**
   * Uploads a supporting document to IPFS for a transfer request.
   */
  public static async uploadSupportingDoc(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({
          data: null,
          error: { code: 'FILE_REQUIRED', message: 'File is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const { cid } = await StorageService.uploadDocument(req.file.buffer, req.file.originalname);

      res.status(200).json({
        data: { title: req.file.originalname, ipfsCid: cid },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Initiates a multi-approval ownership transfer workflow.
   */
  public static async initiate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { documentId, newOwnerId, transferType, transferNotes, supportingDocs } = req.body;

      if (!documentId || !newOwnerId) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'documentId and newOwnerId are required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const transfer = await TransferService.initiateTransfer(
        req.user!.userId,
        documentId,
        newOwnerId,
        transferType,
        transferNotes,
        supportingDocs
      );

      res.status(201).json({
        data: transfer,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approves a pending ownership transfer workflow.
   */
  public static async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { transferId, role, signerAddress, signatureBytes } = req.body;

      if (!transferId || !role) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'transferId and role are required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const transfer = await TransferService.approveTransfer(
        req.user!.userId,
        transferId,
        role,
        signerAddress,
        signatureBytes
      );

      res.status(200).json({
        data: transfer,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Finalizes the ownership transfer.
   */
  public static async finalize(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { transferId } = req.body;

      if (!transferId) {
        return res.status(400).json({
          data: null,
          error: { code: 'BAD_REQUEST', message: 'transferId is required.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const result = await TransferService.finalizeTransfer(
        req.user!.userId,
        transferId
      );

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
   * Gets details of a transfer.
   */
  public static async getDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const transfer = await TransferService.getTransferDetails(id);

      res.status(200).json({
        data: transfer,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all transfers for a document.
   */
  public static async getTransfersForDocument(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { docId } = req.params;
      const transfers = await TransferService.getTransfersForDocument(docId);

      res.status(200).json({
        data: transfers,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Gets chronological ownership history of a document.
   */
  public static async getOwnershipHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { docId } = req.params;
      const history = await prisma.ownershipRecord.findMany({
        where: { documentId: docId },
        orderBy: { startDate: 'asc' },
        include: { owner: true }
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
}

