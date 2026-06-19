/**
 * system.routes.ts — Health, Readiness, and Version Endpoints
 *
 * Endpoints:
 *   GET /health    — Liveness probe. Returns 200 if the process is alive.
 *   GET /ready     — Readiness probe. Checks DB connectivity before returning 200.
 *   GET /version   — Returns build metadata. Used by judges and CI to confirm version.
 *
 * None of these endpoints require authentication.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

const router = Router();

// ---------------------------------------------------------------------------
// GET /health — Liveness probe (is the process alive?)
// ---------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    data: {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    error: null,
    requestId: 'system',
  });
});

// ---------------------------------------------------------------------------
// GET /ready — Readiness probe (can the server handle traffic?)
// Checks: DB connection
// ---------------------------------------------------------------------------
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'fail'> = {
    database: 'fail',
  };

  try {
    // Raw SQL ping — fastest possible DB check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    logger.error('Readiness check: database ping failed', {
      error: (err as Error).message,
    });
  }

  const allOk = Object.values(checks).every((v) => v === 'ok');
  const httpStatus = allOk ? 200 : 503;

  res.status(httpStatus).json({
    data: {
      status: allOk ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    },
    error: allOk
      ? null
      : {
          code: 'SERVICE_UNAVAILABLE',
          message: 'One or more readiness checks failed.',
        },
    requestId: 'system',
  });
});

// ---------------------------------------------------------------------------
// GET /version — Build metadata
// ---------------------------------------------------------------------------
router.get('/version', (_req: Request, res: Response) => {
  // Read from package.json at runtime — resolveJsonModule is enabled in tsconfig
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('../../package.json') as { name: string; version: string; description: string };

  res.status(200).json({
    data: {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    error: null,
    requestId: 'system',
  });
});

export default router;
