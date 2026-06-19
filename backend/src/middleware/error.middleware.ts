import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../config/errors';
import { logger } from '../config/logger';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  // ------------------------------------------------------------------
  // 1. Zod validation errors — emit 400 with field-level details
  // ------------------------------------------------------------------
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    logger.warn('Request validation failed', { requestId, issues: details });
    return res.status(400).json({
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed. See details for field-level errors.',
        details,
      },
      requestId,
    });
  }

  // ------------------------------------------------------------------
  // 2. Operational AppError — use the typed status code and code
  // ------------------------------------------------------------------
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error(`AppError [${err.code}]: ${err.message}`, { requestId, stack: err.stack });
    } else {
      logger.warn(`AppError [${err.code}]: ${err.message}`, { requestId });
    }
    return res.status(err.statusCode).json({
      data: null,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
      requestId,
    });
  }

  // ------------------------------------------------------------------
  // 3. Unknown / programmer errors — never expose internals
  // ------------------------------------------------------------------
  const errObj = err as any;
  logger.error('Unhandled server error', {
    requestId,
    message: errObj?.message,
    stack: errObj?.stack,
  });

  return res.status(500).json({
    data: null,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
    requestId,
  });
}
