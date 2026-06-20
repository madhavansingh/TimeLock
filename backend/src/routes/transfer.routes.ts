import { Router } from 'express';
import multer from 'multer';
import { TransferController } from '../controllers/transfer.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  }
});

// Upload a supporting document
router.post('/upload', authMiddleware, upload.single('file'), TransferController.uploadSupportingDoc);

// Initiate a transfer
router.post('/initiate', authMiddleware, TransferController.initiate);

// Approve a transfer
router.post('/approve', authMiddleware, TransferController.approve);

// Finalize a transfer
router.post('/finalize', authMiddleware, TransferController.finalize);

// Get transfer details
router.get('/:id', authMiddleware, TransferController.getDetails);

// Get all transfers for a document
router.get('/document/:docId', authMiddleware, TransferController.getTransfersForDocument);

// Get ownership history for a document
router.get('/document/:docId/ownership', authMiddleware, TransferController.getOwnershipHistory);

export default router;

