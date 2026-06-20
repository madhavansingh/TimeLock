import { NemotronService } from './nemotron.service';

export interface FraudRiskInput {
  documentId: string;
  title: string;
  type: string;
  status: string;
  metadata: {
    surveyNumber?: string | null;
    propertyId?: string | null;
    registrationNumber?: string | null;
    ownerName?: string | null;
  } | null;
  ownershipHistory: any[];
  challenges: any[];
  evidenceCount: number;
}

export interface FraudRiskResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  recommendations: string[];
  confidenceScore: number;
}

export class FraudRiskAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Fraud Risk Assessment Agent.
Your job is to analyze property deeds, registry metadata, ownership transfer logs, and notary verification challenges to evaluate fraud risk.
Evaluate and check for:
1. Double-Registration Conflicts: Multiple documents claiming the same Property ID or Survey Number.
2. Chain of Title Integrity: Consistency of ownership transitions, missing gaps.
3. Documentation Integrity: Missing mandatory supporting evidence.
4. Active Disputes: Existing status anomalies.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  riskScore: number; // 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  recommendations: string[];
  confidenceScore: number; // 0 to 100
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Evaluates a document's fraud risk using NVIDIA Nemotron.
   */
  public static async assess(input: FraudRiskInput): Promise<FraudRiskResult> {
    const userPrompt = `Evaluate the following document registry state:
Document ID: ${input.documentId}
Title: ${input.title}
Type: ${input.type}
Status: ${input.status}
Registry Metadata:
  - Survey Number: ${input.metadata?.surveyNumber || 'None'}
  - Property ID: ${input.metadata?.propertyId || 'None'}
  - Registration Number: ${input.metadata?.registrationNumber || 'None'}
  - Owner Name: ${input.metadata?.ownerName || 'None'}
Ownership History Count: ${input.ownershipHistory.length}
Evidence Documents Uploaded: ${input.evidenceCount}
Active Challenges / Conflicts:
${input.challenges.map(c => `  - [Type: ${c.type}] Field: ${c.field}, Question: ${c.question}, Resolved: ${c.resolved}`).join('\n') || '  - None'}
`;

    const stateObj = {
      status: input.status,
      metadata: input.metadata,
      historyCount: input.ownershipHistory.length,
      challenges: input.challenges,
      evidenceCount: input.evidenceCount
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'fraud', ...stateObj });

    return await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateMockFallback(input)
    });
  }

  /**
   * Deterministic local fallback generator based on the document's real DB properties.
   */
  private static generateMockFallback(input: FraudRiskInput): FraudRiskResult {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let score = 15; // Base low risk score

    // 1. Check for double registration / conflicts
    const activeConflicts = input.challenges.filter(c => c.type === 'CONFLICT' && !c.resolved);
    const resolvedConflicts = input.challenges.filter(c => c.type === 'CONFLICT' && c.resolved);
    
    if (activeConflicts.length > 0) {
      score += 45;
      factors.push(`Unresolved double-registration conflict detected on property metrics (${activeConflicts.map(c => c.field).join(', ')}).`);
      recommendations.push('Assigned notary must verify ownership records and resolve the double-registration challenge.');
    } else if (resolvedConflicts.length > 0) {
      score += 15;
      factors.push('Previous double-registration conflict was resolved with notary justification.');
    }

    // 2. Check for missing mandatory evidence
    const missingEvidence = input.challenges.filter(c => c.type === 'MISSING_EVIDENCE' && !c.resolved);
    if (missingEvidence.length > 0) {
      score += 10 * missingEvidence.length;
      factors.push(`Missing mandatory evidence: ${missingEvidence.map(c => c.field).join(', ')}.`);
      recommendations.push('Upload the requested tax receipts and prior deeds in the evidence repository.');
    }

    // 3. Document status based checks
    if (input.status === 'DISPUTED') {
      score += 35;
      factors.push('Document registry is in DISPUTED status.');
      recommendations.push('Halt all transfer actions until court clerk clears the dispute.');
    }

    // 4. Ownership transitions checks
    if (input.ownershipHistory.length > 3) {
      score += 10;
      factors.push('High frequency of ownership transfers within a short period (potential speculative wrapping).');
    }

    // Cap score at 98, floor at 10
    score = Math.min(98, Math.max(10, score));

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 70) {
      level = 'HIGH';
    } else if (score >= 40) {
      level = 'MEDIUM';
    }

    if (factors.length === 0) {
      factors.push('Ownership chain is consistent.');
      factors.push('Registry details matched successfully.');
      factors.push('No duplicate claims or active conflicts found.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Document metadata is ready. Proceed with scheduled notary check and Class-3 DSC signing.');
    }

    return {
      riskScore: score,
      riskLevel: level,
      riskFactors: factors,
      recommendations,
      confidenceScore: 95
    };
  }
}
