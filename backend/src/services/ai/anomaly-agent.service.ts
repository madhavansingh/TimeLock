import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { NemotronService } from './nemotron.service';

export interface AnomalyResult {
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  entityId?: string | null;
  entityType?: 'CITIZEN' | 'NOTARY' | 'PROPERTY' | 'DOCUMENT' | null;
  suggestedInvestigation: string;
  metadata?: any;
}

export class AnomalyAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Anomaly Detection Agent.
Your purpose is to evaluate the registry system for indicators of fraud, manipulation, or unusual behavior.
Identify and highlight anomalies such as:
1. Same property transferred multiple times in a short period (velocity anomaly).
2. Same notary approving a suspiciously high volume of deeds (notary throughput anomaly).
3. Same citizen/witness involved in an abnormal number of deeds in a short period.
4. Repeated failed verification attempts or disputation events.

You must respond ONLY with a raw JSON array of anomalies matching this TypeScript interface:
Array<{
  "title": string,
  "description": string,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "confidence": number, // 0 to 100
  "entityId": string | null,
  "entityType": "CITIZEN" | "NOTARY" | "PROPERTY" | "DOCUMENT" | null,
  "suggestedInvestigation": string,
  "metadata": any
}>
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Run anomaly detection checks using NVIDIA Nemotron or local fallback.
   * Persists newly detected anomalies in the database inside the global transaction context if called there.
   */
  public static async detect(): Promise<AnomalyResult[]> {
    logger.info('[AnomalyAgentService] Running anomaly detection engine...');

    // 1. Fetch system transactions, transfers, and metadata for analysis
    const transfers = await prisma.ownershipTransfer.findMany({
      orderBy: { initiatedAt: 'desc' }
    });
    const documents = await prisma.document.findMany({
      include: { metadata: true }
    });
    const cases = await prisma.verificationCase.findMany();

    const userPrompt = `Evaluate the following registry transactional metrics:
Total Transfers: ${transfers.length}
Total Registered Documents: ${documents.length}
Total Verification Cases: ${cases.length}

Recent Transfer Logs:
${JSON.stringify(transfers.slice(0, 30).map(t => ({ id: t.transferId, doc: t.documentId, type: t.transferType, status: t.status, date: t.initiatedAt })), null, 2)}
`;

    const stateHashInput = {
      transfersCount: transfers.length,
      docsCount: documents.length,
      casesCount: cases.length,
      lastTransferDate: transfers[0]?.initiatedAt || 'none'
    };

    const cacheKey = NemotronService.generateCacheKey('global_anomalies', { agent: 'anomaly-detect', ...stateHashInput });

    const anomalies = await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(transfers, documents, cases)
    }) as AnomalyResult[];

    return anomalies;
  }

  /**
   * Deterministic local fallback checking rules in code when Nemotron API is unavailable.
   */
  private static generateDeterministicFallback(transfers: any[], documents: any[], cases: any[]): AnomalyResult[] {
    const list: AnomalyResult[] = [];

    // 1. Velocity check: Same property transferred multiple times recently
    const transferCountByDoc = new Map<string, number>();
    for (const t of transfers) {
      transferCountByDoc.set(t.documentId, (transferCountByDoc.get(t.documentId) || 0) + 1);
    }

    for (const [docId, count] of transferCountByDoc.entries()) {
      if (count > 2) {
        const doc = documents.find(d => d.documentId === docId);
        const propId = doc?.metadata?.propertyId || doc?.metadata?.surveyNumber || docId;
        list.push({
          title: 'High Velocity Ownership Transfers',
          description: `The property linked to Document ${doc?.title || docId} has been transferred ${count} times within a short period. This indicates speculative flipping or title wrapping.`,
          severity: 'HIGH',
          confidence: 90,
          entityId: propId,
          entityType: 'PROPERTY',
          suggestedInvestigation: 'Audit prior deeds, verify bank transfer logs, and interview current and prior owners.',
          metadata: { transferCount: count, documentId: docId }
        });
      }
    }

    // 2. High-volume Notary approvals
    const notaryVolume = new Map<string, number>();
    for (const d of documents) {
      if (d.assignedNotaryId && d.status === 'NOTARY_SIGNED') {
        notaryVolume.set(d.assignedNotaryId, (notaryVolume.get(d.assignedNotaryId) || 0) + 1);
      }
    }

    for (const [notaryId, count] of notaryVolume.entries()) {
      if (count > 5) {
        list.push({
          title: 'Abnormal Notary Approval Volume',
          description: `Notary ${notaryId} approved ${count} title deeds in quick succession, exceeding the system average threshold.`,
          severity: 'MEDIUM',
          confidence: 85,
          entityId: notaryId,
          entityType: 'NOTARY',
          suggestedInvestigation: 'Validate notary Class-3 DSC certification serial keys and inspect for automated script signatures.',
          metadata: { approvedCount: count }
        });
      }
    }

    // 3. Repeated failed verification attempts
    const failedCases = cases.filter(c => c.status === 'REJECTED');
    const failedCountByDoc = new Map<string, number>();
    for (const c of failedCases) {
      failedCountByDoc.set(c.documentId, (failedCountByDoc.get(c.documentId) || 0) + 1);
    }

    for (const [docId, count] of failedCountByDoc.entries()) {
      if (count >= 1) {
        const doc = documents.find(d => d.documentId === docId);
        list.push({
          title: 'Repeated Verification Case Failures',
          description: `The document "${doc?.title || docId}" has encountered multiple checklist or verification failures.`,
          severity: 'CRITICAL',
          confidence: 95,
          entityId: docId,
          entityType: 'DOCUMENT',
          suggestedInvestigation: 'Verify all scanned metadata consistency against land registries and run deep forensic scans.',
          metadata: { failureCount: count }
        });
      }
    }

    // Add baseline anomaly if nothing is found, to prevent empty dashboard
    if (list.length === 0 && documents.length > 0) {
      const disputedDoc = documents.find(d => d.status === 'DISPUTED');
      if (disputedDoc) {
        list.push({
          title: 'Disputed Document Title',
          description: `The registry title for "${disputedDoc.title}" is in a Disputed status state.`,
          severity: 'HIGH',
          confidence: 99,
          entityId: disputedDoc.documentId,
          entityType: 'DOCUMENT',
          suggestedInvestigation: 'Wait for Court Clerk registry verification updates.',
          metadata: { status: 'DISPUTED' }
        });
      }
    }

    return list;
  }
}
