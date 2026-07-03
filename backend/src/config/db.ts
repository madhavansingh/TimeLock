import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { config } from './env';

export interface TenantContext {
  tenantId: string;
  residency?: {
    country: string;
    state: string;
    district: string;
  };
  clearance?: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export const basePrisma = new PrismaClient({
  log: config.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: { url: config.databaseUrl },
  },
});

const TENANT_AWARE_MODELS = [
  'user',
  'document',
  'securityIncident',
  'connectorConfig',
  'digitalTwin',
  'complianceRecord',
  'scheduledJob',
  'apiClient',
  'configKey',
  'policyRule',
  'featureFlag',
  'costMetric',
  'capacityMetric',
  'policySimulation',
  'aiDecisionAudit',
  'hitlAction',
  'aiCostMetric',
  'executiveBriefing',
  'feedbackLearningDataset',
  'simulationResult',
  'intelligenceInsight'
];

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const modelName = model.charAt(0).toLowerCase() + model.slice(1);
        if (!TENANT_AWARE_MODELS.includes(modelName)) {
          return query(args);
        }

        const context = tenantContextStorage.getStore();
        const tenantId = context?.tenantId || 'sovereign-tenant';

        const customArgs = args as any;
        customArgs.where = customArgs.where || {};

        if ([
          'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 
          'findMany', 'count', 'aggregate', 'groupBy',
          'update', 'updateMany', 'delete', 'deleteMany', 'upsert'
        ].includes(operation)) {
          
          if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
            const result = await query(args);
            if (result && (result as any).tenantId !== tenantId) {
              if (operation === 'findUniqueOrThrow') {
                throw new Error(`Record not found or access denied for tenant: ${tenantId}`);
              }
              return null;
            }
            return result;
          }

          customArgs.where.tenantId = tenantId;
        }

        if (operation === 'create') {
          customArgs.data = customArgs.data || {};
          customArgs.data.tenantId = tenantId;
        } else if (operation === 'createMany') {
          if (Array.isArray(customArgs.data)) {
            customArgs.data.forEach((item: any) => {
              item.tenantId = tenantId;
            });
          } else {
            customArgs.data = customArgs.data || {};
            customArgs.data.tenantId = tenantId;
          }
        } else if (operation === 'upsert') {
          customArgs.create = customArgs.create || {};
          customArgs.create.tenantId = tenantId;
          customArgs.update = customArgs.update || {};
          customArgs.update.tenantId = tenantId;
          customArgs.where.tenantId = tenantId;
        }

        return query(customArgs);
      }
    }
  }
});
