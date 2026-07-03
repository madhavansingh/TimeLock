// ⚠️  env.ts MUST be the very first import — it loads dotenv and validates
//    all required environment variables before any service reads process.env.
import './config/env';

import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/db';

import { ConnectorRegistry } from './services/integration/connector.registry';
import { SchemaRegistryService } from './services/integration/schema-registry.service';
import { OutboxWorker } from './services/integration/outbox.worker';
import { 
  GovernmentRegistryConnector,
  IdentityFederationConnector,
  DigitalLockerConnector,
  ESignConnector,
  CourtManagementConnector,
  BankingPlatformConnector,
  InsuranceProviderConnector,
  NotificationConnector,
  CloudStorageConnector,
  PaymentGatewayConnector
} from './services/integration/connectors/specialized-connectors';

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

  // 1.1 Initialize EIF: Seed schemas, register connectors, and start outbox worker
  try {
    await SchemaRegistryService.seedRegistry();

    const govRegistry = new GovernmentRegistryConnector();
    const idFed = new IdentityFederationConnector();
    const digLocker = new DigitalLockerConnector();
    const eSign = new ESignConnector();
    const courtSys = new CourtManagementConnector();
    const bankPlatform = new BankingPlatformConnector();
    const insProvider = new InsuranceProviderConnector();
    const notification = new NotificationConnector();
    const cloudStorage = new CloudStorageConnector();
    const payGateway = new PaymentGatewayConnector();

    await ConnectorRegistry.register(govRegistry);
    await ConnectorRegistry.register(idFed);
    await ConnectorRegistry.register(digLocker);
    await ConnectorRegistry.register(eSign);
    await ConnectorRegistry.register(courtSys);
    await ConnectorRegistry.register(bankPlatform);
    await ConnectorRegistry.register(insProvider);
    await ConnectorRegistry.register(notification);
    await ConnectorRegistry.register(cloudStorage);
    await ConnectorRegistry.register(payGateway);

    // Set lifecycle status to ACTIVE in database
    await ConnectorRegistry.updateLifecycle('GOVERNMENT_REGISTRY', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('IDENTITY_FEDERATION', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('DIGITAL_LOCKER', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('E_SIGN_PROVIDER', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('COURT_SYSTEM', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('BANKING_PLATFORM', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('INSURANCE_PROVIDER', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('NOTIFICATION_PROVIDER', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('CLOUD_STORAGE', 'ACTIVE');
    await ConnectorRegistry.updateLifecycle('PAYMENT_GATEWAY', 'ACTIVE');

    // Start background outbox worker polling loop
    OutboxWorker.start();
    logger.info('Enterprise Integration Fabric (EIF v2.0) initialized successfully.');
  } catch (err: any) {
    logger.error('Failed to initialize EIF v2.0:', err);
  }

  // 2. Start HTTP server
  const server = app.listen(config.port, "0.0.0.0", () => {
    logger.info('╔══════════════════════════════════════════════════╗');
    logger.info('║   Legal TimeLock Network (LTN) — Backend API     ║');
    logger.info(`║   Listening : http://0.0.0.0:${config.port}/v1`.padEnd(51) + '║');
    logger.info(`║   Env       : ${config.nodeEnv}`.padEnd(51) + '║');
    logger.info(`║   Started   : ${new Date().toISOString()}`.padEnd(51) + '║');
    logger.info('╚══════════════════════════════════════════════════╝');
  });

  // 3. Graceful shutdown — finish in-flight requests before closing
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received — shutting down gracefully...`);
    
    // Stop outbox polling worker
    OutboxWorker.stop();

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
