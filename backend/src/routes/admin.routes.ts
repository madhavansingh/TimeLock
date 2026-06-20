import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Expose admin stats and audit logs to ADMIN roles
router.get(
  '/executive-stats',
  authMiddleware,
  rbacMiddleware(['ADMIN']),
  AdminController.getExecutiveStats
);

router.get(
  '/audit-logs',
  authMiddleware,
  rbacMiddleware(['ADMIN']),
  AdminController.getAuditLogs
);

export default router;
