import { prisma, basePrisma } from '../config/db';
import crypto from 'crypto';

// Numeric values for clearance hierarchy comparisons
export const CLASSIFICATION_VALUES: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  COMMERCIAL_CONFIDENTIAL: 2,
  CONFIDENTIAL: 3,
  SECRET: 4,
  TOP_SECRET: 5,
};

export interface PolicyDecision {
  evaluationId: string;
  decision: 'ALLOW' | 'DENY';
  matchingRules: string[];
  deniedRules: string[];
  evaluationTimeMs: number;
  policyVersion: string;
  reason: string;
  supportReference: string;
}

// In-memory cache for policy rules with tenant partitioning, matching distributed cache interfaces
class PolicyCache {
  private cache = new Map<string, { rules: any[]; timestamp: number }>();
  private TTL_MS = 60 * 1000; // 1 minute default TTL

  private hitCount = 0;
  private missCount = 0;

  get(tenantId: string): any[] | null {
    const cached = this.cache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      this.hitCount++;
      return cached.rules;
    }
    this.missCount++;
    return null;
  }

  set(tenantId: string, rules: any[]): void {
    this.cache.set(tenantId, { rules, timestamp: Date.now() });
  }

  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  clear(): void {
    this.cache.clear();
  }

  getMetrics() {
    const total = this.hitCount + this.missCount;
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: total > 0 ? this.hitCount / total : 1.0
    };
  }
}

export const policyCache = new PolicyCache();

export class PolicyService {
  /**
   * Evaluates an authorization request against active ABAC policy rules,
   * classifications, residency constraints, and legal holds.
   */
  static async evaluate(
    subject: { userId?: string; role: string; department?: string; securityClearance: string; emergencyOverrideActive?: boolean },
    resource: { id?: string; type: string; classification: string; ownerId?: string; department?: string; residency?: any; isLocked?: boolean },
    action: string,
    tenantId: string,
    correlationId?: string,
    requestId?: string
  ): Promise<PolicyDecision> {
    const startTime = Date.now();
    const evaluationId = crypto.randomUUID();
    
    let decision: 'ALLOW' | 'DENY' = 'ALLOW';
    const matchingRules: string[] = [];
    const deniedRules: string[] = [];
    let reason = 'Access granted by default policy.';
    const policyVersion = 'v1.0.0';

    // GCPX-AUTH-RULE-101: Absolute Legal Hold check
    if (resource.isLocked && ['document:write', 'document:delete', 'document:sign', 'document:transfer'].includes(action)) {
      decision = 'DENY';
      deniedRules.push('GCPX-AUTH-RULE-101');
      reason = 'Access denied. The requested resource has an active legal or judicial hold placed upon it.';
      return this.finalizeEvaluation(startTime, evaluationId, decision, matchingRules, deniedRules, reason, policyVersion, tenantId, subject.userId, resource.id, resource.type, action, correlationId, requestId);
    }

    // GCPX-AUTH-RULE-102: Security Clearance check (Clearance must be >= Classification)
    const subjectClearance = CLASSIFICATION_VALUES[subject.securityClearance] ?? 0;
    const resourceClassification = CLASSIFICATION_VALUES[resource.classification] ?? 0;

    if (subjectClearance < resourceClassification && !subject.emergencyOverrideActive) {
      decision = 'DENY';
      deniedRules.push('GCPX-AUTH-RULE-102');
      reason = `Access denied. Requester clearance level (${subject.securityClearance}) is insufficient for resource classification (${resource.classification}).`;
      return this.finalizeEvaluation(startTime, evaluationId, decision, matchingRules, deniedRules, reason, policyVersion, tenantId, subject.userId, resource.id, resource.type, action, correlationId, requestId);
    } else if (subject.emergencyOverrideActive) {
      matchingRules.push('GCPX-AUTH-RULE-102-OVERRIDE');
    }

    // Retrieve active policy rules from Cache or Database
    let rules = policyCache.get(tenantId);
    if (!rules) {
      rules = await basePrisma.policyRule.findMany({
        where: { tenantId, isActive: true }
      });
      policyCache.set(tenantId, rules);
    }

    // Evaluate database-defined ABAC policies
    for (const rule of rules) {
      // Check if the action matches the rule's scope
      const actionMatches = rule.actions.includes(action) || rule.actions.includes('*');
      if (!actionMatches) continue;

      // Evaluate classifications
      const classificationMatches = rule.classifications.includes(resource.classification);
      if (rule.classifications.length > 0 && !classificationMatches) continue;

      // Evaluate dynamic conditions (ABAC JSON expressions)
      let conditionPassed = true;
      if (rule.conditions && typeof rule.conditions === 'object') {
        const cond = rule.conditions as any;
        
        // Match department constraint
        if (cond.requireSameDepartment && subject.department !== resource.department) {
          conditionPassed = false;
        }

        // Match owner constraint (RBAC/ABAC boundary)
        if (cond.requireOwner && subject.userId !== resource.ownerId && subject.role !== 'ADMIN') {
          conditionPassed = false;
        }

        // Match time-based bounds
        if (cond.timeWindow) {
          const currentHour = new Date().getHours();
          if (currentHour < cond.timeWindow.start || currentHour > cond.timeWindow.end) {
            conditionPassed = false;
          }
        }
      }

      if (conditionPassed) {
        if (rule.effect === 'DENY') {
          decision = 'DENY';
          deniedRules.push(rule.ruleId);
          reason = `Access denied by policy rule: ${rule.name}.`;
          break;
        } else {
          matchingRules.push(rule.ruleId);
        }
      }
    }

    return this.finalizeEvaluation(startTime, evaluationId, decision, matchingRules, deniedRules, reason, policyVersion, tenantId, subject.userId, resource.id, resource.type, action, correlationId, requestId);
  }

