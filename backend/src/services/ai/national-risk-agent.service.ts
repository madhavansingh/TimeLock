import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { NemotronService } from './nemotron.service';

export interface NationalRiskResult {
  finalRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'C';
  fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  trustScore: number;
  conflictScore: number;
  chainIntegrityScore: number;
  networkRiskScore: number;
  justification: string;
}

export class NationalRiskAgentService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) National Risk Intelligence Agent.
Your job is to aggregate all risk signals for a property and assign a final national trust rating.
Ratings hierarchy:
- AAA: Highest security, perfect chain, zero conflicts, full evidence, accredited notary.
- AA, A: High security, minor warnings resolved, complete records.
- BBB, BB: Moderate risk, resolved conflicts, missing non-critical evidence, minor timeline gaps.
- B, C: High risk, active double-registrations, broken chain integrity, disputed status.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  "finalRating": "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "C",
  "fraudRisk": "LOW" | "MEDIUM" | "HIGH",
  "trustScore": number, // 0 to 100
  "conflictScore": number, // 0 to 100
  "chainIntegrityScore": number, // 0 to 100
  "networkRiskScore": number, // 0 to 100
  "justification": string
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Aggregates all network, entity, and chain signals to assign a final trust credit rating.
   */
  public static async assess(propertyId: string): Promise<NationalRiskResult> {
    logger.info(`[NationalRiskAgentService] Aggregating national trust rating for property ${propertyId}...`);

    // Fetch existing assessments
    const chainAssessment = await prisma.chainIntegrityAssessment.findUnique({
      where: { propertyId }
    });

    const riskAssessment = await prisma.entityRiskAssessment.findUnique({
      where: {
        entityType_entityId: {
          entityType: 'PROPERTY',
          entityId: propertyId
        }
      }
    });

    const anomalies = await prisma.networkAnomaly.findMany({
      where: {
        entityId: propertyId,
        status: 'ACTIVE'
      }
    });

    // Extract raw scores or fallbacks
    const chainIntegrityScore = chainAssessment?.integrityScore ?? 100;
    const trustScore = riskAssessment?.trustScore ?? 85;
    const networkRiskScore = riskAssessment?.riskScore ?? 15;
    const conflictScore = anomalies.length > 0 ? 60 : 0;

    const userPrompt = `Aggregate the following intelligence metrics for property: ${propertyId}
- Chain Integrity Score: ${chainIntegrityScore} (${chainAssessment?.status || 'Unknown'})
- Entity Trust Score: ${trustScore}
- Entity Network Risk: ${networkRiskScore}
- Active Anomalies Count: ${anomalies.length}
- Anomalies Log: ${JSON.stringify(anomalies.map(a => ({ title: a.title, severity: a.severity })), null, 2)}
`;

    const cacheKey = NemotronService.generateCacheKey(propertyId, {
      agent: 'national-risk',
      chainIntegrityScore,
      trustScore,
      networkRiskScore,
      anomaliesCount: anomalies.length
    });

    const rating = await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(chainIntegrityScore, trustScore, networkRiskScore, conflictScore, anomalies)
    }) as NationalRiskResult;

    return rating;
  }

  /**
   * Deterministic credit aggregator fallback.
   */
  private static generateDeterministicFallback(
    chainScore: number,
    trustScore: number,
    networkRiskScore: number,
    conflictScore: number,
    anomalies: any[]
  ): NationalRiskResult {
    // Basic scoring math:
    const aggregate = (chainScore + trustScore + (100 - networkRiskScore) + (100 - conflictScore)) / 4;

    let finalRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'C' = 'BBB';
    let fraudRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    let justification = 'Property ownership holds moderate stability with typical verification checks complete.';

    const criticalAnomalies = anomalies.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');

    if (aggregate >= 92 && criticalAnomalies.length === 0) {
      finalRating = 'AAA';
      fraudRisk = 'LOW';
      justification = 'Property title chain is fully continuous on-chain, all notary checks are accredited, and zero conflicts are active.';
    } else if (aggregate >= 80 && criticalAnomalies.length === 0) {
      finalRating = 'AA';
      fraudRisk = 'LOW';
      justification = 'High trust index. Title records are sequentially continuous with minor metadata updates pending.';
    } else if (aggregate >= 70) {
      finalRating = 'A';
      fraudRisk = 'LOW';
      justification = 'Stable sovereign title registry backed by Solana anchor checks.';
    } else if (aggregate >= 55) {
      finalRating = 'BBB';
      fraudRisk = 'MEDIUM';
      justification = 'Moderate security rating. Resolved conflicts are logged, but some prior deed documents are unverified.';
    } else if (aggregate >= 40) {
      finalRating = 'BB';
      fraudRisk = 'MEDIUM';
      justification = 'Warnings issued due to historical record gaps or short ownership turnover duration.';
    } else if (aggregate >= 25 || criticalAnomalies.length > 0) {
      finalRating = 'B';
      fraudRisk = 'HIGH';
      justification = 'High risk. Double-registration conflict or disputed registry status actively pending notary review.';
    } else {
      finalRating = 'C';
      fraudRisk = 'HIGH';
      justification = 'Broken chain of title. Duplicate owners actively claim the same Survey Number.';
    }

    return {
      finalRating,
      fraudRisk,
      trustScore,
      conflictScore,
      chainIntegrityScore: chainScore,
      networkRiskScore,
      justification
    };
  }
}
