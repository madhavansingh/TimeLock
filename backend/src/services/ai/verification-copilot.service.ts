import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { ConflictInvestigatorAgentService, ConflictInvestigatorInput } from './conflict-investigator-agent.service';
import { RegistrationPredictorAgentService, RegistrationPredictorInput } from './registration-predictor-agent.service';
import { CrossExaminationAgentService, CrossExaminationInput } from './cross-examination-agent.service';
import { DecisionCopilotAgentService, DecisionCopilotInput } from './decision-copilot-agent.service';

export class VerificationCopilotService {
  /**
   * Triggers the copilot generation asynchronously.
   */
  public static async triggerRegeneration(documentId: string, triggerEvent: string): Promise<void> {
    this.runCopilot(documentId, triggerEvent).catch(err => {
      logger.error(`[VerificationCopilotService] Async copilot execution failed for document ${documentId}: ${err.message}`);
    });
  }

  /**
   * Runs all 4 AI agents sequentially and persists results in PostgreSQL inside a transaction.
   */
  public static async runCopilot(documentId: string, triggerEvent: string): Promise<any> {
    logger.info(`[VerificationCopilotService] Running AI Copilot for document ${documentId} (Trigger: ${triggerEvent})`);

    // 1. Fetch document state
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
      throw new Error(`Document record not found for ID: ${documentId}`);
    }

    // Fetch ownership history
    const ownershipHistory = await prisma.ownershipRecord.findMany({
      where: { documentId },
      orderBy: { startDate: 'asc' }
    });

    // Detect database overlaps / conflicts
    const activeConflicts: any[] = [];
    if (doc.metadata) {
      if (doc.metadata.surveyNumber) {
        const matches = await prisma.documentMetadata.findMany({
          where: { surveyNumber: doc.metadata.surveyNumber, documentId: { not: documentId } }
        });
        for (const m of matches) {
          activeConflicts.push({ field: 'surveyNumber', value: doc.metadata.surveyNumber, matchId: m.documentId });
        }
      }
      if (doc.metadata.propertyId) {
        const matches = await prisma.documentMetadata.findMany({
          where: { propertyId: doc.metadata.propertyId, documentId: { not: documentId } }
        });
        for (const m of matches) {
          activeConflicts.push({ field: 'propertyId', value: doc.metadata.propertyId, matchId: m.documentId });
        }
      }
      if (doc.metadata.registrationNumber) {
        const matches = await prisma.documentMetadata.findMany({
          where: { registrationNumber: doc.metadata.registrationNumber, documentId: { not: documentId } }
        });
        for (const m of matches) {
          activeConflicts.push({ field: 'registrationNumber', value: doc.metadata.registrationNumber, matchId: m.documentId });
        }
      }
    }

    // Parse VPL checklist & challenges
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

    // Compute input parameters
    const evidenceCompleteness = Math.min(100, Math.round((evidenceCount / 3) * 100));
    const registryConsistency = Math.max(0, 100 - activeConflicts.length * 30);
    const blockers = challenges.filter(c => !c.resolved).map(c => c.field as string);

    // ==========================================
    // AGENT 1: PROPERTY CONFLICT INVESTIGATOR
    // ==========================================
    const conflictInput: ConflictInvestigatorInput = {
      documentId,
      title: doc.title,
      type: doc.type,
      status: doc.status,
      metadata: doc.metadata,
      ownershipHistory,
      activeConflicts
    };
    const conflictResult = await ConflictInvestigatorAgentService.assess(conflictInput);

    // ==========================================
    // AGENT 2: REGISTRATION SUCCESS PREDICTOR
    // ==========================================
    const predictorInput: RegistrationPredictorInput = {
      documentId,
      trustScore: baseTrustScore,
      evidenceCompleteness,
      conflictScore: conflictResult.conflictScore,
      isNotaryAccredited: doc.assignedNotary?.isAccredited ?? true,
      registryConsistency,
      blockers: blockers.length > 0 ? blockers : ['None']
    };
    const predictionResult = await RegistrationPredictorAgentService.assess(predictorInput);

    // ==========================================
    // AGENT 3: AI CROSS-EXAMINATION AGENT
    // ==========================================
    const crossExamInput: CrossExaminationInput = {
      documentId,
      title: doc.title,
      type: doc.type,
      metadata: doc.metadata,
      ownershipHistory,
      findings: conflictResult.findings,
      blockers: blockers.length > 0 ? blockers : ['None']
    };
    const crossExamResult = await CrossExaminationAgentService.assess(crossExamInput);

    // ==========================================
    // AGENT 4: AI DECISION COPILOT
    // ==========================================
    const checklistPassedCount = checklist.filter(item => item.status === 'PASSED').length;
    const checklistTotalCount = checklist.length;
    const copilotInput: DecisionCopilotInput = {
      documentId,
      trustScore: baseTrustScore,
      riskScore: 100 - baseTrustScore, // Advisory risk mapping
      conflictScore: conflictResult.conflictScore,
      evidenceCompleteness,
      checklistPassedCount,
      checklistTotalCount,
      ownershipHistoryLength: ownershipHistory.length,
      hasDisputes: doc.status === 'DISPUTED'
    };
    const copilotResult = await DecisionCopilotAgentService.assess(copilotInput);

