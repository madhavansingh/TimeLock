import { prisma } from '../../config/db';
import { logger } from '../../config/logger';
import { NemotronService } from './nemotron.service';

export interface EntityRisk {
  entityId: string;
  entityType: 'CITIZEN' | 'NOTARY' | 'PROPERTY' | 'DOCUMENT';
  riskScore: number;
  trustScore: number;
  factors: string[];
}

export interface TrustNetworkAgentResult {
  trustGraphScore: number;
  networkRiskScore: number;
  riskFactors: string[];
  entityRiskAssessments: EntityRisk[];
}

export class TrustGraphService {
  private static SYSTEM_PROMPT = `You are the Legal TimeLock Network (LTN) Trust Network Agent.
Your purpose is to evaluate the global Trust Graph connecting Citizens, Notaries, Properties, Documents, Transfers, Evidence, Cases, and Blockchain Anchors.
Analyze:
1. Suspicious ownership chains (lack of continuous registry transitions).
2. Excessive transfer frequency (same property transferred multiple times recently).
3. Repeated conflict involvement (citizens/properties involved in multiple disputes or overlapping claims).
4. High-risk notaries (notaries signing abnormal volumes or associated with multiple rejected cases).
5. Repeated evidence deficiencies (cases lacking prior deeds or tax receipts).

You MUST evaluate and include a risk assessment entry in "entityRiskAssessments" for every DOCUMENT and every PROPERTY node listed in the graph. Do not omit any properties or documents. Keep the "factors" array description strings extremely short (under 5 words each) to prevent response truncation.

You must respond ONLY with a raw JSON object matching the following TypeScript interface:
{
  "trustGraphScore": number, // 0 to 100
  "networkRiskScore": number, // 0 to 100
  "riskFactors": string[],
  "entityRiskAssessments": Array<{
    "entityId": string,
    "entityType": "CITIZEN" | "NOTARY" | "PROPERTY" | "DOCUMENT",
    "riskScore": number,
    "trustScore": number,
    "factors": string[]
  }>
}
Ensure no markdown formatting (like \`\`\`json) in your final response. Return ONLY valid parsed JSON.`;

