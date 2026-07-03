import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';
import { CostIntelligenceService } from './cost-intelligence.service';
import { ForecastingService } from './forecasting.service';

export class BriefingService {
  /**
   * Synthesizes and saves a new Executive Briefing summarizing platform governance, risks, and forecasts.
   */
  public static async generateBriefing(tenantId: string | null, scope: 'DAILY' | 'WEEKLY' | 'ON_DEMAND', generatedBy: string): Promise<any> {
    logger.info(`[BriefingService] Synthesizing ${scope} executive intelligence briefing...`);

    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;

    // 1. Calculate the National Trust Index
    // Baseline is 95, decreased by active security incidents and high-risk documents
    const totalIncidents = await basePrisma.securityIncident.count({ where: whereClause });
    const highRiskDocs = await basePrisma.document.count({
      where: {
        ...whereClause,
        status: 'DISPUTED'
      }
    });

    const nationalTrustIndex = Math.max(0, Math.min(100, 96 - (totalIncidents * 2) - (highRiskDocs * 3)));
    const citizenSatisfaction = Math.max(0, Math.min(100, 92 - (highRiskDocs * 1)));

    // 2. Aggregate AI Effectiveness
    const costSummary = await CostIntelligenceService.getCostSummary(tenantId || undefined);
    const aiEffectiveness = {
      totalExecutions: costSummary.totalExecutions,
      averageInferenceTimeMs: costSummary.averageInferenceTimeMs,
      gpuUtilization: costSummary.averageGpuUtilization,
      averageConfidence: 91 // baseline average confidence score
    };

    // 3. Collect Forecasts
    const forecastItems = await ForecastingService.getForecasts(tenantId || undefined);
    const costForecast = forecastItems.find(f => f.metricName === 'AI_COST_EXHAUSTION');
    const capacityForecast = forecastItems.find(f => f.metricName === 'STORAGE_EXHAUSTION');

    // 4. Formulate Strategic Recommendations
    const recommendations: string[] = [];
    if (highRiskDocs > 0) {
      recommendations.push(`Urgent: Allocate backup notaries to resolve ${highRiskDocs} active ownership disputes in Pune District.`);
    }
    if (costForecast && costForecast.daysToSaturate > 0 && costForecast.daysToSaturate <= 60) {
      recommendations.push(`AI budget limit exhaustion projected within ${costForecast.daysToSaturate} days. Enable strict prompt caching.`);
    }
    if (totalIncidents > 0) {
      recommendations.push(`Security SOC alerts detected. Review rate-limit parameters on federated identity gateways.`);
    }
    if (recommendations.length === 0) {
      recommendations.push('Platform operating with maximum stability. No critical interventions required.');
    }

    // 5. Structure Briefing JSON Payload
    const briefingContent = {
      indices: {
        nationalTrustIndex,
        regionalRiskIndex: totalIncidents > 0 ? 'MODERATE_RISK' : 'LOW_RISK',
        citizenSatisfaction,
        blockchainHealth: 100,
        operationalEfficiency: 94
      },
      aiMetrics: aiEffectiveness,
      costProjections: {
        totalCost: costSummary.totalExpenditure,
        daysToExhaustBudget: costForecast ? costForecast.daysToSaturate : -1,
        projectedCost30Days: costForecast ? costForecast.projectedValue30Days : 0.0
      },
      capacityForecasts: {
        storageUsedGb: capacityForecast ? capacityForecast.currentValue : 0.0,
        daysToExhaustStorage: capacityForecast ? capacityForecast.daysToSaturate : -1
      },
      strategicRecommendations: recommendations,
      timestamp: new Date().toISOString()
    };

    // 6. Persist to Database
    return basePrisma.executiveBriefing.create({
      data: {
        tenantId,
        scope,
        briefingContent: briefingContent as any,
        generatedBy
      }
    });
  }

  /**
   * Retrieves the most recent briefing for a tenant.
   */
  public static async getLatestBriefing(tenantId?: string): Promise<any | null> {
    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;

    return basePrisma.executiveBriefing.findFirst({
      where: whereClause,
      orderBy: { timestamp: 'desc' }
    });
  }

  /**
   * Lists all historical briefings.
   */
  public static async getBriefingHistory(tenantId?: string, limit = 20): Promise<any[]> {
    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;

    return basePrisma.executiveBriefing.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
}