  private static async finalizeEvaluation(
    startTime: number,
    evaluationId: string,
    decision: 'ALLOW' | 'DENY',
    matchingRules: string[],
    deniedRules: string[],
    reason: string,
    policyVersion: string,
    tenantId: string,
    userId?: string,
    resourceId?: string,
    resourceType?: string,
    action?: string,
    correlationId?: string,
    requestId?: string
  ): Promise<PolicyDecision> {
    const evaluationTimeMs = Date.now() - startTime;
    const supportReference = `GCPX-AUTH-REF-${evaluationId.split('-')[0].toUpperCase()}`;

    // Log the evaluation as an immutable audit record in the database
    try {
      await basePrisma.policyEvaluationLog.create({
        data: {
          evaluationId,
          tenantId,
          requestId: requestId || 'unknown',
          correlationId: correlationId || 'unknown',
          userId: userId || 'anonymous',
          action: action || 'unknown',
          resourceId: resourceId || 'unknown',
          resourceType: resourceType || 'unknown',
          decision,
          policyVersion,
          matchingRules,
          deniedRules,
          evaluationTimeMs,
          reason
        }
      });
    } catch (err) {
      console.error('Failed to write PolicyEvaluationLog to database:', err);
    }

    return {
      evaluationId,
      decision,
      matchingRules,
      deniedRules,
      evaluationTimeMs,
      policyVersion,
      reason,
      supportReference,
    };
  }

  /**
   * Invalidates cached policies for a tenant (called when policy rules are modified).
   */
  static invalidateCache(tenantId: string): void {
    policyCache.invalidate(tenantId);
  }

  /**
   * Simulates a staged policy against historical logs.
   */
  static async simulatePolicy(
    tenantId: string,
    stagedPolicy: { rules: any[] },
    createdBy: string,
    historyLimit: number = 1000
  ): Promise<any> {
    const startTime = Date.now();
    
    // Fetch historical policy evaluation logs
    const history = await basePrisma.policyEvaluationLog.findMany({
      where: { tenantId },
      orderBy: { timestamp: 'desc' },
      take: historyLimit
    });

    let blockedDelta = 0;
    let allowedDelta = 0;
    const impactDetails: any[] = [];

    // Simulate each historical evaluation using the staged policy rules
    for (const log of history) {
      let simulatedDecision: 'ALLOW' | 'DENY' = 'ALLOW';
      
      // Absolute Legal Hold mock evaluation for simulation
      if (log.action.includes('write') || log.action.includes('delete') || log.action.includes('sign')) {
        // Evaluate against staged rules
        for (const rule of stagedPolicy.rules) {
          if (!rule.isActive) continue;
          const actionMatches = rule.actions.includes(log.action) || rule.actions.includes('*');
          if (actionMatches && rule.effect === 'DENY') {
            simulatedDecision = 'DENY';
            break;
          }
        }
      }

      const decisionChanged = simulatedDecision !== log.decision;
      if (decisionChanged) {
        if (simulatedDecision === 'DENY') {
          blockedDelta++;
        } else {
          allowedDelta++;
        }
        impactDetails.push({
          requestId: log.requestId,
          userId: log.userId,
          action: log.action,
          previousDecision: log.decision,
          simulatedDecision
        });
      }
    }

    const impactReport = {
      simulationTimeMs: Date.now() - startTime,
      totalEvaluationsSimulated: history.length,
      blockedDelta,
      allowedDelta,
      impactDetails
    };

    // Save simulation record
    const simulation = await basePrisma.policySimulation.create({
      data: {
        tenantId,
        stagedPolicy: stagedPolicy as any,
        transactionsRun: history.length,
        blockedDelta,
        allowedDelta,
        impactReport: impactReport as any,
        createdBy
      }
    });

    return simulation;
  }
}
