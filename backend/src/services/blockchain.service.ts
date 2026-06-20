import { SolanaClient, DocumentProgramClient } from 'blockchain';
import { config } from '../config/env';
import { BlockchainError } from '../config/errors';
import { logger } from '../config/logger';

export class BlockchainService {
  private static solanaClient: SolanaClient;
  private static programClient: DocumentProgramClient;

  private static getClients() {
    if (!this.solanaClient) {
      this.solanaClient = new SolanaClient({
        rpcUrl: config.solanaRpcUrl,
        relayerPrivateKey: config.solanaRelayerPrivateKey,
        programId: config.solanaProgramId
      });
      
      // Enforce strict production profile with zero mock failovers
      this.programClient = new DocumentProgramClient(this.solanaClient, {
        strictMode: true,
        profile: 'production'
      });
    }
    return { solanaClient: this.solanaClient, programClient: this.programClient };
  }

  /**
   * Helper to execute program client operations with retries (exponential backoff)
   * and throw typed BlockchainError if all attempts fail.
   */
  private static async executeWithRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let attempt = 1;
    let delay = 500; // 500ms initial delay

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        logger.warn(`[Solana Retry] Operation "${operationName}" Attempt ${attempt} failed: ${err.message}`);
        if (attempt === maxRetries) {
          logger.error(`[Solana Fatal] Operation "${operationName}" failed after ${maxRetries} attempts: ${err.message}`);
          throw new BlockchainError(`Solana blockchain operation "${operationName}" failed: ${err.message}`, err);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // Exponential backoff
      }
    }
    throw new BlockchainError(`Solana blockchain operation "${operationName}" failed.`);
  }

  /**
   * Commits document details to Solana network.
   */
  public static async registerDocumentOnChain(
    documentId: string,
    contentHashHex: string,
    requiredSigners = 1
  ): Promise<{ signature: string; pdaAddress: string }> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('registerDocument', async () => {
      const sig = await programClient.initializeDocument(documentId, contentHashHex, requiredSigners);
      const { pda } = programClient.deriveDocumentPDA(documentId);
      return {
        signature: sig,
        pdaAddress: pda.toBase58()
      };
    });
  }

  /**
   * Commits party or notary signature on-chain.
   */
  public static async recordSignatureOnChain(
    documentId: string,
    signerRoleByte: number,
    signerPubkeyStr: string,
    certRefHashHex: string
  ): Promise<string> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('recordSignature', async () => {
      return await programClient.recordSignature(
        documentId,
        signerRoleByte,
        signerPubkeyStr,
        certRefHashHex
      );
    });
  }

  /**
   * Updates document status on-chain.
   */
  public static async updateStatusOnChain(documentId: string, statusByte: number): Promise<string> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('updateStatus', async () => {
      return await programClient.updateStatus(documentId, statusByte);
    });
  }

  /**
   * Initiates on-chain ownership transfer.
   */
  public static async initiateOwnershipTransfer(
    documentId: string,
    previousOwner: string,
    newOwner: string
  ): Promise<any> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('initiateOwnershipTransfer', async () => {
      return await programClient.initiateOwnershipTransfer(documentId, previousOwner, newOwner);
    });
  }

  /**
   * Approves on-chain ownership transfer.
   */
  public static async approveOwnershipTransfer(
    documentId: string,
    transferId: string,
    role: string,
    signerAddress: string,
    signatureBytes: string
  ): Promise<any> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('approveOwnershipTransfer', async () => {
      return await programClient.approveOwnershipTransfer(documentId, transferId, role, signerAddress, signatureBytes);
    });
  }

  /**
   * Finalizes on-chain ownership transfer.
   */
  public static async finalizeOwnershipTransfer(
    documentId: string,
    transferId: string
  ): Promise<any> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('finalizeOwnershipTransfer', async () => {
      return await programClient.finalizeOwnershipTransfer(documentId, transferId);
    });
  }

  /**
   * Registers a new authority.
   */
  public static async registerAuthority(
    authorityKey: string,
    role: 'NOTARY' | 'GOVERNMENT' | 'BANK' | 'AUDITOR' | 'OWNER' | 'BUYER',
    details: string
  ): Promise<void> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('registerAuthority', async () => {
      return await programClient.registerAuthority(authorityKey, role, details);
    });
  }

  /**
   * Verifies if a given public key is an active authority.
   */
  public static async verifyAuthority(authorityKey: string): Promise<any> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('verifyAuthority', async () => {
      return await programClient.verifyAuthority(authorityKey);
    });
  }

  /**
   * Revokes an active authority.
   */
  public static async revokeAuthority(authorityKey: string): Promise<void> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('revokeAuthority', async () => {
      return await programClient.revokeAuthority(authorityKey);
    });
  }

  /**
   * Gets all registered authorities.
   */
  public static async getAuthorities(): Promise<any[]> {
    const { programClient } = this.getClients();
    return this.executeWithRetry('getAuthorities', async () => {
      return await programClient.getAuthorities();
    });
  }
}
