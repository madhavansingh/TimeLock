import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { DbUserRole } from '@prisma/client';
import { config } from '../config/env';
import { sendOtpEmail } from '../config/mail';
import { logger } from '../config/logger';
import { SmsProviderFactory } from './sms.provider';

// In-memory OTP storage for sandbox environment
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

export class AuthService {
  /**
   * Generates a 6-digit OTP, sends it via email or SMS, and stores it in cache.
   */
  public static async generateOtp(identifier: string): Promise<string> {
    // Generate dynamic 6-digit OTP code (no hardcoded 123456)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(identifier, {
      code,
      expiresAt,
      attempts: 0
    });

    logger.info(`[AUTH] Generated OTP for ${identifier}: ${code}`);

    // Route to appropriate provider
    if (identifier.includes('@')) {
      await sendOtpEmail(identifier, code);
    } else {
      const smsProvider = SmsProviderFactory.getProvider();
      await smsProvider.sendOtp(identifier, code);
    }

    return code;
  }

  /**
   * Validates OTP code and manages lockouts.
   */
  public static async verifyOtp(
    identifier: string,
    code: string
  ): Promise<{ userId: string; role: DbUserRole } | null> {
    const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !config.isProduction;
    if (code === '123456') {
      if (isDev) {
        logger.info(`[AUTH] Using development bypass OTP 123456 for ${identifier}`);
        const hash = crypto.createHash('sha256').update(identifier).digest('hex');
        let user = await prisma.user.findFirst({
          where: {
            OR: [{ emailHash: hash }, { phoneHash: hash }]
          }
        });
        if (!user) {
          user = await prisma.user.create({
            data: {
              role: DbUserRole.CITIZEN,
              phoneHash: identifier.includes('@') ? '' : hash,
              emailHash: identifier.includes('@') ? hash : ''
            }
          });
          logger.info(`[AUTH] Auto-registered new CITIZEN user via bypass for hash ${hash}`);
        }
        return {
          userId: user.userId,
          role: user.role
        };
      } else {
        logger.warn(`[AUTH] Blocked attempt to use development bypass OTP 123456 in production for ${identifier}`);
      }
    }

    const record = otpStore.get(identifier);

    if (!record) return null;

    if (Date.now() > record.expiresAt) {
      otpStore.delete(identifier);
      return null;
    }

    if (record.attempts >= 3) {
      otpStore.delete(identifier);
      throw new Error('TOO_MANY_ATTEMPTS');
    }

    if (record.code !== code) {
      record.attempts += 1;
      otpStore.set(identifier, record);
      return null;
    }

    // Success -> Clear OTP
    otpStore.delete(identifier);

    // Hash the identifier for data residency/anonymization (using SHA-256)
    const hash = crypto.createHash('sha256').update(identifier).digest('hex');

    // Check if user exists, else onboard a new citizen by default
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ emailHash: hash }, { phoneHash: hash }]
      }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          role: DbUserRole.CITIZEN,
          phoneHash: identifier.includes('@') ? '' : hash,
          emailHash: identifier.includes('@') ? hash : ''
        }
      });
      logger.info(`[AUTH] Auto-registered new CITIZEN user for hash ${hash}`);
    }

    return {
      userId: user.userId,
      role: user.role
    };
  }

  /**
   * Generates short-lived Access Token and long-lived Refresh Token.
   */
  public static generateTokenPair(userId: string, role: DbUserRole): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(
      {
        userId,
        role,
        tokenType: 'access'
      },
      config.jwtSecret,
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      {
        userId,
        role,
        tokenType: 'refresh'
      },
      config.jwtSecret,
      { expiresIn: '7d' } // Long-lived refresh token
    );

    return { accessToken, refreshToken };
  }

  /**
   * Cryptographically verifies a refresh token.
   */
  public static verifyRefreshToken(token: string): { userId: string; role: DbUserRole } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: string;
        role: DbUserRole;
        tokenType: string;
      };

      if (decoded.tokenType !== 'refresh') {
        throw new Error('INVALID_TOKEN_TYPE');
      }

      return {
        userId: decoded.userId,
        role: decoded.role
      };
    } catch (err) {
      logger.warn('Failed to verify refresh token', { error: (err as Error).message });
      throw new Error('INVALID_TOKEN');
    }
  }
}
