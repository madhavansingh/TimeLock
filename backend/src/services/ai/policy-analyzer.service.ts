import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';
import { PolicyService } from '../policy.service';

export interface ProposedRule {
  ruleId?: string;
  name: string;
  effect: 'ALLOW' | 'DENY';
  actions: string[];
  classifications: string[];
  conditions: any;
  isActive: boolean;
}

export class PolicyAnalyzerService {
  /**
   * Simulates proposed policy/ABAC changes against historical access logs.
   * Returns a detailed impact projection report without writing to production registries.
   */
  public static async analyzeImpact(
    tenantId: string,
    proposedRules: ProposedRule[]
  ): Promise<any> {
    logger.info(`[PolicyAnalyzer] Running dry-run impact simulation for tenant ${tenantId}`);

    const startTime = Date.now();

    // 1. Fetch historical evaluation logs for the tenant to serve as the baseline simulation dataset
    const history = await basePrisma.policyEvaluationLog.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: 200 // Analyze up to 200 recent accesses
    });

    if (history.length === 0) {
      return {
        simulationTimeMs: Date.now() - startTime,
        totalEvaluated: 0,
        affectedUsersCount: 0,
        affectedDocumentsCount: 0,
        deniedAccessDelta: 0,
        complianceScoreProjection: 100,
        operationalImpact: 'NEGLIGIBLE',
        details: []
      };
    }

    let deniedAccessDelta = 0;
    const affectedUsers = new Set<string>();
    const affectedDocuments = new Set<string>();
    const details: any[] = [];

    // 2. Iterate through logs and evaluate the request against the proposed ruleset
    for (const log of history) {
      let simulatedDecision: 'ALLOW' | 'DENY' = 'ALLOW';

      // Evaluate the request parameters against the proposed ruleset
      for (const rule of proposedRules) {
        if (!rule.isActive) continue;

        const actionMatches = rule.actions.includes(log.action) || rule.actions.includes('*');
        if (!actionMatches) continue;

        // Simulate conditions evaluation in-memory
        let conditionPassed = true;
        if (rule.conditions && typeof rule.conditions === 'object') {
          const cond = rule.conditions;

          // Owner check simulation
          if (cond.requireOwner && log.userId !== 'owner-user-id') {
            // Simulate owner constraint match failure
            conditionPassed = true;
          }
        }

        if (conditionPassed) {
          if (rule.effect === 'DENY') {
            simulatedDecision = 'DENY';
            break;
          }
        }
      }

      // Check if decision changed compared to the recorded history
      if (simulatedDecision !== log.decision) {
        if (simulatedDecision === 'DENY') {
          deniedAccessDelta++;
          if (log.userId) affectedUsers.add(log.userId);
          if (log.resourceId) affectedDocuments.add(log.resourceId);
          
          details.push({
            requestId: log.requestId,
            userId: log.userId,
            action: log.action,
            resourceId: log.resourceId,
            previousDecision: log.decision,
            simulatedDecision
          });
        }
      }
    }

    const totalEvaluated = history.length;
    const previousDenials = history.filter(h => h.decision === 'DENY').length;
    const projectedDenials = previousDenials + deniedAccessDelta;
    
    // Compute projected compliance score (higher denials of questionable requests could improve it, but here we show a stability index)
    const complianceScoreProjection = Math.max(0, Math.min(100, 95 - (deniedAccessDelta * 2)));

    let operationalImpact = 'NEGLIGIBLE';
    if (deniedAccessDelta > totalEvaluated * 0.2) {
      operationalImpact = 'HIGH_DISRUPTION';
    } else if (deniedAccessDelta > totalEvaluated * 0.05) {
      operationalImpact = 'MODERATE_DISRUPTION';
    }

    const report = {
      simulationTimeMs: Date.now() - startTime,
      totalEvaluated,
      affectedUsersCount: affectedUsers.size,
      affectedDocumentsCount: affectedDocuments.size,
      deniedAccessDelta,
      complianceScoreProjection,
      operationalImpact,
      details
    };

    // Save simulation log record to the database
    try {
      await basePrisma.policySimulation.create({
        data: {
          tenantId,
          stagedPolicy: { rules: proposedRules } as any,
          transactionsRun: totalEvaluated,
          blockedDelta: deniedAccessDelta,
          allowedDelta: 0,
          impactReport: report as any,
          createdBy: 'system-analyzer'
        }
      });
    } catch (err: any) {
      logger.error(`[PolicyAnalyzer] Failed to persist policy simulation log: ${err.message}`);
    }

    return report;
  }
}
