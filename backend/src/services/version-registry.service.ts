import { basePrisma } from '../config/db';
import crypto from 'crypto';

export interface VersionMatrix {
  platformVersion: string;
  schemaVersion: string;
  prismaClientVersion: string;
  aiModelVersion: string;
  promptVersion: string;
  blockchainProgramVersion: string;
  smartContractVersion: string;
  connectorContractVersion: string;
  apiVersion: string;
  featureFlagVersion: string;
  compliancePolicyVersion: string;
  securityPolicyVersion: string;
}

export class VersionRegistryService {
  private static activeMatrix: VersionMatrix = {
    platformVersion: '2.0.0',
    schemaVersion: '2.1.0',
    prismaClientVersion: '5.22.0',
    aiModelVersion: 'nemotron-4-340b:v1',
    promptVersion: 'legal-audit-prompt:3.1',
    blockchainProgramVersion: 'solana-ltn-prog:1.2',
    smartContractVersion: 'ethereum-notary-anchor:1.0',
    connectorContractVersion: 'bank-connector-contract:1.1',
    apiVersion: 'v1.0.0',
    featureFlagVersion: 'ff-registry:1.2',
    compliancePolicyVersion: 'compliance-policy:4.0',
    securityPolicyVersion: 'security-policy:4.0'
  };

  /**
   * Retrieves the active 12-dimensional version matrix of the platform.
   */
  static getActiveVersionMatrix(): VersionMatrix {
    return { ...this.activeMatrix };
  }

  /**
   * Updates the active version matrix (called during live rolling upgrades).
   */
  static updateActiveVersionMatrix(updates: Partial<VersionMatrix>): void {
    this.activeMatrix = {
      ...this.activeMatrix,
      ...updates
    };
  }

  /**
   * Computes a unique, deterministic cryptographic SHA256 hash of the version matrix.
   */
  static computeSnapshotHash(matrix: VersionMatrix): string {
    const serialized = JSON.stringify({
      platformVersion: matrix.platformVersion,
      schemaVersion: matrix.schemaVersion,
      prismaClientVersion: matrix.prismaClientVersion,
      aiModelVersion: matrix.aiModelVersion,
      promptVersion: matrix.promptVersion,
      blockchainProgramVersion: matrix.blockchainProgramVersion,
      smartContractVersion: matrix.smartContractVersion,
      connectorContractVersion: matrix.connectorContractVersion,
      apiVersion: matrix.apiVersion,
      featureFlagVersion: matrix.featureFlagVersion,
      compliancePolicyVersion: matrix.compliancePolicyVersion,
      securityPolicyVersion: matrix.securityPolicyVersion
    });

    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Registers a version snapshot in the database, ensuring long-term audit reproducibility.
   */
  static async registerSnapshot(matrix: VersionMatrix): Promise<string> {
    const hash = this.computeSnapshotHash(matrix);

    try {
      // Upsert the snapshot in the database to prevent duplicate key errors
      await basePrisma.versionGovernanceRegistry.upsert({
        where: { hash },
        update: {},
        create: {
          platformVersion: matrix.platformVersion,
          schemaVersion: matrix.schemaVersion,
          prismaClientVersion: matrix.prismaClientVersion,
          aiModelVersion: matrix.aiModelVersion,
          promptVersion: matrix.promptVersion,
          blockchainProgramVersion: matrix.blockchainProgramVersion,
          smartContractVersion: matrix.smartContractVersion,
          connectorContractVersion: matrix.connectorContractVersion,
          apiVersion: matrix.apiVersion,
          featureFlagVersion: matrix.featureFlagVersion,
          compliancePolicyVersion: matrix.compliancePolicyVersion,
          securityPolicyVersion: matrix.securityPolicyVersion,
          hash
        }
      });
    } catch (err) {
      console.error('Failed to register VersionGovernanceRegistry snapshot:', err);
    }

    return hash;
  }

  /**
   * Retrieves a registered version snapshot by its hash.
   */
  static async getSnapshotByHash(hash: string): Promise<VersionMatrix | null> {
    const record = await basePrisma.versionGovernanceRegistry.findUnique({
      where: { hash }
    });

    if (!record) return null;

    return {
      platformVersion: record.platformVersion,
      schemaVersion: record.schemaVersion,
      prismaClientVersion: record.prismaClientVersion,
      aiModelVersion: record.aiModelVersion,
      promptVersion: record.promptVersion,
      blockchainProgramVersion: record.blockchainProgramVersion,
      smartContractVersion: record.smartContractVersion,
      connectorContractVersion: record.connectorContractVersion,
      apiVersion: record.apiVersion,
      featureFlagVersion: record.featureFlagVersion,
      compliancePolicyVersion: record.compliancePolicyVersion,
      securityPolicyVersion: record.securityPolicyVersion
    };
  }
}
