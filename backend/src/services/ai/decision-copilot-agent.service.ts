import { NemotronService } from './nemotron.service';

export interface DecisionCopilotInput {
  documentId: string;
  trustScore: number;
  riskScore: number; // Fraud risk score
  conflictScore: number;
  evidenceCompleteness: number; // percentage
  checklistPassedCount: number;
  checklistTotalCount: number;
  ownershipHistoryLength: number;
  hasDisputes: boolean;
}

export interface DecisionCopilotResult {
  recommendation: 'APPROVE' | 'REQUEST_EVIDENCE' | 'REJECT';
  confidence: number;
  rationale: string[];
}

export class DecisionCopilotAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) AI Decision Copilot Agent.
Your job is to evaluate all registry metrics (trust score, fraud risk index, conflict status, checklists, and evidence) to output a final, defensible advisory recommendation.

Outputs must be one of:
- APPROVE: Document has high trust, no conflicts, complete evidence.
- REQUEST_EVIDENCE: Moderate risk, missing documents, or unresolved details.
- REJECT: High risk, active double-registration conflicts, or metadata mismatch.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  recommendation: 'APPROVE' | 'REQUEST_EVIDENCE' | 'REJECT';
  confidence: number; // 0 to 100
  rationale: string[];
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Evaluates final copilot recommendation using NVIDIA Nemotron.
   */
  public static async assess(input: DecisionCopilotInput): Promise<DecisionCopilotResult> {
    const userPrompt = `Determine final recommendation using these metrics:
Document ID: ${input.documentId}
Trust Score: ${input.trustScore}
Fraud Risk Score: ${input.riskScore}
Conflict Score: ${input.conflictScore}
Evidence Completeness: ${input.evidenceCompleteness}%
VPL Checklist Progress: ${input.checklistPassedCount} / ${input.checklistTotalCount} Checked
Ownership transfers: ${input.ownershipHistoryLength}
Deed Registry Has Active Disputes: ${input.hasDisputes ? 'Yes' : 'No'}
`;

    const stateObj = {
      trustScore: input.trustScore,
      riskScore: input.riskScore,
      conflictScore: input.conflictScore,
      evidenceCompleteness: input.evidenceCompleteness,
      checklistProgress: `${input.checklistPassedCount}/${input.checklistTotalCount}`,
      hasDisputes: input.hasDisputes
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'decision-copilot', ...stateObj });

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
  private static generateDeterministicFallback(input: DecisionCopilotInput): DecisionCopilotResult {
    const rationale: string[] = [];
    let rec: 'APPROVE' | 'REQUEST_EVIDENCE' | 'REJECT' = 'REQUEST_EVIDENCE';
    let confidence = 90;

    // 1. Conflict and Disputes -> REJECT trigger
    if (input.conflictScore >= 70 || input.hasDisputes) {
      rec = 'REJECT';
      confidence = 94;
      if (input.hasDisputes) {
        rationale.push('Document registry is in DISPUTED status.');
      }
      if (input.conflictScore >= 70) {
        rationale.push('Critical double-registration conflict detected on property survey indexes.');
      }
      rationale.push('Deed contains unresolved title conflicts blocking legal registry.');
    }
    // 2. Clear registry -> APPROVE trigger
    else if (input.conflictScore === 0 && input.evidenceCompleteness >= 90 && input.trustScore >= 80) {
      rec = 'APPROVE';
      confidence = 96;
      rationale.push('Ownership chain matches and registry metrics are consistent.');
      rationale.push('No double-registration survey conflicts detected.');
      rationale.push(`Evidence completeness reaches optimal level (${input.evidenceCompleteness}%).`);
    }
    // 3. Middle ground -> REQUEST_EVIDENCE
    else {
      rec = 'REQUEST_EVIDENCE';
      confidence = 88;
      if (input.evidenceCompleteness < 90) {
        rationale.push(`Evidence completeness (${input.evidenceCompleteness}%) is below the required 90% threshold.`);
      }
      if (input.checklistPassedCount < input.checklistTotalCount) {
        rationale.push(`Notary checklist is incomplete (${input.checklistPassedCount}/${input.checklistTotalCount} cleared).`);
      }
      if (input.conflictScore > 0 && input.conflictScore < 70) {
        rationale.push('Moderate duplicate survey index flags require clarification.');
      }
    }

    return {
      recommendation: rec,
      confidence,
      rationale
    };
  }
}
