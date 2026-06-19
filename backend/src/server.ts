// ⚠️  env.ts MUST be the very first import — it loads dotenv and validates
//    all required environment variables before any service reads process.env.
import './config/env';

import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/db';

// ---------------------------------------------------------------------------
// Graceful startup sequence
// ---------------------------------------------------------------------------
async function start(): Promise<void> {
  // 1. Verify database is reachable before opening the HTTP port
  try {
    await prisma.$connect();
    logger.info('Database connection established.');
  } catch (err) {
    logger.error('Failed to connect to the database. Server will not start.', {
      error: (err as Error).message,
    });
    process.exit(1);
  }

  // 2. Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info('╔══════════════════════════════════════════════════╗');
    logger.info('║   Legal TimeLock Network (LTN) — Backend API     ║');
    logger.info(`║   Listening : http://localhost:${config.port}/v1`.padEnd(51) + '║');
    logger.info(`║   Env       : ${config.nodeEnv}`.padEnd(51) + '║');
    logger.info(`║   Started   : ${new Date().toISOString()}`.padEnd(51) + '║');
    logger.info('╚══════════════════════════════════════════════════╝');
  });

  // 3. Graceful shutdown — finish in-flight requests before closing
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed. Disconnecting database...');
      await prisma.$disconnect();
      logger.info('Database disconnected. Goodbye.');
      process.exit(0);
    });

    // Force-kill if still alive after 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // 4. Catch unhandled promise rejections — log and exit rather than swallowing
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection — exiting.', {
      reason: String(reason),
    });
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — exiting.', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

start();
