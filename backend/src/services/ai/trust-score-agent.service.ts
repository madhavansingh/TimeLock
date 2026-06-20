import { NemotronService } from './nemotron.service';

export interface TrustScoreInput {
  documentId: string;
  title: string;
  type: string;
  status: string;
  hasOnchainPda: boolean;
  assignedNotary: {
    name: string;
    isAccredited: boolean;
    dscCertificateSerial: string;
  } | null;
  checklist: any[];
  challenges: any[];
  evidenceCount: number;
  baseTrustScore: number;
}

export interface TrustScoreResult {
  trustScoreExplanation: string;
  positiveFactors: string[];
  negativeFactors: string[];
  recommendedActions: string[];
  scoreBreakdown: {
    registryConsistency: number;
    evidenceCompleteness: number;
    blockchainValidation: number;
    notaryAccreditation: number;
  };
}

export class TrustScoreAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Trust Score Explanation Agent.
Your job is to explain the document's verification trust score transparently.
Break down the score into specific categories and list positive booster factors, negative deduction factors, and recommended improvement actions.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  trustScoreExplanation: string;
  positiveFactors: string[];
  negativeFactors: string[];
  recommendedActions: string[];
  scoreBreakdown: {
    registryConsistency: number; // 0 to 100
    evidenceCompleteness: number; // 0 to 100
    blockchainValidation: number; // 0 to 100
    notaryAccreditation: number; // 0 to 100
  }
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Explains a document's VPL trust score using NVIDIA Nemotron.
   */
  public static async explain(input: TrustScoreInput): Promise<TrustScoreResult> {
    const userPrompt = `Explain and analyze the trust score details for this document:
Document Title: ${input.title}
Base Trust Score: ${input.baseTrustScore}
Status: ${input.status}
Solana Anchor (PDA): ${input.hasOnchainPda ? 'Anchored/Verified' : 'Pending'}
Assigned Notary: ${input.assignedNotary ? `${input.assignedNotary.name} (Accredited: ${input.assignedNotary.isAccredited}, DSC: ${input.assignedNotary.dscCertificateSerial})` : 'Unassigned'}
Checklist Items:
${input.checklist.map(i => `  - ${i.label}: ${i.status}`).join('\n') || '  - None'}
Active Challenges:
${input.challenges.map(c => `  - [Type: ${c.type}] Field: ${c.field}, Resolved: ${c.resolved}`).join('\n') || '  - None'}
Evidence Documents Uploaded: ${input.evidenceCount}
`;

    const stateObj = {
      baseScore: input.baseTrustScore,
      status: input.status,
      hasPda: input.hasOnchainPda,
      notary: input.assignedNotary,
      checklist: input.checklist,
      challenges: input.challenges,
      evidenceCount: input.evidenceCount
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'trust', ...stateObj });

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
  private static generateMockFallback(input: TrustScoreInput): TrustScoreResult {
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const recommendedActions: string[] = [];

    // Category scores
    let registryConsistency = 100;
    let evidenceCompleteness = 100;
    let blockchainValidation = 0;
    let notaryAccreditation = 0;

    // 1. Blockchain Validation
    if (input.hasOnchainPda || input.status !== 'PENDING') {
      blockchainValidation = 100;
      positiveFactors.push('Blockchain Anchor Verified (anchored securely on Solana Ledger)');
    } else {
      negativeFactors.push('Solana PDA anchoring is pending.');
      recommendedActions.push('Confirm document metadata to execute Solana Devnet anchoring.');
    }

    // 2. Notary Accreditation
    if (input.assignedNotary) {
      if (input.assignedNotary.isAccredited) {
        notaryAccreditation = 100;
        positiveFactors.push(`Active Accredited Notary assigned: ${input.assignedNotary.name} (DSC Verified)`);
      } else {
        notaryAccreditation = 50;
        negativeFactors.push(`Assigned Notary "${input.assignedNotary.name}" accreditation verification failed.`);
        recommendedActions.push('Assign an accredited notary with active DSC credentials.');
      }
    } else {
      negativeFactors.push('No notary assigned for Class-3 DSC attestation.');
      recommendedActions.push('Select and assign a notary officer to verify registry records.');
    }

    // 3. Registry Consistency / Challenges
    const conflicts = input.challenges.filter(c => c.type === 'CONFLICT');
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    
    if (unresolvedConflicts.length > 0) {
      registryConsistency = 50;
      negativeFactors.push(`Unresolved Survey/Property double-registration conflict (${unresolvedConflicts.length} item(s)).`);
      recommendedActions.push('Notary must verify the prior land registries and resolve property number duplication.');
    } else if (conflicts.length > 0) {
      registryConsistency = 100;
      positiveFactors.push('Registry Conflict Resolved (overlapping survey records justified by Notary)');
    } else {
      positiveFactors.push('Registry Consistency Verified (no duplicate khata/survey claims detected)');
    }

    // 4. Evidence Completeness
    const missingEvidence = input.challenges.filter(c => c.type === 'MISSING_EVIDENCE');
    const unresolvedEvidence = missingEvidence.filter(c => !c.resolved);
    
    if (missingEvidence.length > 0) {
      const totalEvidence = missingEvidence.length + input.evidenceCount;
      evidenceCompleteness = Math.round((input.evidenceCount / (totalEvidence || 1)) * 100);
      
      if (unresolvedEvidence.length > 0) {
        negativeFactors.push(`Missing supporting evidence documents (${unresolvedEvidence.length} pending).`);
        for (const item of unresolvedEvidence) {
          recommendedActions.push(`Upload missing evidence: ${item.field}`);
        }
      } else {
        positiveFactors.push('All mandatory supporting evidence documents present');
      }
    } else {
      positiveFactors.push('Mandatory supporting evidence present');
    }

    // Checklist boosters
    const passedChecklist = input.checklist.filter(i => i.status === 'PASSED');
    if (passedChecklist.length > 0) {
      positiveFactors.push(`${passedChecklist.length} VPL Checklist Items verified and approved`);
    }

    // Overall Explanation
    let explanation = `The verification trust score stands at ${input.baseTrustScore}. `;
    if (input.baseTrustScore >= 90) {
      explanation += 'The deed shows an excellent integrity profile with active accredited notary assignment, verified Solana anchor, and clear registry consistency checks.';
    } else if (input.baseTrustScore >= 70) {
      explanation += 'The deed is in a solid state, but requires resolving secondary evidence submissions or notary checklist approvals.';
    } else {
      explanation += 'The deed shows critical compliance risk factors. Immediate attention is required to resolve property conflicts and submit mandatory identity/prior deed verification documents.';
    }

    return {
      trustScoreExplanation: explanation,
      positiveFactors,
      negativeFactors,
      recommendedActions,
      scoreBreakdown: {
        registryConsistency,
        evidenceCompleteness,
        blockchainValidation,
        notaryAccreditation
      }
    };
  }
}
