import { NemotronService } from './nemotron.service';

export interface ConflictInvestigatorInput {
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
  activeConflicts: any[];
}

export interface ConflictInvestigatorResult {
  conflictScore: number;
  conflictLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  findings: string[];
  recommendation: string;
}

export class ConflictInvestigatorAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Property Conflict Investigator Agent.
Your job is to analyze property deeds, registry metadata, ownership records, and active verification challenges to identify double registration or ownership conflicts.

Evaluate and detect:
1. Duplicate active ownership or double registration attempts for the same Survey Number, Property ID, or Registration Number.
2. Suspicious ownership transitions or title history gaps.
3. Overlapping registry entries in the database.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  conflictScore: number; // 0 to 100
  conflictLevel: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0 to 100
  findings: string[];
  recommendation: string;
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Assesses conflict risk using NVIDIA Nemotron.
   */
  public static async assess(input: ConflictInvestigatorInput): Promise<ConflictInvestigatorResult> {
    const userPrompt = `Evaluate the following document for conflicts:
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
Database Conflict Detections:
${input.activeConflicts.map(c => `  - Overlapping ${c.field}: matches Document ID ${c.matchId}`).join('\n') || '  - None'}
`;

    const stateObj = {
      status: input.status,
      metadata: input.metadata,
      historyCount: input.ownershipHistory.length,
      conflictsCount: input.activeConflicts.length
    };

    const cacheKey = NemotronService.generateCacheKey(input.documentId, { agent: 'conflict-investigator', ...stateObj });

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
  private static generateDeterministicFallback(input: ConflictInvestigatorInput): ConflictInvestigatorResult {
    const findings: string[] = [];
    let score = 0;

    if (input.activeConflicts.length > 0) {
      score += 40 * input.activeConflicts.length;
      for (const conf of input.activeConflicts) {
        findings.push(`Duplicate registry overlap detected on ${conf.field}: ${conf.value} matches active Document ${conf.matchId}.`);
      }
    }

    // Check for suspicious ownership transitions
    const suspiciousTransitions = input.ownershipHistory.some(h => !h.ownerUserId || h.startDate === null);
    if (suspiciousTransitions) {
      score += 20;
      findings.push('Ownership history contains unverified gap transitions.');
    }

    // Double registration attempt check
    if (input.status === 'DISPUTED') {
      score += 30;
      findings.push('Deed status is actively flagged as DISPUTED.');
    }

    score = Math.min(100, Math.max(0, score));

    let level: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'NONE';
    if (score >= 80) level = 'CRITICAL';
    else if (score >= 50) level = 'HIGH';
    else if (score >= 25) level = 'MEDIUM';
    else if (score > 0) level = 'LOW';

    if (findings.length === 0) {
      findings.push('Ownership chain is consistent across registered blocks.');
      findings.push('No duplicate active claims or overlapping survey numbers detected.');
    }

    const recommendation = score >= 50 
      ? 'Halt signing workflow. Assigned notary must demand certified land deeds and verify physical property survey.' 
      : 'Registry is clear of double-registration conflicts. Proceed with notarization.';

    return {
      conflictScore: score,
      conflictLevel: level,
      confidence: 95,
      findings,
      recommendation
    };
  }
}
