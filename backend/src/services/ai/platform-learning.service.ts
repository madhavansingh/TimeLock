import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';

export class PlatformLearningService {
  /**
   * Captures high-integrity feedback (approved/rejected cases, overrides) for the learning dataset.
   */
  public static async captureFeedback(
    tenantId: string | null,
    sourceType: string,
    sourceId: string,
    features: any,
    label: any,
    notes?: string
  ): Promise<any> {
    logger.info(`[PlatformLearning] Capturing learning feedback from ${sourceType} (${sourceId})`);

    return basePrisma.feedbackLearningDataset.create({
      data: {
        tenantId,
        sourceType,
        sourceId,
        features: features || {},
        label: label || {},
        notes: notes || null
      }
    });
  }

  /**
   * Retrieves summary statistics of the captured learning datasets.
   */
  public static async getDatasetMetrics(): Promise<any> {
    const totalCount = await basePrisma.feedbackLearningDataset.count();
    
    // Group by source type
    const groupings = await basePrisma.feedbackLearningDataset.groupBy({
      by: ['sourceType'],
      _count: {
        feedbackId: true
      }
    });

    const distributions = groupings.reduce((acc: any, curr) => {
      acc[curr.sourceType] = curr._count.feedbackId;
      return acc;
    }, {});

    return {
      totalSamples: totalCount,
      distribution: distributions,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Extracts a structured learning dataset batch for prompt fine-tuning or evaluation.
   */
  public static async exportDataset(limit = 1000): Promise<any[]> {
    return basePrisma.feedbackLearningDataset.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