    // 2. Persist in database inside a single PostgreSQL Transaction
    await prisma.$transaction(async (tx) => {
      // --- Save AGENT 1: Conflict Assessment & History ---
      const existingConflict = await tx.aiConflictAssessment.findUnique({ where: { documentId } });
      if (existingConflict) {
        await tx.aiConflictAssessmentHistory.create({
          data: {
            documentId,
            conflictAssessmentId: existingConflict.id,
            conflictScore: existingConflict.conflictScore,
            conflictLevel: existingConflict.conflictLevel,
            findings: existingConflict.findings || [],
            recommendation: existingConflict.recommendation,
            confidence: existingConflict.confidence,
            version: existingConflict.version,
            triggerEvent
          }
        });
        await tx.aiConflictAssessment.update({
          where: { id: existingConflict.id },
          data: {
            conflictScore: conflictResult.conflictScore,
            conflictLevel: conflictResult.conflictLevel,
            findings: conflictResult.findings as any,
            recommendation: conflictResult.recommendation,
            confidence: conflictResult.confidence,
            version: existingConflict.version + 1
          }
        });
      } else {
        await tx.aiConflictAssessment.create({
          data: {
            documentId,
            conflictScore: conflictResult.conflictScore,
            conflictLevel: conflictResult.conflictLevel,
            findings: conflictResult.findings as any,
            recommendation: conflictResult.recommendation,
            confidence: conflictResult.confidence,
            version: 1
          }
        });
      }

      // --- Save AGENT 2: Approval Prediction & History ---
      const existingPrediction = await tx.aiApprovalPrediction.findUnique({ where: { documentId } });
      if (existingPrediction) {
        await tx.aiApprovalPredictionHistory.create({
          data: {
            documentId,
            approvalPredictionId: existingPrediction.id,
            approvalProbability: existingPrediction.approvalProbability,
            expectedReviewDays: existingPrediction.expectedReviewDays,
            missingEvidenceRisk: existingPrediction.missingEvidenceRisk,
            blockers: existingPrediction.blockers || [],
            confidence: existingPrediction.confidence,
            version: existingPrediction.version,
            triggerEvent
          }
        });
        await tx.aiApprovalPrediction.update({
          where: { id: existingPrediction.id },
          data: {
            approvalProbability: predictionResult.approvalProbability,
            expectedReviewDays: predictionResult.expectedReviewDays,
            missingEvidenceRisk: predictionResult.missingEvidenceRisk,
            blockers: predictionResult.blockers as any,
            confidence: predictionResult.confidence,
            version: existingPrediction.version + 1
          }
        });
      } else {
        await tx.aiApprovalPrediction.create({
          data: {
            documentId,
            approvalProbability: predictionResult.approvalProbability,
            expectedReviewDays: predictionResult.expectedReviewDays,
            missingEvidenceRisk: predictionResult.missingEvidenceRisk,
            blockers: predictionResult.blockers as any,
            confidence: predictionResult.confidence,
            version: 1
          }
        });
      }

      // --- Save AGENT 3: Cross Examination & History ---
      const existingCrossExam = await tx.aiCrossExamination.findUnique({ where: { documentId } });
      if (existingCrossExam) {
        await tx.aiCrossExaminationHistory.create({
          data: {
            documentId,
            crossExaminationId: existingCrossExam.id,
            questions: existingCrossExam.questions || [],
            confidence: existingCrossExam.confidence,
            version: existingCrossExam.version,
            triggerEvent
          }
        });
        await tx.aiCrossExamination.update({
          where: { id: existingCrossExam.id },
          data: {
            questions: crossExamResult.questions as any,
            confidence: crossExamResult.confidence,
            version: existingCrossExam.version + 1
          }
        });
      } else {
        await tx.aiCrossExamination.create({
          data: {
            documentId,
            questions: crossExamResult.questions as any,
            confidence: crossExamResult.confidence,
            version: 1
          }
        });
      }

      // --- Save AGENT 4: Decision Recommendation & History ---
      const existingRecommendation = await tx.aiDecisionRecommendation.findUnique({ where: { documentId } });
      if (existingRecommendation) {
        await tx.aiDecisionRecommendationHistory.create({
          data: {
            documentId,
            decisionRecommendationId: existingRecommendation.id,
            recommendation: existingRecommendation.recommendation,
            rationale: existingRecommendation.rationale || [],
            confidence: existingRecommendation.confidence,
            version: existingRecommendation.version,
            triggerEvent
          }
        });
        await tx.aiDecisionRecommendation.update({
          where: { id: existingRecommendation.id },
          data: {
            recommendation: copilotResult.recommendation,
            rationale: copilotResult.rationale as any,
            confidence: copilotResult.confidence,
            version: existingRecommendation.version + 1
          }
        });
      } else {
        await tx.aiDecisionRecommendation.create({
          data: {
            documentId,
            recommendation: copilotResult.recommendation,
            rationale: copilotResult.rationale as any,
            confidence: copilotResult.confidence,
            version: 1
          }
        });
      }
    }, { timeout: 60000 });

    logger.info(`[VerificationCopilotService] Successfully completed copilot analysis for document ${documentId}`);
    return {
      conflictResult,
      predictionResult,
      crossExamResult,
      copilotResult
    };
  }
}
