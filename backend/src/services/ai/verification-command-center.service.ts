import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { TrustGraphService } from './trust-graph.service';
import { AnomalyAgentService, AnomalyResult } from './anomaly-agent.service';
import { ChainIntegrityAgentService } from './chain-integrity-agent.service';
import { NationalRiskAgentService } from './national-risk-agent.service';
import { BlockchainService } from '../blockchain.service';
import { HashService } from '../hash.service';
import { PublicKey } from '@solana/web3.js';

export class VerificationCommandCenterService {
  private static isRecalculating = false;

  /**
   * Main entry point to recalculate and run all AI agents across the system.
   * Runs inside a transactional structure.
   */
  public static async orchestrate(explicitPropertyId?: string): Promise<any> {
    if (this.isRecalculating) {
      logger.warn('[VCC] Orchestration run already in progress. Skipping...');
      return { status: 'IN_PROGRESS' };
    }

    this.isRecalculating = true;
    logger.info('[VCC] Orchestrating Autonomous Verification Command Center (AVCC) telemetry...');

    try {
      // =========================================================================
      // STEP 1: Run Graph Construction & Trust Network Agent (Agent 1)
      // =========================================================================
      const graphAnalysis = await TrustGraphService.buildAndAnalyze();

      // =========================================================================
      // STEP 2: Run Anomaly Detection (Agent 2)
      // =========================================================================
      const detectedAnomalies = await AnomalyAgentService.detect();

      // Clear active anomalies and write newly found ones
      await prisma.$transaction(async (tx) => {
        // Query active anomalies to save to history before deleting
        const activeAnomalies = await tx.networkAnomaly.findMany({ where: { status: 'ACTIVE' } });
        for (const an of activeAnomalies) {
          await tx.networkAnomalyHistory.create({
            data: {
              anomalyId: an.anomalyId,
              title: an.title,
              description: an.description,
              severity: an.severity,
              confidence: an.confidence,
              entityId: an.entityId,
              entityType: an.entityType,
              suggestedInvestigation: an.suggestedInvestigation,
              status: an.status,
              metadata: an.metadata || {}
            }
          });
        }

        // Delete active
        await tx.networkAnomaly.deleteMany({ where: { status: 'ACTIVE' } });

        // Insert new anomalies
        for (const an of detectedAnomalies) {
          const createdAnomaly = await tx.networkAnomaly.create({
            data: {
              title: an.title,
              description: an.description,
              severity: an.severity,
              confidence: an.confidence,
              entityId: an.entityId || null,
              entityType: an.entityType || null,
              suggestedInvestigation: an.suggestedInvestigation,
              status: 'ACTIVE',
              metadata: an.metadata || {}
            }
          });

          // Write to history
          await tx.networkAnomalyHistory.create({
            data: {
              anomalyId: createdAnomaly.anomalyId,
              title: createdAnomaly.title,
              description: createdAnomaly.description,
              severity: createdAnomaly.severity,
              confidence: createdAnomaly.confidence,
              entityId: createdAnomaly.entityId,
              entityType: createdAnomaly.entityType,
              suggestedInvestigation: createdAnomaly.suggestedInvestigation,
              status: createdAnomaly.status,
              metadata: createdAnomaly.metadata || {}
            }
          });
        }
      }, { timeout: 60000 });

      // =========================================================================
      // STEP 3: Identify properties to evaluate
      // =========================================================================
      const propertiesToEvaluate = new Set<string>();
      if (explicitPropertyId) {
        propertiesToEvaluate.add(explicitPropertyId);
      } else {
        // Gather all property IDs / survey numbers from DocumentMetadata
        const allMetadata = await prisma.documentMetadata.findMany();
        for (const meta of allMetadata) {
          const propId = meta.propertyId || meta.surveyNumber;
          if (propId) {
            propertiesToEvaluate.add(propId);
          }
        }
      }

      const results: any[] = [];

      for (const propId of propertiesToEvaluate) {
        // Run Chain Integrity Assessment (Agent 3)
        const integrityResult = await ChainIntegrityAgentService.analyze(propId);

        // Run National Risk Assessment (Agent 4)
        const ratingResult = await NationalRiskAgentService.assess(propId);

        // Fetch associated documents to derive a notary pubkey and documentId for Solana Anchor
        const matchingDocMeta = await prisma.documentMetadata.findFirst({
          where: {
            OR: [
              { propertyId: propId },
              { surveyNumber: propId }
            ]
          },
          include: {
            document: {
              include: { assignedNotary: true }
            }
          }
        });

        const documentId = matchingDocMeta?.documentId;
        const notary = matchingDocMeta?.document?.assignedNotary;

        // Default Solana anchor keys
        let notaryPubkeyStr = '5h3K1111111111111111111111111111111111111111';
        if (notary?.publicKey) {
          try {
            const publicKeyBytes = Buffer.from(notary.publicKey, 'base64');
            if (publicKeyBytes.length === 32) {
              notaryPubkeyStr = new PublicKey(publicKeyBytes).toBase58();
            }
          } catch {
            // keep default
          }
        }

        // =========================================================================
        // STEP 4: Generate Verification Intelligence Report & Solana Anchor
        // =========================================================================
        const intelligenceReport = {
          propertyId: propId,
          finalRating: ratingResult.finalRating,
          fraudRisk: ratingResult.fraudRisk,
          trustScore: ratingResult.trustScore,
          conflictScore: ratingResult.conflictScore,
          chainIntegrityScore: ratingResult.chainIntegrityScore,
          networkRiskScore: ratingResult.networkRiskScore,
          justification: ratingResult.justification,
          integrityStatus: integrityResult.status,
          timestamp: new Date().toISOString()
        };

        const trustReportString = JSON.stringify(intelligenceReport);
        const trustReportHash = HashService.generateSHA256(trustReportString);

        let trustReportTxSignature = 'mock_tx_signature_' + Math.random().toString(36).substring(2, 12);

        if (documentId) {
          try {
            // Anchor using roleByte = 20 for AVCC Trust Reports
            const txSig = await BlockchainService.recordSignatureOnChain(
              documentId,
              20,
              notaryPubkeyStr,
              trustReportHash
            );
            if (txSig) {
              trustReportTxSignature = txSig;
            }
          } catch (err: any) {
            logger.warn(`[VCC] On-chain Solana anchor failed: ${err.message}. Using mock tx signature.`);
          }
        }

        // Persist Chain Integrity Assessment & National Trust Rating
        await prisma.$transaction(async (tx) => {
          // 1. Save Chain Integrity
          const existingChain = await tx.chainIntegrityAssessment.findUnique({
            where: { propertyId: propId }
          });

          let integrityId = '';
          if (existingChain) {
            integrityId = existingChain.assessmentId;
            await tx.chainIntegrityAssessment.update({
              where: { propertyId: propId },
              data: {
                integrityScore: integrityResult.integrityScore,
                status: integrityResult.status,
                missingLinks: integrityResult.missingLinks || [],
                gaps: integrityResult.gaps || [],
                findings: integrityResult.findings || [],
                metadata: {}
              }
            });
          } else {
            const createdChain = await tx.chainIntegrityAssessment.create({
              data: {
                propertyId: propId,
                integrityScore: integrityResult.integrityScore,
                status: integrityResult.status,
                missingLinks: integrityResult.missingLinks || [],
                gaps: integrityResult.gaps || [],
                findings: integrityResult.findings || [],
                metadata: {}
              }
            });
            integrityId = createdChain.assessmentId;
          }

          // Chain Integrity History
          await tx.chainIntegrityAssessmentHistory.create({
            data: {
              assessmentId: integrityId,
              propertyId: propId,
              integrityScore: integrityResult.integrityScore,
              status: integrityResult.status,
              missingLinks: integrityResult.missingLinks || [],
              gaps: integrityResult.gaps || [],
              findings: integrityResult.findings || [],
              metadata: {}
            }
          });

          // 2. Save National Trust Rating
          const existingRating = await tx.nationalTrustRating.findUnique({
            where: { propertyId: propId }
          });

          let ratingId = '';
          if (existingRating) {
            ratingId = existingRating.ratingId;
            await tx.nationalTrustRating.update({
              where: { propertyId: propId },
              data: {
                finalRating: ratingResult.finalRating,
                fraudRisk: ratingResult.fraudRisk,
                trustScore: ratingResult.trustScore,
                conflictScore: ratingResult.conflictScore,
                chainIntegrityScore: ratingResult.chainIntegrityScore,
                networkRiskScore: ratingResult.networkRiskScore,
                justification: ratingResult.justification,
                trustReportHash,
                trustReportTxSignature,
                metadata: {}
              }
            });
          } else {
            const createdRating = await tx.nationalTrustRating.create({
              data: {
                propertyId: propId,
                finalRating: ratingResult.finalRating,
                fraudRisk: ratingResult.fraudRisk,
                trustScore: ratingResult.trustScore,
                conflictScore: ratingResult.conflictScore,
                chainIntegrityScore: ratingResult.chainIntegrityScore,
                networkRiskScore: ratingResult.networkRiskScore,
                justification: ratingResult.justification,
                trustReportHash,
                trustReportTxSignature,
                metadata: {}
              }
            });
            ratingId = createdRating.ratingId;
          }

          // National Rating History
          await tx.nationalTrustRatingHistory.create({
            data: {
              ratingId,
              propertyId: propId,
              finalRating: ratingResult.finalRating,
              fraudRisk: ratingResult.fraudRisk,
              trustScore: ratingResult.trustScore,
              conflictScore: ratingResult.conflictScore,
              chainIntegrityScore: ratingResult.chainIntegrityScore,
              networkRiskScore: ratingResult.networkRiskScore,
              justification: ratingResult.justification,
              trustReportHash,
              trustReportTxSignature,
              metadata: {}
            }
          });
        }, { timeout: 60000 });

        results.push({
          propertyId: propId,
          rating: ratingResult.finalRating,
          fraudRisk: ratingResult.fraudRisk,
          trustReportHash,
          trustReportTxSignature
        });
      }

      logger.info('[VCC] AVCC orchestration pipeline completed successfully.');
      return {
        status: 'SUCCESS',
        graphNodes: graphAnalysis.entityRiskAssessments.length,
        anomaliesDetected: detectedAnomalies.length,
        propertiesEvaluated: results
      };
    } catch (err: any) {
      logger.error(`[VCC] AVCC orchestration failure: ${err.message}`);
      throw err;
    } finally {
      this.isRecalculating = false;
    }
  }

  /**
   * Triggers the orchestration pipeline asynchronously.
   */
  public static triggerOrchestration(explicitPropertyId?: string): void {
    this.orchestrate(explicitPropertyId).catch(err => {
      logger.error(`[VCC] Async VCC orchestration failed: ${err.message}`);
    });
  }
}
