import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { NemotronService } from './nemotron.service';

export interface ChainIntegrityResult {
  integrityScore: number;
  status: 'Verified' | 'Warning' | 'Broken';
  missingLinks: string[];
  gaps: string[];
  findings: string[];
}

export class ChainIntegrityAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Chain Integrity Agent.
Your purpose is to validate the complete ownership chain of properties.
Identify and check:
1. Missing Ownership Links: Transitions where the previous owner does not match the preceding owner.
2. Historical Gaps: Time periods where no owner was registered for the property.
3. Duplicate Active Owners: Multiple owners having an "ACTIVE" record for the same property simultaneously.
4. Invalid Transitions: Ownership transfers without proper record logging.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  "integrityScore": number, // 0 to 100
  "status": "Verified" | "Warning" | "Broken",
  "missingLinks": string[],
  "gaps": string[],
  "findings": string[]
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Run chain integrity audit checks for a property/survey number.
   */
  public static async analyze(propertyId: string): Promise<ChainIntegrityResult> {
    logger.info(`[ChainIntegrityAgentService] Running title chain integrity scan for property ${propertyId}...`);

    // 1. Query all ownership records for documents matching this property/survey number
    const metadataRecords = await prisma.documentMetadata.findMany({
      where: {
        OR: [
          { propertyId: propertyId },
          { surveyNumber: propertyId }
        ]
      }
    });

    const docIds = metadataRecords.map(m => m.documentId);

    const ownershipRecords = await prisma.ownershipRecord.findMany({
      where: {
        documentId: { in: docIds }
      },
      orderBy: { startDate: 'asc' }
    });

    const userPrompt = `Audit the following chronologically ordered ownership records for property: ${propertyId}
Records:
${JSON.stringify(ownershipRecords.map(r => ({
      recordId: r.recordId,
      docId: r.documentId,
      owner: r.ownerUserId,
      prevOwner: r.previousOwnerId,
      start: r.startDate,
      end: r.endDate,
      status: r.status,
      reason: r.transferReason
    })), null, 2)}
`;

    const cacheKey = NemotronService.generateCacheKey(propertyId, {
      agent: 'chain-integrity',
      recordsCount: ownershipRecords.length,
      lastRecordDate: ownershipRecords[ownershipRecords.length - 1]?.startDate || 'none'
    });

    const result = await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(ownershipRecords)
    }) as ChainIntegrityResult;

    return result;
  }

  /**
   * Deterministic local fallback checking rules in code when Nemotron API is unavailable.
   */
  private static generateDeterministicFallback(records: any[]): ChainIntegrityResult {
    const missingLinks: string[] = [];
    const gaps: string[] = [];
    const findings: string[] = [];
    let score = 100;
    let status: 'Verified' | 'Warning' | 'Broken' = 'Verified';

    if (records.length === 0) {
      return {
        integrityScore: 100,
        status: 'Verified',
        missingLinks: [],
        gaps: [],
        findings: ['No ownership records registered for this property yet. Standard first-registration check.']
      };
    }

    // 1. Duplicate active owners check
    const activeRecords = records.filter(r => r.status === 'ACTIVE');
    if (activeRecords.length > 1) {
      score -= 40;
      status = 'Broken';
      findings.push(`Duplicate active ownership records detected (${activeRecords.length} active claims).`);
      missingLinks.push(`Conflict: Citizens ${activeRecords.map(r => r.ownerUserId).join(' & ')} both claim active title.`);
    }

    // 2. Continuous chain check
    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      const prev = records[i - 1];

      // Check if previous owner ID matches the owner ID of the preceding record
      if (current.previousOwnerId && current.previousOwnerId !== prev.ownerUserId) {
        score -= 25;
        if (status !== 'Broken') status = 'Warning';
        missingLinks.push(`Owner transition gap between Record ${prev.recordId.slice(0, 8)} (Owner: ${prev.ownerUserId.slice(0, 8)}) and Record ${current.recordId.slice(0, 8)} (Claimed Previous: ${current.previousOwnerId.slice(0, 8)}).`);
      }

      // Time gap check (if end date of previous is long before start date of current)
      if (prev.endDate) {
        const prevEnd = new Date(prev.endDate).getTime();
        const currStart = new Date(current.startDate).getTime();
        const diffDays = (currStart - prevEnd) / (1000 * 60 * 60 * 24);
        if (diffDays > 30) {
          score -= 15;
          if (status !== 'Broken') status = 'Warning';
          gaps.push(`Registry gap of ${Math.round(diffDays)} days between owner ${prev.ownerUserId.slice(0, 8)} and ${current.ownerUserId.slice(0, 8)}.`);
        }
      }
    }

    // Floor score
    score = Math.max(0, score);
    if (score < 50) {
      status = 'Broken';
    } else if (score < 90 && status !== 'Broken') {
      status = 'Warning';
    }

    if (findings.length === 0) {
      findings.push('Ownership chain is complete and sequentially continuous.');
      findings.push('No dual active title records found.');
    }

    return {
      integrityScore: score,
      status,
      missingLinks,
      gaps,
      findings
    };
  }
}
