import { Router } from 'express';
import multer from 'multer';
import { DocumentController } from '../controllers/document.controller';
import { TwinController } from '../controllers/twin.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

import { createRateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();
const upload = multer({
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  }
});

// Rate limiters for public endpoints
const statusLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many status check requests. Please try again later.'
});

const verifyScanLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many verify requests. Please try again later.'
});

const certificateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many certificate downloads. Please try again later.'
});

// Register new document (Citizen only)
router.post(
  '/',
  authMiddleware,
  rbacMiddleware(['CITIZEN']),
  upload.single('file'),
  DocumentController.uploadDocument
);

// Fetch citizen's own documents (Citizen only)
router.get(
  '/',
  authMiddleware,
  rbacMiddleware(['CITIZEN']),
  DocumentController.getMyDocuments
);

// Search documents (Institutional roles)
router.get(
  '/search',
  authMiddleware,
  rbacMiddleware(['BANK_OFFICER', 'COURT_CLERK', 'ADMIN']),
  DocumentController.searchDocuments
);

// Fetch document details & status (Public verification endpoint with optional auth)
router.get('/:id/status', statusLimiter, optionalAuthMiddleware, DocumentController.getStatus);

// Fetch QR Code
router.get('/:id/qr', authMiddleware, DocumentController.getQrCode);

// Verify uploaded file (Public verification endpoint with optional auth)
router.post('/:id/verify', verifyScanLimiter, optionalAuthMiddleware, upload.single('file'), DocumentController.verifyScan);

// Start notary review
router.post(
  '/:id/review',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.startReview
);

// Record signature (Notaries or Citizens)
router.post(
  '/:id/signatures',
  authMiddleware,
  rbacMiddleware(['NOTARY', 'CITIZEN']),
  DocumentController.recordSignature
);

// Retrieve custody trail timeline (Enforced internally in controller)
router.get(
  '/:id/custody',
  authMiddleware,
  DocumentController.getCustodyTrail
);

// VPL routes
router.post(
  '/:id/vpl/evidence',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  upload.single('file'),
  DocumentController.uploadEvidence
);

router.post(
  '/:id/vpl/resolve',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.resolveChallenge
);

router.post(
  '/:id/vpl/checklist',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.updateChecklist
);

router.post(
  '/:id/vpl/anchor',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.anchorVerification
);

// Professional notary review workspace actions
router.post(
  '/:id/ready-for-signature',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.approveForSignature
);

router.post(
  '/:id/vpl/request-evidence',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  DocumentController.requestAdditionalEvidence
);

// Retrieve fraud risk details (Institutional roles)
router.get(
  '/:id/fraud-score',
  authMiddleware,
  rbacMiddleware(['BANK_OFFICER', 'COURT_CLERK', 'ADMIN']),
  DocumentController.getFraudScore
);

// Download Certificate (Public verification endpoint with optional auth)
router.get('/:id/certificate', certificateLimiter, optionalAuthMiddleware, DocumentController.downloadCertificate);

// Download Sovereign Upload Receipt PDF (Public verification endpoint with optional auth)
router.get('/:id/receipt/pdf', certificateLimiter, optionalAuthMiddleware, DocumentController.downloadReceiptPdf);

// AI Verification Insights
router.get('/:id/ai-insights', authMiddleware, DocumentController.getAiInsights);
router.post('/:id/ai-insights/regenerate', authMiddleware, DocumentController.regenerateAiInsights);

// Digital Twin & Verification Passport routes
router.get('/ave/metrics', authMiddleware, TwinController.getGlobalMetrics);
router.get('/:id/twin', authMiddleware, TwinController.getActiveTwin);
router.get('/:id/twin/history', authMiddleware, TwinController.getTwinHistory);
router.post('/:id/twin/recalculate', authMiddleware, TwinController.recalculateTwin);

export default router;
