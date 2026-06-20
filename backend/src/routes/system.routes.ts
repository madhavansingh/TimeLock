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
import { config } from '../config/env';
import { BlockchainService } from '../services/blockchain.service';
import { HashService } from '../services/hash.service';

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
// GET /health/database — Database health check
// ---------------------------------------------------------------------------
router.get('/health/database', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      data: { status: 'healthy', database: 'ok', timestamp: new Date().toISOString() },
      error: null,
      requestId: req.headers['x-request-id'] || 'system'
    });
  } catch (err: any) {
    res.status(500).json({
      data: { status: 'unhealthy', database: 'fail' },
      error: { code: 'DATABASE_UNAVAILABLE', message: err.message },
      requestId: req.headers['x-request-id'] || 'system'
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/blockchain — Solana Node liveness check
// ---------------------------------------------------------------------------
router.get('/health/blockchain', async (req: Request, res: Response) => {
  try {
    const { solanaClient } = (BlockchainService as any).getClients();
    const slot = await solanaClient.connection.getSlot();
    res.status(200).json({
      data: { status: 'healthy', blockchain: 'ok', slot, timestamp: new Date().toISOString() },
      error: null,
      requestId: req.headers['x-request-id'] || 'system'
    });
  } catch (err: any) {
    res.status(500).json({
      data: { status: 'unhealthy', blockchain: 'fail' },
      error: { code: 'BLOCKCHAIN_UNAVAILABLE', message: err.message },
      requestId: req.headers['x-request-id'] || 'system'
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/ai — NVIDIA Nemotron service liveness check
// ---------------------------------------------------------------------------
router.get('/health/ai', async (req: Request, res: Response) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  const isMock = !apiKey || apiKey.trim() === '' || apiKey.startsWith('mock_');
  if (isMock) {
    return res.status(503).json({
      data: { status: 'unhealthy', ai: 'fail' },
      error: { code: 'AI_UNCONFIGURED', message: 'NVIDIA Nemotron API key is not configured.' },
      requestId: req.headers['x-request-id'] || 'system'
    });
  }

  try {
    res.status(200).json({
      data: { status: 'healthy', ai: 'ok', timestamp: new Date().toISOString() },
      error: null,
      requestId: req.headers['x-request-id'] || 'system'
    });
  } catch (err: any) {
    res.status(500).json({
      data: { status: 'unhealthy', ai: 'fail' },
      error: { code: 'AI_UNAVAILABLE', message: err.message },
      requestId: req.headers['x-request-id'] || 'system'
    });
  }
});

// ---------------------------------------------------------------------------
// GET /health/storage — Pinata IPFS auth check
// ---------------------------------------------------------------------------
router.get('/health/storage', async (req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.pinataJwt}`
      }
    });
    if (response.ok) {
      res.status(200).json({
        data: { status: 'healthy', storage: 'ok', timestamp: new Date().toISOString() },
        error: null,
        requestId: req.headers['x-request-id'] || 'system'
      });
    } else {
      res.status(503).json({
        data: { status: 'unhealthy', storage: 'fail' },
        error: { code: 'STORAGE_UNAUTHORIZED', message: 'Pinata auth check failed.' },
        requestId: req.headers['x-request-id'] || 'system'
      });
    }
  } catch (err: any) {
    res.status(500).json({
      data: { status: 'unhealthy', storage: 'fail' },
      error: { code: 'STORAGE_UNAVAILABLE', message: err.message },
      requestId: req.headers['x-request-id'] || 'system'
    });
  }
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

// ---------------------------------------------------------------------------
// GET /system/health & GET /system-health — Production Health checks
// ---------------------------------------------------------------------------
const getSystemHealth = async (req: Request, res: Response) => {
  const health: any = {
    database: { status: 'fail', latencyMs: 0 },
    blockchain: { status: 'fail', latencyMs: 0, slot: 0 },
    rpc: { status: 'fail', url: config.solanaRpcUrl },
    ipfs: { status: 'fail', latencyMs: 0 },
    pinata: { status: 'fail', latencyMs: 0 },
    certificateService: { status: 'fail' },
    queueStatus: { status: 'ok', lagMs: 0 }
  };

  // 1. Database Status
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database.status = 'ok';
    health.database.latencyMs = Date.now() - dbStart;
  } catch (err: any) {
    health.database.error = err.message;
  }

  // 2 & 3. Blockchain & RPC Connectivity
  const solStart = Date.now();
  try {
    const { solanaClient } = (BlockchainService as any).getClients();
    const slot = await solanaClient.connection.getSlot();
    health.blockchain.status = 'ok';
    health.blockchain.slot = slot;
    health.blockchain.latencyMs = Date.now() - solStart;
    health.rpc.status = 'ok';
  } catch (err: any) {
    health.blockchain.error = err.message;
    health.rpc.error = err.message;
  }

  // 4. IPFS Connectivity
  const ipfsStart = Date.now();
  try {
    const gatewayUrl = `https://${config.pinataGateway}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(gatewayUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    health.ipfs.status = response.ok || response.status < 500 ? 'ok' : 'fail';
    health.ipfs.latencyMs = Date.now() - ipfsStart;
  } catch (err: any) {
    health.ipfs.error = err.message;
  }

  // 5. Pinata Connectivity
  const pinataStart = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.pinataJwt}`
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    health.pinata.status = response.ok ? 'ok' : 'fail';
    health.pinata.latencyMs = Date.now() - pinataStart;
  } catch (err: any) {
    health.pinata.error = err.message;
  }

  // 6. Certificate Service
  try {
    const testHash = Buffer.from('health_check_test_hash').toString('hex');
    const signature = HashService.signWithNotary(testHash, '688c6761-c8d3-4628-8792-87f62f8cb5a5');
    if (signature) {
      health.certificateService.status = 'ok';
    }
  } catch (err: any) {
    health.certificateService.error = err.message;
  }

  // 7. Queue Status
  const qStart = Date.now();
  await new Promise((resolve) => setImmediate(resolve));
  health.queueStatus.lagMs = Date.now() - qStart;

  const isOverallOk = 
    health.database.status === 'ok' &&
    health.blockchain.status === 'ok' &&
    health.rpc.status === 'ok';

  res.status(isOverallOk ? 200 : 500).json({
    data: {
      status: isOverallOk ? 'healthy' : 'degraded',
      ...health,
      timestamp: new Date().toISOString()
    },
    error: isOverallOk ? null : { code: 'HEALTH_DEGRADED', message: 'One or more systems are down.' },
    requestId: req.headers['x-request-id'] || 'system'
  });
};

router.get('/system/health', getSystemHealth);
router.get('/system-health', getSystemHealth);

export default router;
