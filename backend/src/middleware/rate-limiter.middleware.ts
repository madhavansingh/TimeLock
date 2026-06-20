import { Request, Response, NextFunction } from 'express';
import { TooManyRequestsError } from '../config/errors';
import { logger } from '../config/logger';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitInfo>();

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Creates an Express middleware for in-memory rate limiting.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // If strict mode is disabled, bypass rate limiting
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    let limitInfo = rateLimitMap.get(key);

    if (!limitInfo || now > limitInfo.resetTime) {
      limitInfo = {
        count: 1,
        resetTime: now + options.windowMs
      };
      rateLimitMap.set(key, limitInfo);
    } else {
      limitInfo.count++;
    }

    const remaining = Math.max(0, options.max - limitInfo.count);
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(limitInfo.resetTime / 1000));

    if (limitInfo.count > options.max) {
      logger.warn(`[RATE LIMIT EXCEEDED] IP: ${ip}, Path: ${req.path}, Requests: ${limitInfo.count}/${options.max}`);
      throw new TooManyRequestsError(options.message || 'Too many requests. Please try again later.');
    }

    next();
  };
}
