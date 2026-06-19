/**
 * request-logger.middleware.ts — HTTP Request Logger
 *
 * Attaches start-time to each request and logs method, path, status code,
 * and duration after the response is sent. Uses the structured logger so
 * output format is consistent with all other log entries.
 *
 * Mount BEFORE routes in app.ts.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startAt = process.hrtime.bigint();
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  res.on('finish', () => {
    const durationNs = process.hrtime.bigint() - startAt;
    const durationMs = Number(durationNs / 1_000_000n);

    logger.request(req.method, req.originalUrl, res.statusCode, durationMs, requestId);
  });

  next();
}
