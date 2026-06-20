import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { PaymentService } from '../services/payment.service';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  amount: z.number().int().positive().optional().default(99),
});

const VerifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
  razorpaySignature: z.string().min(1, 'Signature is required'),
});

export class PaymentController {
  /**
   * Initiates payment order on Razorpay.
   */
  public static async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = CreateOrderSchema.parse(req.body);
      const order = await PaymentService.createOrder(body.amount);

      res.status(201).json({
        data: order,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verifies Razorpay payment signature.
   */
  public static async verifyPayment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = VerifyPaymentSchema.parse(req.body);
      const payment = await PaymentService.verifyPayment(
        body.razorpayOrderId,
        body.razorpayPaymentId,
        body.razorpaySignature
      );

      res.status(200).json({
        data: {
          paymentId: payment.paymentId,
          status: payment.status,
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    } catch (err) {
      next(err);
    }
  }
}
