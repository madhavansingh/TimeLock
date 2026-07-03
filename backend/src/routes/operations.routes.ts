import { Router } from 'express';
import { OperationsController } from '../controllers/operations.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Protect all operational observatory routes to ADMIN role only
router.use(authMiddleware);
router.use(rbacMiddleware(['ADMIN']));

router.get('/health', OperationsController.getHealth);
router.get('/metrics', OperationsController.getMetrics);
router.get('/ai-observatory', OperationsController.getAiObservatory);
router.get('/blockchain', OperationsController.getBlockchain);
router.get('/incidents', OperationsController.getIncidents);
router.get('/twins', OperationsController.getTwins);
router.get('/integrations', OperationsController.getIntegrations);
router.get('/events', OperationsController.getEvents);
router.post('/events/replay', OperationsController.replayOutboxEvent);

export default router;
