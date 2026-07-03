import { prisma, basePrisma } from '../../config/db';
import { logger } from '../../config/logger';

export interface InferredEdge {
  sourceId: string;
  targetId: string;
  relationType: string;
  probability: number; // 0.0 to 1.0
  explanation: string;
}

export interface GraphCommunity {
  communityId: string;
  members: Array<{ id: string; type: string }>;
  cohesionScore: number;
}

export class GraphIntelligenceService {
  /**
   * Performs advanced graph analysis algorithms on the Trust Graph database tables.
   */
  public static async analyzeGraph(): Promise<any> {
    logger.info('[GraphIntelligence] Loading trust graph nodes and edges for analysis...');

    // 1. Fetch nodes and edges from database
    const nodes = await basePrisma.trustGraphNode.findMany();
    const edges = await basePrisma.trustGraphEdge.findMany();

    if (nodes.length === 0) {
      return {
        inferredEdges: [],
        communities: [],
        anomalies: [],
        trustScores: {}
      };
    }

    // Map of nodes for quick indexing
    const nodeMap = new Map<string, any>();
    nodes.forEach(n => nodeMap.set(n.nodeId, n));

    // 2. Trust Propagation Algorithm (PageRank-style)
    // Seed trusted nodes (notaries and accredited entities) with baseline high scores
    const trustScores: Record<string, number> = {};
    nodes.forEach(n => {
      trustScores[n.nodeId] = n.entityType === 'NOTARY' ? 95 : 70; // seed values
    });

    // Run 3 iterations of power method trust propagation
    for (let iter = 0; iter < 3; iter++) {
      const tempScores = { ...trustScores };
      edges.forEach(edge => {
        const sourceScore = trustScores[edge.sourceNodeId] || 70;
        // Propagate fraction of trust to target based on edge weight
        tempScores[edge.targetNodeId] = Math.min(100, (tempScores[edge.targetNodeId] || 70) + (sourceScore * 0.05 * edge.weight));
      });
      Object.assign(trustScores, tempScores);
    }

    // 3. Relationship Inference (Link Prediction)
    const inferredEdges: InferredEdge[] = [];
    // If two citizen nodes claim ownership or participate in transfers on the same property, infer a transaction relation
    const propertyToOwners = new Map<string, string[]>();
    edges.forEach(edge => {
      if (edge.relationType === 'REGISTERED_TO' || edge.relationType === 'CLAIMS_OWNERSHIP') {
        const propertyId = edge.targetNodeId;
        const ownerId = edge.sourceNodeId;
        if (!propertyToOwners.has(propertyId)) {
          propertyToOwners.set(propertyId, []);
        }
        propertyToOwners.get(propertyId)!.push(ownerId);
      }
    });

    propertyToOwners.forEach((owners, propertyId) => {
      if (owners.length > 1) {
        // Infer link between co-owners or sequential buyers
        for (let i = 0; i < owners.length; i++) {
          for (let j = i + 1; j < owners.length; j++) {
            inferredEdges.push({
              sourceId: owners[i],
              targetId: owners[j],
              relationType: 'CO_TRANSACTION_PARTNER',
              probability: 0.85,
              explanation: `Inferred relationship between ${owners[i]} and ${owners[j]} due to shared transaction history on Property ${propertyId}.`
            });
          }
        }
      }
    });

    // 4. Community Detection (Label Propagation simulation)
    // Assign modular communities based on shared notary signatures or districts
    const communities: GraphCommunity[] = [];
    const notaryToDocs = new Map<string, string[]>();
    edges.forEach(edge => {
      if (edge.relationType === 'ASSIGNED_TO' || edge.relationType === 'VERIFIED_BY') {
        const notaryId = edge.targetNodeId;
        const docId = edge.sourceNodeId;
        if (!notaryToDocs.has(notaryId)) {
          notaryToDocs.set(notaryId, []);
        }
        notaryToDocs.get(notaryId)!.push(docId);
      }
    });

    let communityIndex = 1;
    notaryToDocs.forEach((docs, notaryId) => {
      if (docs.length > 1) {
        communities.push({
          communityId: `COMMUNITY-${communityIndex++}`,
          members: [
            { id: notaryId, type: 'NOTARY' },
            ...docs.map(d => ({ id: d, type: 'DOCUMENT' }))
          ],
          cohesionScore: parseFloat((0.7 + (docs.length * 0.02)).toFixed(2))
        });
      }
    });

    // 5. Fraud Network & Anomaly Clusters (Circular Flip detection)
    // Detect cycles in ownership transfers: e.g. A -> B -> C -> A
    const anomalies: any[] = [];
    const circularFlips = await this.detectCircularFlips();
    if (circularFlips.length > 0) {
      anomalies.push({
        type: 'CIRCULAR_OWNERSHIP_FLIP',
        severity: 'HIGH',
        nodes: circularFlips,
        description: 'High-risk circular ownership pattern detected (Deed transferred sequentially across a closed group of entities).'
      });
    }

    return {
      inferredEdges,
      communities,
      anomalies,
      trustScores
    };
  }

  /**
   * Scans transfer histories to detect circular flips (A -> B -> C -> A).
   */
  private static async detectCircularFlips(): Promise<string[]> {
    // Query recent ownership transfers
    const transfers = await basePrisma.ownershipTransfer.findMany({
      orderBy: { initiatedAt: 'asc' },
      take: 50
    });

    if (transfers.length < 3) return [];

    // Simple cycle detection algorithm
    const adj = new Map<string, string>();
    transfers.forEach(t => {
      if (t.previousOwnerHash && t.newOwnerHash) {
        adj.set(t.previousOwnerHash, t.newOwnerHash);
      }
    });

    for (const [startNode] of adj) {
      const visited = new Set<string>();
      let curr = startNode;
      const path = [];

      while (curr && !visited.has(curr)) {
        visited.add(curr);
        path.push(curr);
        curr = adj.get(curr) || '';
      }

      if (curr === startNode && path.length >= 3) {
        // Cycle detected
        return path;
      }
    }

    return [];
  }
}
