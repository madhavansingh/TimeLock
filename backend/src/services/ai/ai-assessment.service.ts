import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { FraudRiskAgentService, FraudRiskInput } from './fraud-risk-agent.service';
import { TrustScoreAgentService, TrustScoreInput } from './trust-score-agent.service';
import { EvidenceRecommendationAgentService } from './evidence-recommendation-agent.service';

export class AiAssessmentService {
  /**
   * Triggers the AI intelligence layer analysis asynchronously.
   * Logs errors but does not block the main process.
   */
  public static async triggerRegeneration(documentId: string, triggerEvent: string): Promise<void> {
    // Run AI analysis and then trigger Digital Twin recalculation
    this.runAnalysis(documentId, triggerEvent)
      .then(() => {
        try {
          const { AutonomousVerificationEngine } = require('./ave.service');
          AutonomousVerificationEngine.triggerRecalculation(documentId, triggerEvent);
        } catch (aveErr: any) {
          logger.error(`[AiAssessmentService] Failed to trigger AVE recalculation: ${aveErr.message}`);
        }
      })
      .catch(err => {
        logger.error(`[AiAssessmentService] Async analysis failed for document ${documentId}: ${err.message}`);
      });
  }

  /**
   * Performs the database checks and LLM execution.
   */
  public static async runAnalysis(documentId: string, triggerEvent: string): Promise<any> {
    logger.info(`[AiAssessmentService] Starting analysis for document ${documentId} (Trigger: ${triggerEvent})`);

    // 1. Fetch complete document state
    const doc = await prisma.document.findUnique({
      where: { documentId },
      include: {
        metadata: true,
        verificationCase: {
          include: { evidence: true }
        },
        assignedNotary: true
      }
    });

    if (!doc) {
      throw new Error('Document registry record not found.');
    }

    // Fetch ownership history
    const ownershipHistory = await prisma.ownershipRecord.findMany({
      where: { documentId },
      orderBy: { startDate: 'asc' }
    });

    // Parse VPL checklist & challenges if they exist
    let checklist: any[] = [];
    let challenges: any[] = [];
    let evidenceCount = 0;
    let baseTrustScore = 100;

    if (doc.verificationCase) {
      baseTrustScore = doc.verificationCase.trustScore;
      evidenceCount = doc.verificationCase.evidence.length;
      try {
        checklist = typeof doc.verificationCase.checklist === 'string'
          ? JSON.parse(doc.verificationCase.checklist)
          : doc.verificationCase.checklist || [];
      } catch {
        checklist = [];
      }
      try {
        challenges = typeof doc.verificationCase.challenges === 'string'
          ? JSON.parse(doc.verificationCase.challenges)
          : doc.verificationCase.challenges || [];
      } catch {
        challenges = [];
      }
    }

    // 2. Prepare Agent Inputs
    const fraudInput: FraudRiskInput = {
      documentId: doc.documentId,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      metadata: doc.metadata,
      ownershipHistory,
      challenges,
      evidenceCount
    };

    const trustInput: TrustScoreInput = {
      documentId: doc.documentId,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      hasOnchainPda: !!doc.onchainPda,
      assignedNotary: doc.assignedNotary ? {
        name: doc.assignedNotary.name,
        isAccredited: doc.assignedNotary.isAccredited,
        dscCertificateSerial: doc.assignedNotary.dscCertificateSerial
      } : null,
      checklist,
      challenges,
      evidenceCount,
      baseTrustScore
    };

    // 3. Execute agents in parallel
    const [fraudResult, trustResult] = await Promise.all([
      FraudRiskAgentService.assess(fraudInput),
      TrustScoreAgentService.explain(trustInput)
    ]);

    // Execute Evidence Recommendation Agent
    try {
      await EvidenceRecommendationAgentService.runAnalysis(documentId);
    } catch (err: any) {
      logger.warn(`[AiAssessmentService] EvidenceRecommendationAgent failed for ${documentId}: ${err.message}`);
    }

    // 4. Persist in database inside a Transaction
    logger.info(`[AiAssessmentService] Persisting AI Assessment for document ${documentId}`);
    
    await prisma.$transaction(async (tx) => {
      // Find existing assessment
      const existing = await tx.aiAssessment.findUnique({
        where: { documentId }
      });

      if (existing) {
        // Push existing to history first
        await tx.aiAssessmentHistory.create({
          data: {
            documentId: doc.documentId,
            assessmentId: existing.assessmentId,
            riskScore: existing.riskScore,
            riskLevel: existing.riskLevel,
            riskFactors: existing.riskFactors || [],
            trustScore: existing.trustScore,
            trustExplanation: existing.trustExplanation,
            positiveFactors: existing.positiveFactors || [],
            negativeFactors: existing.negativeFactors || [],
            scoreBreakdown: existing.scoreBreakdown || {},
            recommendations: existing.recommendations || [],
            confidenceScore: existing.confidenceScore,
            triggerEvent: triggerEvent
          }
        });

        // Update the current active assessment
        await tx.aiAssessment.update({
          where: { assessmentId: existing.assessmentId },
          data: {
            riskScore: fraudResult.riskScore,
            riskLevel: fraudResult.riskLevel,
            riskFactors: fraudResult.riskFactors,
            trustScore: trustResult.scoreBreakdown.registryConsistency === 100 &&
                        trustResult.scoreBreakdown.evidenceCompleteness === 100 &&
                        trustResult.scoreBreakdown.blockchainValidation === 100
                        ? 100 // Scale to 100 if all categories are perfect
                        : Math.min(100, Math.round(baseTrustScore)),
            trustExplanation: trustResult.trustScoreExplanation,
            positiveFactors: trustResult.positiveFactors,
            negativeFactors: trustResult.negativeFactors,
            scoreBreakdown: trustResult.scoreBreakdown,
            recommendations: fraudResult.recommendations,
            confidenceScore: fraudResult.confidenceScore
          }
        });
      } else {
        // Create new active assessment
        await tx.aiAssessment.create({
          data: {
            documentId: doc.documentId,
            riskScore: fraudResult.riskScore,
            riskLevel: fraudResult.riskLevel,
            riskFactors: fraudResult.riskFactors,
            trustScore: Math.round(baseTrustScore),
            trustExplanation: trustResult.trustScoreExplanation,
            positiveFactors: trustResult.positiveFactors,
            negativeFactors: trustResult.negativeFactors,
            scoreBreakdown: trustResult.scoreBreakdown,
            recommendations: fraudResult.recommendations,
            confidenceScore: fraudResult.confidenceScore
          }
        });
      }

      // Also create AI_ASSESSMENT_COMPLETED VerificationEvent if it does not exist yet
      const existingEvent = await tx.verificationEvent.findFirst({
        where: { documentId: doc.documentId, eventType: 'AI_ASSESSMENT_COMPLETED' }
      });
      if (!existingEvent) {
        await tx.verificationEvent.create({
          data: {
            documentId: doc.documentId,
            eventType: 'AI_ASSESSMENT_COMPLETED',
            actorLabel: 'Nemotron AI Analyst'
          }
        });
      }
    });

    logger.info(`[AiAssessmentService] Successfully committed assessment to database for document ${documentId}`);
    return { fraudResult, trustResult };
  }
}
