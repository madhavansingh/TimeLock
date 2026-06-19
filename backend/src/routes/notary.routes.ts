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

export default router;
