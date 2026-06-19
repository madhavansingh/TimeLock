import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/otp/request', AuthController.requestOtp);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.get('/me', authMiddleware, AuthController.getMe);

export default router;
