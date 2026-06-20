import { Router } from 'express';
import { NotaryController } from '../controllers/notary.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Onboard requires Admin privileges
router.post(
  '/onboard',
  authMiddleware,
  rbacMiddleware(['ADMIN']),
  NotaryController.onboardNotary
);

// Retrieve pending queue requires Notary role
router.get(
  '/queue',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  NotaryController.getPendingQueue
);

// Retrieve transfers queue requires Notary role
router.get(
  '/transfers',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  NotaryController.getTransfersQueue
);

// Retrieve archive of signed/executed documents
router.get(
  '/archive',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  NotaryController.getArchive
);

// Retrieve dashboard analytics
router.get(
  '/analytics',
  authMiddleware,
  rbacMiddleware(['NOTARY']),
  NotaryController.getAnalytics
);

// Fetch list of active notaries (Any authenticated user)
router.get(
  '/',
  authMiddleware,
  NotaryController.getActiveNotaries
);

export default router;
