import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';

const router = Router();

// Create Razorpay order (Authenticated Citizens only)
router.post(
  '/create-order',
  authMiddleware,
  rbacMiddleware(['CITIZEN']),
  PaymentController.createOrder
);

// Verify signature (Authenticated Citizens only)
router.post(
  '/verify',
  authMiddleware,
  rbacMiddleware(['CITIZEN']),
  PaymentController.verifyPayment
);

export default router;
