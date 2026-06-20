import { Request, Response, NextFunction } from 'express';
import { OtpRequestSchema } from '../shared/validation';
import { LoginRequestSchema, RefreshRequestSchema } from '../validation/auth.validation';
import { AuthService } from '../services/auth.service';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  /**
   * Request a 6-digit verification code. Sent via Nodemailer email.
   */
  public static async requestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = OtpRequestSchema.parse(req.body);
      await AuthService.generateOtp(payload.identifier);

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
   * Verify verification code and retrieve access and refresh tokens.
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = LoginRequestSchema.parse(req.body);
      const userContext = await AuthService.verifyOtp(payload.identifier, payload.code);

      if (!userContext) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_OTP',
            message: 'The code provided is incorrect or has expired.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      // Generate Access & Refresh tokens
      const tokens = AuthService.generateTokenPair(userContext.userId, userContext.role);

      res.status(200).json({
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            userId: userContext.userId,
            role: userContext.role
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

  /**
   * Refresh session tokens using a valid refresh token.
   */
  public static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = RefreshRequestSchema.parse(req.body);
      const userContext = AuthService.verifyRefreshToken(payload.refreshToken);

      // Re-fetch user to verify they still exist and have correct role
      const user = await prisma.user.findUnique({
        where: { userId: userContext.userId }
      });

      if (!user) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Authenticated user no longer exists.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const tokens = AuthService.generateTokenPair(user.userId, user.role);

      res.status(200).json({
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err: any) {
      if (err.message === 'INVALID_TOKEN' || err.message === 'INVALID_TOKEN_TYPE') {
        return res.status(401).json({
          data: null,
          error: {
            code: 'INVALID_TOKEN',
            message: 'The session token provided is invalid or expired.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }
      next(err);
    }
  }

  /**
   * Retrieves current authenticated user profile.
   */
  public static async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication context not found.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      const user = await prisma.user.findUnique({
        where: { userId: req.user.userId }
      });

      if (!user) {
        return res.status(404).json({
          data: null,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User profile not found.'
          },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
      }

      res.status(200).json({
        data: {
          user: {
            userId: user.userId,
            role: user.role,
            emailHash: user.emailHash,
            phoneHash: user.phoneHash
          }
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
