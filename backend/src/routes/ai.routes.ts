import { Router } from 'express';
import { CopilotController } from '../controllers/copilot.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { createRateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

const allowedRoles = ['CITIZEN', 'NOTARY', 'BANK_OFFICER', 'COURT_CLERK', 'ADMIN'];

// Limit AI regenerations to 5 per minute
const aiRegenLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many regeneration attempts. Please wait a minute before requesting another AI review.'
});

router.get(
  '/documents/:id/conflict',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  CopilotController.getConflict
);

router.get(
  '/documents/:id/prediction',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  CopilotController.getPrediction
);

router.get(
  '/documents/:id/questions',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  CopilotController.getQuestions
);

router.get(
  '/documents/:id/recommendation',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  CopilotController.getRecommendation
);

router.get(
  '/documents/:id/copilot',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  CopilotController.getCopilot
);

router.post(
  '/documents/:id/regenerate',
  authMiddleware,
  rbacMiddleware(allowedRoles),
  aiRegenLimiter,
  CopilotController.regenerate
);

export default router;
