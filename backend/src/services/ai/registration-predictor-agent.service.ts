import { NemotronService } from './nemotron.service';

export interface RegistrationPredictorInput {
  documentId: string;
  trustScore: number;
  evidenceCompleteness: number; // 0 to 100
  conflictScore: number; // 0 to 100
  isNotaryAccredited: boolean;
  registryConsistency: number; // 0 to 100
  blockers: string[];
}

export interface RegistrationPredictorResult {
  approvalProbability: number;
  expectedReviewDays: number;
  missingEvidenceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  blockers: string[];
}

export class RegistrationPredictorAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Registration Success Predictor Agent.
Your job is to analyze verification parameters (trust scores, conflict indices, registry checks, and notary status) to estimate verification success likelihood and bottleneck delays.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  approvalProbability: number; // 0 to 100
  expectedReviewDays: number;
  missingEvidenceRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number; // 0 to 100
  blockers: string[];
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Evaluates prediction using NVIDIA Nemotron.
   */
  public static async assess(input: RegistrationPredictorInput): Promise<RegistrationPredictorResult> {
    const userPrompt = `Predict the registration success using these parameters:
Document ID: ${input.documentId}
Current Trust Score: ${input.trustScore}
Evidence Completeness: ${input.evidenceCompleteness}%
Conflict Score: ${input.conflictScore}
Assigned Notary Accredited: ${input.isNotaryAccredited ? 'Yes' : 'No'}
Registry Consistency: ${input.registryConsistency}%
Identified Missing Evidence Blockers:
${input.blockers.map(b => `  - ${b}`).join('\n') || '  - None'}
`;

    const stateObj = {
      trustScore: input.trustScore,
      evidenceCompleteness: input.evidenceCompleteness,
      conflictScore: input.conflictScore,
      isNotaryAccredited: input.isNotaryAccredited,
      registryConsistency: input.registryConsistency,
      blockersCount: input.blockers.length
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'registration-predictor', ...stateObj });

    return await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(input)
    });
  }

  /**
   * Deterministic local fallback generator.
   */
  private static generateDeterministicFallback(input: RegistrationPredictorInput): RegistrationPredictorResult {
    // Basic calculation for probability
    let prob = 100;
    
    // Deductions
    prob -= (100 - input.registryConsistency) * 0.4;
    prob -= input.conflictScore * 0.5;
    prob -= (100 - input.evidenceCompleteness) * 0.3;
    
    if (!input.isNotaryAccredited) {
      prob -= 30;
    }

    prob = Math.min(99, Math.max(5, Math.round(prob)));

    // Expected review days
    let days = 1;
    if (input.conflictScore > 50) days += 5;
    else if (input.conflictScore > 20) days += 2;
    if (input.evidenceCompleteness < 50) days += 3;
    if (!input.isNotaryAccredited) days += 4;

    // Missing evidence risk
    let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const missingCount = input.blockers.length;
    if (missingCount >= 3) risk = 'HIGH';
    else if (missingCount >= 1) risk = 'MEDIUM';

    return {
      approvalProbability: prob,
      expectedReviewDays: days,
      missingEvidenceRisk: risk,
      confidence: 90,
      blockers: input.blockers.length > 0 ? input.blockers : ['None']
    };
  }
}
