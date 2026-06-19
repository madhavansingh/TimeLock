import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

router.get('/:id', authMiddleware, UserController.getUserById);
router.patch('/:id', authMiddleware, UserController.updateUser);
router.get('/', authMiddleware, rbacMiddleware(['ADMIN']), UserController.listUsers);

export default router;
