import { Router } from 'express';
import { AvccController } from '../controllers/avcc.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

const allowedRoles = ['CITIZEN', 'NOTARY', 'BANK_OFFICER', 'COURT_CLERK', 'ADMIN'];
const notaryRoles = ['NOTARY', 'ADMIN'];

router.get(
  '/dashboard',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  AvccController.getDashboard
);

router.post(
  '/anomalies/:id/resolve',
  authMiddleware,
  rbacMiddleware(notaryRoles),
  AvccController.resolveAnomaly
);

router.post(
  '/recalculate',
  authMiddleware,
  rbacMiddleware(notaryRoles),
  AvccController.recalculate
);

router.get(
  '/property/:propertyId',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  AvccController.getPropertyTrust
);

export default router;