  /**
   * Compiles the live trust graph nodes and edges from PostgreSQL.
   * Executes the Trust Network Agent to compute risk scores.
   * Persists all nodes, edges, entity risk assessments, and histories inside a transaction.
   */
  public static async buildAndAnalyze(): Promise<TrustNetworkAgentResult> {
    logger.info('[TrustGraphService] Compiling live trust graph...');

    // 1. Fetch all records to build the graph
    const citizens = await prisma.user.findMany({ where: { role: 'CITIZEN' } });
    const notaries = await prisma.notary.findMany();
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        metadata: true,
        transfers: true,
        verificationCase: {
          include: { evidence: true }
        }
      }
    });

    const tempNodes: Array<{ entityType: string; entityId: string; label: string; metadata: any }> = [];
    const tempEdges: Array<{ sourceNodeId: string; targetNodeId: string; relationType: string; weight: number; metadata: any }> = [];

    // Map to keep track of nodes
    const nodeKeyToUuid = new Map<string, string>();

    // Helper to add nodes locally
    const registerNode = (entityType: string, entityId: string, label: string, metadata: any = {}) => {
      const key = `${entityType}:${entityId}`;
      const virtualId = `${entityType.toLowerCase()}_${entityId}`;
      if (nodeKeyToUuid.has(key)) {
        return nodeKeyToUuid.get(key)!;
      }
      nodeKeyToUuid.set(key, virtualId);
      tempNodes.push({ entityType, entityId, label, metadata });
      return virtualId;
    };

    // Add Node: Citizens
    for (const c of citizens) {
      registerNode('CITIZEN', c.userId, `Citizen ID: ${c.userId.slice(0, 8)}`, { phoneHash: c.phoneHash });
    }

    // Add Node: Notaries
    for (const n of notaries) {
      registerNode('NOTARY', n.notaryId, `Notary: ${n.name}`, { isAccredited: n.isAccredited });
    }

    // Add Node: Properties and Documents
    for (const d of documents) {
      const docNodeId = registerNode('DOCUMENT', d.documentId, `Deed: ${d.title}`, { status: d.status, type: d.type });

      // Property Node
      const propId = d.metadata?.propertyId || d.metadata?.surveyNumber;
      if (propId) {
        const propNodeId = registerNode('PROPERTY', propId, `Property ID: ${propId}`, {
          surveyNumber: d.metadata?.surveyNumber,
          registrationNumber: d.metadata?.registrationNumber
        });

        // Edge: Document -> Property
        tempEdges.push({
          sourceNodeId: docNodeId,
          targetNodeId: propNodeId,
          relationType: 'REGISTERED_TO',
          weight: 1.0,
          metadata: {}
        });

        // Edge: Citizen (Owner) -> Property
        const citizenNodeKey = `CITIZEN:${d.ownerUserId}`;
        if (nodeKeyToUuid.has(citizenNodeKey)) {
          const citizenNodeId = nodeKeyToUuid.get(citizenNodeKey)!;
          tempEdges.push({
            sourceNodeId: citizenNodeId,
            targetNodeId: propNodeId,
            relationType: 'CLAIMS_OWNERSHIP',
            weight: d.status === 'FULLY_EXECUTED' || d.status === 'NOTARY_SIGNED' ? 1.0 : 0.5,
            metadata: { status: d.status }
          });
        }
      }

      // Edge: Citizen (Owner) -> Document
      const citizenNodeKey = `CITIZEN:${d.ownerUserId}`;
      if (nodeKeyToUuid.has(citizenNodeKey)) {
        const citizenNodeId = nodeKeyToUuid.get(citizenNodeKey)!;
        tempEdges.push({
          sourceNodeId: citizenNodeId,
          targetNodeId: docNodeId,
          relationType: 'OWNER_OF',
          weight: 1.0,
          metadata: {}
        });
      }

      // Edge: Document -> Notary (Assigned)
      if (d.assignedNotaryId) {
        const notaryNodeKey = `NOTARY:${d.assignedNotaryId}`;
        if (nodeKeyToUuid.has(notaryNodeKey)) {
          const notaryNodeId = nodeKeyToUuid.get(notaryNodeKey)!;
          tempEdges.push({
            sourceNodeId: docNodeId,
            targetNodeId: notaryNodeId,
            relationType: 'ASSIGNED_TO',
            weight: 1.0,
            metadata: {}
          });
        }
      }

      // Verification Case Node
      if (d.verificationCase) {
        const vc = d.verificationCase;
        const caseNodeId = registerNode('CASE', vc.caseId, `Case: ${vc.status}`, { trustScore: vc.trustScore });

        // Edge: Document -> Case
        tempEdges.push({
          sourceNodeId: docNodeId,
          targetNodeId: caseNodeId,
          relationType: 'HAS_CASE',
          weight: 1.0,
          metadata: {}
        });

        // Edge: Case -> Notary
        const notaryNodeKey = `NOTARY:${vc.notaryId}`;
        if (nodeKeyToUuid.has(notaryNodeKey)) {
          const notaryNodeId = nodeKeyToUuid.get(notaryNodeKey)!;
          tempEdges.push({
            sourceNodeId: caseNodeId,
            targetNodeId: notaryNodeId,
            relationType: 'VERIFIED_BY',
            weight: 1.0,
            metadata: {}
          });
        }

        // Evidence Nodes & Edges
        for (const ev of vc.evidence) {
          const evidenceNodeId = registerNode('EVIDENCE', ev.evidenceId, `Evidence: ${ev.title}`, { ipfsCid: ev.ipfsCid });

          // Edge: Case -> Evidence
          tempEdges.push({
            sourceNodeId: caseNodeId,
            targetNodeId: evidenceNodeId,
            relationType: 'HAS_EVIDENCE',
            weight: 1.0,
            metadata: {}
          });
        }

        // On-chain Anchor Node & Edge
        if (vc.vplOnchainTx) {
          const anchorNodeId = registerNode('ANCHOR', vc.vplOnchainTx, `Solana Tx: ${vc.vplOnchainTx.slice(0, 8)}`, { tx: vc.vplOnchainTx });

          // Edge: Case -> Anchor
          tempEdges.push({
            sourceNodeId: caseNodeId,
            targetNodeId: anchorNodeId,
            relationType: 'ANCHORED_BY',
            weight: 1.0,
            metadata: {}
          });
        }
      }

      // Document directly Anchored
      if (d.onchainTxSignature) {
        const anchorNodeId = registerNode('ANCHOR', d.onchainTxSignature, `Solana Tx: ${d.onchainTxSignature.slice(0, 8)}`, { tx: d.onchainTxSignature });
        tempEdges.push({
          sourceNodeId: docNodeId,
          targetNodeId: anchorNodeId,
          relationType: 'ANCHORED_BY',
          weight: 1.0,
          metadata: {}
        });
      }

      // Transfers Nodes & Edges
      for (const t of d.transfers) {
        const transferNodeId = registerNode('TRANSFER', t.transferId, `Transfer: ${t.transferType}`, { status: t.status });

        // Edge: Document -> Transfer
        tempEdges.push({
          sourceNodeId: docNodeId,
          targetNodeId: transferNodeId,
          relationType: 'HAS_TRANSFER',
          weight: 1.0,
          metadata: {}
        });

        // Edge: Transfer -> Notary (if assigned)
        if (t.assignedNotaryId) {
          const notaryNodeKey = `NOTARY:${t.assignedNotaryId}`;
          if (nodeKeyToUuid.has(notaryNodeKey)) {
            const notaryNodeId = nodeKeyToUuid.get(notaryNodeKey)!;
            tempEdges.push({
              sourceNodeId: transferNodeId,
              targetNodeId: notaryNodeId,
              relationType: 'ASSIGNED_TO',
              weight: 1.0,
              metadata: {}
            });
          }
        }

        // Transfer Anchor
        if (t.blockchainTxSig) {
          const anchorNodeId = registerNode('ANCHOR', t.blockchainTxSig, `Solana Tx: ${t.blockchainTxSig.slice(0, 8)}`, { tx: t.blockchainTxSig });
          tempEdges.push({
            sourceNodeId: transferNodeId,
            targetNodeId: anchorNodeId,
            relationType: 'ANCHORED_BY',
            weight: 1.0,
            metadata: {}
          });
        }
      }
    }

    // Deduplicate edges to prevent database unique constraint violations
    const seenEdges = new Set<string>();
    const finalEdges: typeof tempEdges = [];
    for (const edge of tempEdges) {
      const key = `${edge.sourceNodeId}->${edge.targetNodeId}:${edge.relationType}`;
      if (!seenEdges.has(key)) {
        seenEdges.add(key);
        finalEdges.push(edge);
      }
    }

    // 2. Prepare user prompt with the serialized graph metadata for AI reasoning
    const graphStats = {
      totalNodes: tempNodes.length,
      totalEdges: finalEdges.length,
      nodes: tempNodes.map(n => ({ type: n.entityType, id: n.entityId, label: n.label })),
      edges: finalEdges.map(e => ({ from: e.sourceNodeId, to: e.targetNodeId, type: e.relationType }))
    };

    const userPrompt = `Analyze this Legal Trust Graph database state:
Graph Stats:
- Total Nodes: ${graphStats.totalNodes}
- Total Edges: ${graphStats.totalEdges}

Details:
Nodes:
${JSON.stringify(graphStats.nodes.slice(0, 50), null, 2)}

Edges:
${JSON.stringify(graphStats.edges.slice(0, 50), null, 2)}
`;

    const stateHashInput = {
      nodesCount: tempNodes.length,
      edgesCount: finalEdges.length,
      documentsHash: documents.map(d => d.status).join(':')
    };

    const cacheKey = NemotronService.generateCacheKey('global_graph', { agent: 'trust-network', ...stateHashInput });

    const agentResult = await NemotronService.invoke({
      systemPrompt: this.SYSTEM_PROMPT,
      userPrompt,
      cacheKey,
      fallbackGenerator: () => this.generateDeterministicFallback(tempNodes, finalEdges, documents)
    }) as TrustNetworkAgentResult;

    // 3. Persist everything in PostgreSQL in a transaction
    await prisma.$transaction(async (tx) => {
      // Clear existing graph edges and nodes
      await tx.trustGraphEdge.deleteMany();
      await tx.trustGraphNode.deleteMany();

      // Create new Nodes
      for (const n of tempNodes) {
        const createdNode = await tx.trustGraphNode.create({
          data: {
            entityType: n.entityType,
            entityId: n.entityId,
            label: n.label,
            metadata: n.metadata || {}
          }
        });

        // Node History
        await tx.trustGraphNodeHistory.create({
          data: {
            nodeId: createdNode.nodeId,
            entityType: createdNode.entityType,
            entityId: createdNode.entityId,
            label: createdNode.label,
            metadata: createdNode.metadata || {}
          }
        });
      }

      // Refetch nodes to map UUIDs correctly for foreign key mapping
      const dbNodes = await tx.trustGraphNode.findMany();
      const dbNodeMap = new Map<string, string>(); // 'entityType:entityId' -> nodeId (UUID)
      for (const dbNode of dbNodes) {
        dbNodeMap.set(`${dbNode.entityType}:${dbNode.entityId}`, dbNode.nodeId);
      }

      // Create new Edges
      for (const e of finalEdges) {
        // Map virtual node ID back to the real DB TrustGraphNode nodeId UUID
        const sourceRealKey = e.sourceNodeId.split('_'); // e.g. ['citizen', 'userId']
        const targetRealKey = e.targetNodeId.split('_');

        const sourceEntityType = sourceRealKey[0].toUpperCase();
        const sourceEntityId = sourceRealKey.slice(1).join('_');
        const targetEntityType = targetRealKey[0].toUpperCase();
        const targetEntityId = targetRealKey.slice(1).join('_');

        const sourceUuid = dbNodeMap.get(`${sourceEntityType}:${sourceEntityId}`);
        const targetUuid = dbNodeMap.get(`${targetEntityType}:${targetEntityId}`);

        if (sourceUuid && targetUuid) {
          const createdEdge = await tx.trustGraphEdge.create({
            data: {
              sourceNodeId: sourceUuid,
              targetNodeId: targetUuid,
              relationType: e.relationType,
              weight: e.weight,
              metadata: e.metadata || {}
            }
          });

          // Edge History
          await tx.trustGraphEdgeHistory.create({
            data: {
              edgeId: createdEdge.edgeId,
              sourceNodeId: createdEdge.sourceNodeId,
              targetNodeId: createdEdge.targetNodeId,
              relationType: createdEdge.relationType,
              weight: createdEdge.weight,
              metadata: createdEdge.metadata || {}
            }
          });
        }
      }

      // Save Entity Risk Assessments
      for (const era of agentResult.entityRiskAssessments) {
        const existingEra = await tx.entityRiskAssessment.findUnique({
          where: { entityType_entityId: { entityType: era.entityType, entityId: era.entityId } }
        });

        if (existingEra) {
          const updatedEra = await tx.entityRiskAssessment.update({
            where: { assessmentId: existingEra.assessmentId },
            data: {
              trustScore: era.trustScore,
              riskScore: era.riskScore,
              riskFactors: era.factors || [],
              metadata: {}
            }
          });

          // History
          await tx.entityRiskAssessmentHistory.create({
            data: {
              assessmentId: updatedEra.assessmentId,
              entityId: updatedEra.entityId,
              entityType: updatedEra.entityType,
              trustScore: updatedEra.trustScore,
              riskScore: updatedEra.riskScore,
              riskFactors: updatedEra.riskFactors || {},
              metadata: {}
            }
          });
        } else {
          const newEra = await tx.entityRiskAssessment.create({
            data: {
              entityId: era.entityId,
              entityType: era.entityType,
              trustScore: era.trustScore,
              riskScore: era.riskScore,
              riskFactors: era.factors || [],
              metadata: {}
            }
          });

          // History
          await tx.entityRiskAssessmentHistory.create({
            data: {
              assessmentId: newEra.assessmentId,
              entityId: newEra.entityId,
              entityType: newEra.entityType,
              trustScore: newEra.trustScore,
              riskScore: newEra.riskScore,
              riskFactors: newEra.riskFactors || {},
              metadata: {}
            }
          });
        }
      }
    }, { timeout: 60000 });

    logger.info('[TrustGraphService] Trust graph construction and analysis completed successfully.');
    return agentResult;
  }

  /**
   * Deterministic local fallback generator.
   */
  private static generateDeterministicFallback(nodes: any[], edges: any[], documents: any[]): TrustNetworkAgentResult {
    const riskFactors: string[] = [];
    const entityRiskAssessments: EntityRisk[] = [];

    // Analyze properties and documents for risk
    let highRiskCount = 0;
    let conflictDeedsCount = 0;

    for (const d of documents) {
      const dFactors: string[] = [];
      let dRisk = 15;

      const hasUnresolvedConflicts = d.verificationCase?.challenges?.some(
        (c: any) => c.type === 'CONFLICT' && !c.resolved
      );

      if (hasUnresolvedConflicts) {
        dRisk += 50;
        conflictDeedsCount++;
        dFactors.push('Unresolved property survey overlap conflict.');
      }

      const caseScore = d.verificationCase?.trustScore ?? 100;
      if (caseScore < 70) {
        dRisk += 25;
        dFactors.push('Low verification checklist trust score.');
      }

      if (d.status === 'DISPUTED') {
        dRisk += 40;
        dFactors.push('Deed registered under legal dispute.');
      }

      // Excessive ownership transfers check
      if (d.transfers?.length > 2) {
        dRisk += 15;
        dFactors.push('Excessive ownership transfer volume (velocity risk).');
      }

      dRisk = Math.min(98, Math.max(5, dRisk));
      const dTrust = 100 - dRisk;

      if (dRisk > 50) highRiskCount++;

      entityRiskAssessments.push({
        entityId: d.documentId,
        entityType: 'DOCUMENT',
        riskScore: dRisk,
        trustScore: dTrust,
        factors: dFactors.length > 0 ? dFactors : ['Document status aligned with VPL checklist.']
      });

      // Also create risk assessment for Property if it has metadata
      const propId = d.metadata?.propertyId || d.metadata?.surveyNumber;
      if (propId) {
        entityRiskAssessments.push({
          entityId: propId,
          entityType: 'PROPERTY',
          riskScore: dRisk,
          trustScore: dTrust,
          factors: dFactors.length > 0 ? dFactors : ['Property registry matched.']
        });
      }

      // Notary assessment
      if (d.assignedNotaryId) {
        const notaryAccredited = d.assignedNotary?.isAccredited ?? true;
        entityRiskAssessments.push({
          entityId: d.assignedNotaryId,
          entityType: 'NOTARY',
          riskScore: notaryAccredited ? (hasUnresolvedConflicts ? 30 : 10) : 90,
          trustScore: notaryAccredited ? (hasUnresolvedConflicts ? 70 : 90) : 10,
          factors: notaryAccredited
            ? (hasUnresolvedConflicts ? ['Assigned notary handling unresolved conflicts.'] : ['Notary credentials verified.'])
            : ['Notary is not accredited.']
        });
      }

      // Owner assessment
      entityRiskAssessments.push({
        entityId: d.ownerUserId,
        entityType: 'CITIZEN',
        riskScore: dRisk > 60 ? 45 : 15,
        trustScore: dRisk > 60 ? 55 : 85,
        factors: dRisk > 60 ? ['Citizen associated with high-risk ownership records.'] : ['Ownership record clear.']
      });
    }

    // Network risk summaries
    let trustGraphScore = 90;
    let networkRiskScore = 15;

    if (conflictDeedsCount > 0) {
      trustGraphScore -= 20;
      networkRiskScore += 30;
      riskFactors.push(`${conflictDeedsCount} unresolved property title overlapping conflicts detected.`);
    }

    if (highRiskCount > 0) {
      trustGraphScore -= 15;
      networkRiskScore += 20;
      riskFactors.push(`${highRiskCount} high-risk deed chains active on network.`);
    }

    if (riskFactors.length === 0) {
      riskFactors.push('Trust graph networks aligned. No anomalies or double-claims registered.');
    }

    return {
      trustGraphScore: Math.max(10, trustGraphScore),
      networkRiskScore: Math.min(95, networkRiskScore),
      riskFactors,
      entityRiskAssessments
    };
  }
}
