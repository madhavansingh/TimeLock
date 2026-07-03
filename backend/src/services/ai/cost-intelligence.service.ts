import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';

export class CostIntelligenceService {
  // Configurable token pricing model (USD per 1,000 tokens)
  private static PRICE_PER_1K_PROMPT = 0.0007;      // Nemotron-3 prompt cost rate
  private static PRICE_PER_1K_COMPLETION = 0.0021;  // Nemotron-3 completion cost rate

  /**
   * Logs an AI execution cost metric.
   */
  public static async logCost(
    tenantId: string | null,
    agentName: string,
    documentId: string | null,
    promptTokens: number,
    completionTokens: number,
    inferenceTimeMs: number,
    gpuUtilization: number = 45.5
  ): Promise<any> {
    const estimatedCost = 
      ((promptTokens / 1000) * this.PRICE_PER_1K_PROMPT) +
      ((completionTokens / 1000) * this.PRICE_PER_1K_COMPLETION);

    logger.info(`[CostIntelligence] Logging cost for ${agentName} (Cost: $${estimatedCost.toFixed(5)}, Tokens: ${promptTokens + completionTokens})`);

    return basePrisma.aiCostMetric.create({
      data: {
        tenantId,
        agentName,
        documentId,
        promptTokens,
        completionTokens,
        inferenceTimeMs,
        gpuUtilization,
        estimatedCost
      }
    });
  }

  /**
   * Retrieves aggregated cost reports platform-wide and partitioned by tenant.
   */
  public static async getCostSummary(tenantId?: string): Promise<any> {
    const whereClause: any = {};
    if (tenantId) whereClause.tenantId = tenantId;

    // Aggregate total costs and tokens
    const aggregates = await basePrisma.aiCostMetric.aggregate({
      where: whereClause,
      _sum: {
        estimatedCost: true,
        promptTokens: true,
        completionTokens: true,
        inferenceTimeMs: true
      },
      _avg: {
        gpuUtilization: true,
        inferenceTimeMs: true
      },
      _count: {
        metricId: true
      }
    });

    // Group by agent name
    const agentGroupings = await basePrisma.aiCostMetric.groupBy({
      where: whereClause,
      by: ['agentName'],
      _sum: {
        estimatedCost: true,
        promptTokens: true,
        completionTokens: true
      },
      _count: {
        metricId: true
      }
    });

    const agentCosts = agentGroupings.map(g => ({
      agentName: g.agentName,
      totalCost: g._sum.estimatedCost || 0,
      totalTokens: (g._sum.promptTokens || 0) + (g._sum.completionTokens || 0),
      executionCount: g._count.metricId
    }));

    return {
      totalExpenditure: aggregates._sum.estimatedCost || 0.0,
      totalTokensConsumed: (aggregates._sum.promptTokens || 0) + (aggregates._sum.completionTokens || 0),
      totalExecutions: aggregates._count.metricId,
      averageInferenceTimeMs: Math.round(aggregates._avg.inferenceTimeMs || 0),
      averageGpuUtilization: parseFloat((aggregates._avg.gpuUtilization || 0.0).toFixed(2)),
      agentDistribution: agentCosts,
      timestamp: new Date().toISOString()
    };
  }
}
