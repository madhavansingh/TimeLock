import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  }
});

// Register new document (Citizen only)
router.post(
  '/',
  authMiddleware,
  rbacMiddleware(['CITIZEN']),
  upload.single('file'),
  DocumentController.uploadDocument
);

// Search documents (Institutional roles)
router.get(
  '/search',
  authMiddleware,
  rbacMiddleware(['BANK_OFFICER', 'COURT_CLERK', 'ADMIN']),
  DocumentController.searchDocuments
);

// Fetch document details & status (Public verification endpoint)
router.get('/:id/status', DocumentController.getStatus);

// Fetch QR Code
router.get('/:id/qr', authMiddleware, DocumentController.getQrCode);

// Verify uploaded file (Public verification endpoint)
router.post('/:id/verify', upload.single('file'), DocumentController.verifyScan);

// Record signature (Notaries or Citizens)
router.post(
  '/:id/signatures',
  authMiddleware,
  rbacMiddleware(['NOTARY', 'CITIZEN']),
  DocumentController.recordSignature
);

// Retrieve custody trail timeline (Institutional roles)
router.get(
  '/:id/custody',
  authMiddleware,
  rbacMiddleware(['BANK_OFFICER', 'COURT_CLERK', 'ADMIN']),
  DocumentController.getCustodyTrail
);

// Retrieve fraud risk details (Institutional roles)
router.get(
  '/:id/fraud-score',
  authMiddleware,
  rbacMiddleware(['BANK_OFFICER', 'COURT_CLERK', 'ADMIN']),
  DocumentController.getFraudScore
);

// Download Certificate (Public)
router.get('/:id/certificate', DocumentController.downloadCertificate);

export default router;
