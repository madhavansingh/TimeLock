import { prisma } from '../config/db';
import { config } from '../config/env';
import { AppError } from '../config/errors';
import crypto from 'crypto';
import { logger } from '../config/logger';

export class PaymentService {
  private static getCredentials() {
    const keyId = config.razorpayKeyId || process.env.RAZORPAY_KEY_ID;
    const keySecret = config.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      logger.error('Razorpay API keys are missing in env config.');
      throw new AppError('Razorpay is not configured on the server. Please check environment variables.', 500, 'PAYMENT_GATEWAY_UNCONFIGURED');
    }

    return { keyId, keySecret };
  }

  /**
   * Creates a Razorpay order and stores a PENDING payment record.
   * @param amountInInr Amount in INR (e.g. 10)
   */
  public static async createOrder(amountInInr: number) {
    const { keyId, keySecret } = this.getCredentials();
    const amountInPaise = amountInInr * 100;
    const receipt = `rcpt_${crypto.randomBytes(8).toString('hex')}`;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: receipt,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        logger.error(`Razorpay order creation request failed: ${response.status} - ${errBody}`);
        throw new Error(`Razorpay returned status ${response.status}: ${errBody}`);
      }

      const orderData = await response.json() as { id: string; amount: number; currency: string };

      // Store a PENDING payment record in our DB
      const payment = await prisma.payment.create({
        data: {
          amount: amountInPaise,
          status: 'PENDING',
          razorpayOrderId: orderData.id,
        },
      });

      logger.info(`Successfully created Razorpay order: ${orderData.id} for payment: ${payment.paymentId}`);

      return {
        orderId: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
        paymentId: payment.paymentId,
        keyId,
      };
    } catch (err: any) {
      logger.error(`Error in PaymentService.createOrder: ${err.message}`);
      throw new AppError(`Failed to initiate payment order: ${err.message}`, 500, 'PAYMENT_ORDER_CREATION_FAILED');
    }
  }

  /**
   * Verifies the Razorpay payment signature and updates the payment status.
   */
  public static async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) {
    const { keySecret } = this.getCredentials();

    // Look up the pending payment record in our database
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
    });

    if (!payment) {
      throw new AppError(`No payment record found for order ID: ${razorpayOrderId}`, 404, 'PAYMENT_RECORD_NOT_FOUND');
    }

    // Verify signature
    const hmac = crypto.createHmac('sha256', keySecret);
    hmac.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpaySignature) {
      logger.warn(`Signature verification failed for payment: ${payment.paymentId}. Expected ${generatedSignature}, got ${razorpaySignature}`);
      
      // Update payment record to FAILED
      await prisma.payment.update({
        where: { paymentId: payment.paymentId },
        data: {
          status: 'FAILED',
          razorpayPaymentId,
          razorpaySignature,
        },
      });

      throw new AppError('Razorpay payment signature is invalid. Verification failed.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    // Update payment record to SUCCESS
    const updatedPayment = await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        status: 'SUCCESS',
        razorpayPaymentId,
        razorpaySignature,
      },
    });

    logger.info(`Successfully verified payment: ${updatedPayment.paymentId} for order: ${razorpayOrderId}`);
    return updatedPayment;
  }
}
