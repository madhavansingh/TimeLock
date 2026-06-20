import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { AIServiceError } from '../../config/errors';
import { NemotronService } from './nemotron.service';

export interface EvidenceRecommendationResult {
  recommendedDoc: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  impactScore: number;
  expectedTrustIncrease: number;
}

export class EvidenceRecommendationAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Evidence Recommendation Agent.
Your job is to analyze property deeds, registry metadata, ownership records, evidence completeness, trust scores, and active conflict assessments to determine what additional evidence documents should be requested from the citizen to complete the verification case.

Evaluate and recommend:
1. What specific documents (e.g. "Tax Receipt", "Encumbrance Certificate", "Prior Title Deed", "Identity Proof") are missing or would increase verification confidence.
2. Provide a clear reasoning based on property types, registration types, ownership transitions, and conflict flags.
3. Assign a priority: 'HIGH', 'MEDIUM', or 'LOW'.
4. Calculate an impactScore (0 to 100).
5. Predict an expectedTrustIncrease (the integer increase in trust score if this document is provided).

You must respond ONLY with a raw JSON array matching the following TypeScript interface:
EvidenceRecommendationResult[]

Where EvidenceRecommendationResult is:
{
  recommendedDoc: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  impactScore: number; // 0 to 100
  expectedTrustIncrease: number; // integer 1 to 30
}

Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Runs the Evidence Recommendation analysis using NVIDIA Nemotron.
   * Persists results in PostgreSQL database.
   */
  public static async runAnalysis(documentId: string): Promise<EvidenceRecommendationResult[]> {
    logger.info(`[EvidenceRecommendationAgent] Running analysis for document ${documentId}`);

    // Fetch document state and all relations
    const doc = await prisma.document.findUnique({
      where: { documentId },
      include: {
        metadata: true,
        verificationCase: {
          include: { evidence: true }
        },
        ownershipRecords: true,
        aiConflictAssessment: true,
        aiApprovalPrediction: true
      }
    });

    if (!doc) {
      throw new Error(`Document record not found for ID: ${documentId}`);
    }

    const ownershipHistoryCount = doc.ownershipRecords.length;
    const currentEvidence = doc.verificationCase?.evidence.map(e => e.title) || [];
    const currentScore = doc.verificationCase?.trustScore ?? 100;
    const conflictScore = doc.aiConflictAssessment?.conflictScore ?? 0;
    const predictionScore = doc.aiApprovalPrediction?.approvalProbability ?? 100;

    const userPrompt = `Analyze the following deed for evidence recommendations:
Document ID: ${documentId}
Title: ${doc.title}
Property Type: ${doc.type}
Current Trust Score: ${currentScore}
Conflict Score: ${conflictScore}
Approval Prediction Probability: ${predictionScore}%
Evidence Uploaded: ${currentEvidence.join(', ') || 'None'}
Ownership Records Count: ${ownershipHistoryCount}
Metadata:
  - Survey Number: ${doc.metadata?.surveyNumber || 'Unknown'}
  - Property ID: ${doc.metadata?.propertyId || 'Unknown'}
  - Registration Number: ${doc.metadata?.registrationNumber || 'Unknown'}
`;

    const stateObj = {
      evidenceCount: currentEvidence.length,
      currentScore,
      conflictScore,
      ownershipHistoryCount
    };

    const cacheKey = NemotronService.generateCacheKey(documentId, { agent: 'evidence-recommendation', ...stateObj });

    // STRICT NO-MOCK POLICY: NemotronService.invoke throws AIServiceError if API key is not configured or mock.
    const recommendations: EvidenceRecommendationResult[] = await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => {
        throw new AIServiceError('NVIDIA Nemotron API key is not configured or is invalid. Please configure NVIDIA_API_KEY in the environment to perform AI analysis.');
      }
    });

    if (!Array.isArray(recommendations)) {
      throw new Error('Nemotron failed to return a JSON array for evidence recommendations.');
    }

    // Persist recommendations in the database
    await prisma.evidenceRecommendation.deleteMany({
      where: { documentId }
    });

    await prisma.evidenceRecommendation.createMany({
      data: recommendations.map(rec => ({
        documentId,
        recommendedDoc: rec.recommendedDoc || 'Additional Document',
        reason: rec.reason || 'Verification requirement',
        priority: rec.priority || 'MEDIUM',
        impactScore: rec.impactScore || 10,
        expectedTrustIncrease: rec.expectedTrustIncrease || 5,
        requested: false
      }))
    });

    return recommendations;
  }
}
