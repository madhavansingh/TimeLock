import { Router } from 'express';
import { TwinEvolutionController } from '../controllers/twin-evolution.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Enforce strict enterprise role security
router.use(authMiddleware);
router.use(rbacMiddleware(['ADMIN']));

// Non-document Twin Lifecycles
router.get('/:type/:id', TwinEvolutionController.getTwin);
router.post('/:type/:id/recalculate', TwinEvolutionController.recalculateTwin);

export default router;
