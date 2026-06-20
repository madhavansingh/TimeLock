import { Router } from 'express';
import { AuthorityController } from '../controllers/authority.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Get all authorities
router.get('/', authMiddleware, AuthorityController.list);

// Register a new authority
router.post('/', authMiddleware, AuthorityController.register);

// Revoke an authority
router.delete('/:id', authMiddleware, AuthorityController.revoke);

export default router;
