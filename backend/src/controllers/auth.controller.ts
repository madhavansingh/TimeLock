import { Request, Response, NextFunction } from 'express';
import { OtpRequestSchema, OtpVerifySchema } from '../../../shared/validation';
import { AuthService } from '../services/auth.service';

export class AuthController {
  /**
   * Request a 6-digit verification code.
   */
  public static async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = OtpRequestSchema.parse(req.body);
      const code = await AuthService.generateOtp(payload.identifier);

      res.status(200).json({
        data: {
          message: 'Verification OTP sent successfully.'
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify verification code and retrieve session token.
   */
  public static async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = OtpVerifySchema.parse(req.body);
      const result = await AuthService.verifyOtp(payload.identifier, payload.code);

      if (!result) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_OTP',
            message: 'The code provided is incorrect or has expired.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      res.status(200).json({
        data: {
          token: result.token,
          user: {
            userId: result.userId,
            role: result.role
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err: any) {
      if (err.message === 'TOO_MANY_ATTEMPTS') {
        return res.status(429).json({
          data: null,
          error: {
            code: 'LOCKOUT',
            message: 'Too many failed verification attempts. Try again later.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }
      next(err);
    }
  }
}
