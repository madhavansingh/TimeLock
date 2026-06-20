import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rate-limiter.middleware';

const router = Router();

// Limit auth requests to 10 per 15 minutes
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login or OTP attempts, please try again in 15 minutes.'
});

router.post('/otp/request', authLimiter, AuthController.requestOtp);
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.passwordLogin);
router.post('/refresh', AuthController.refresh);
router.get('/me', authMiddleware, AuthController.getMe);

export default router;
