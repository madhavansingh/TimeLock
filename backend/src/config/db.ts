import { PrismaClient } from '@prisma/client';
import { config } from './env';

export const prisma = new PrismaClient({
  log: config.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: { url: config.databaseUrl },
  },
});

