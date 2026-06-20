import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { VerificationCommandCenterService } from '../services/ai/verification-command-center.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AvccController {
  /**
   * Fetches full AVCC telemetry for dashboard visualization.
   */
  public static async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      logger.info('[AvccController] Fetching AVCC dashboard metrics');

      // 1. Fetch graph nodes and edges
      const nodes = await prisma.trustGraphNode.findMany();
      const edges = await prisma.trustGraphEdge.findMany();

      // 2. Fetch active anomalies
      const anomalies = await prisma.networkAnomaly.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });

      // 3. Fetch chain integrity assessments
      const chainIntegrity = await prisma.chainIntegrityAssessment.findMany();

      // 4. Fetch national trust ratings
      const trustRatings = await prisma.nationalTrustRating.findMany({
        orderBy: { createdAt: 'desc' }
      });

      // 4b. Fetch entity risk assessments
      const entityRisks = await prisma.entityRiskAssessment.findMany();

      // 5. Compute ratings distribution
      const ratingsDistribution = {
        AAA: 0,
        AA: 0,
        A: 0,
        BBB: 0,
        BB: 0,
        B: 0,
        C: 0
      };

      let sumTrustScore = 0;
      let sumNetworkRisk = 0;

      for (const r of trustRatings) {
        if (r.finalRating in ratingsDistribution) {
          ratingsDistribution[r.finalRating as keyof typeof ratingsDistribution]++;
        }
        sumTrustScore += r.trustScore;
        sumNetworkRisk += r.networkRiskScore;
      }

      const avgTrustScore = trustRatings.length > 0 ? Math.round(sumTrustScore / trustRatings.length) : 85;
      const avgNetworkRisk = trustRatings.length > 0 ? Math.round(sumNetworkRisk / trustRatings.length) : 15;

      // 6. Fetch live investigation feed (from national trust rating history)
      const investigationFeed = await prisma.nationalTrustRatingHistory.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15
      });

      res.status(200).json({
        data: {
          nodes,
          edges,
          anomalies,
          chainIntegrity,
          trustRatings,
          ratingsDistribution,
          avgTrustScore,
          avgNetworkRisk,
          investigationFeed,
          entityRisks
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resolves or dismisses an active network anomaly.
   */
  public static async resolveAnomaly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { resolutionNotes } = req.body;

      logger.info(`[AvccController] Resolving network anomaly: ${id}`);

      const anomaly = await prisma.networkAnomaly.findUnique({
        where: { anomalyId: id }
      });

      if (!anomaly) {
        res.status(404).json({
          data: null,
          error: { code: 'ANOMALY_NOT_FOUND', message: 'Anomaly record not found.' },
          requestId: req.headers['x-request-id'] || 'unknown'
        });
        return;
      }

      const updatedAnomaly = await prisma.networkAnomaly.update({
        where: { anomalyId: id },
        data: {
          status: 'RESOLVED',
          metadata: {
            ...(anomaly.metadata as any || {}),
            resolvedBy: req.user?.userId || 'system',
            resolutionNotes: resolutionNotes || 'Investigated and marked resolved by Notary.'
          }
        }
      });

      // Write to history
      await prisma.networkAnomalyHistory.create({
        data: {
          anomalyId: updatedAnomaly.anomalyId,
          title: updatedAnomaly.title,
          description: updatedAnomaly.description,
          severity: updatedAnomaly.severity,
          confidence: updatedAnomaly.confidence,
          entityId: updatedAnomaly.entityId,
          entityType: updatedAnomaly.entityType,
          suggestedInvestigation: updatedAnomaly.suggestedInvestigation,
          status: updatedAnomaly.status,
          metadata: updatedAnomaly.metadata || {}
        }
      });

      res.status(200).json({
        data: updatedAnomaly,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Recalculates trust graph and runs all agents for a specific property or the entire network on-demand.
   */
  public static async recalculate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.body;
      logger.info(`[AvccController] Triggering manual graph recalculation ${propertyId ? `for property ${propertyId}` : ''}`);

      const result = await VerificationCommandCenterService.orchestrate(propertyId);

      res.status(200).json({
        data: result,
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Fetches specific trust intelligence details for a citizen's property.
   */
  public static async getPropertyTrust(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { propertyId } = req.params;
      logger.info(`[AvccController] Fetching property trust intelligence details for: ${propertyId}`);

      const rating = await prisma.nationalTrustRating.findUnique({
        where: { propertyId }
      });

      const chainAssessment = await prisma.chainIntegrityAssessment.findUnique({
        where: { propertyId }
      });

      const ratingHistory = await prisma.nationalTrustRatingHistory.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'asc' },
        take: 20
      });

      res.status(200).json({
        data: {
          rating,
          chainAssessment,
          ratingHistory
        },
        error: null,
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    } catch (err) {
      next(err);
    }
  }
}
