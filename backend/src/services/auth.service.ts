import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { DbUserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_hackathon';

// In-memory OTP storage for sandbox environment
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

export class AuthService {
  /**
   * Generates a 6-digit OTP and logs it in the cache database.
   */
  public static async generateOtp(identifier: string): Promise<string> {
    const code = process.env.NODE_ENV === 'test' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    otpStore.set(identifier, {
      code,
      expiresAt,
      attempts: 0
    });

    console.log(`[AUTH] Generated OTP for ${identifier}: ${code}`);
    return code;
  }

  /**
   * Validates OTP code and manages lockouts.
   */
  public static async verifyOtp(
    identifier: string,
    code: string
  ): Promise<{ token: string; userId: string; role: DbUserRole } | null> {
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
    }

    // Generate short-lived JWT token
    const token = jwt.sign(
      {
        userId: user.userId,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      userId: user.userId,
      role: user.role
    };
  }
}
