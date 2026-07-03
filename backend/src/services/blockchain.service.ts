import { SolanaClient, DocumentProgramClient } from './solana';
import { config } from '../config/env';
import { BlockchainError } from '../config/errors';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { HashService } from './hash.service';
import { PublicKey } from '@solana/web3.js';
import { ResilienceService } from './resilience.service';
import { ProductionHealthService } from './production-health.service';

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
   * Retrieves the Base58 address of the system relayer wallet.
   */
  public static getRelayerAddress(): string {
    const { solanaClient } = this.getClients();
    return solanaClient.getAddress();
  }

  /**
   * Retrieves the active SolanaClient instance.
   */
  public static getSolanaClientInstance() {
    const { solanaClient } = this.getClients();
    return solanaClient;
  }

  /**
   * Helper to execute program client operations with retries (exponential backoff)
   * wrapped in a Circuit Breaker and Timeout, throwing BlockchainError if it fails.
   */
  private static async executeWithRetry<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await ResilienceService.execute(
        'SOLANA_RPC',
        async () => {
          return await ResilienceService.executeWithRetry(
            `Solana_${operationName}`,
            fn,
            3,
            500
          );
        },
        [],
        { failureThreshold: 3, cooldownMs: 10000, timeoutMs: 30000 }
      );

      ProductionHealthService.registerExecution('SOLANA_RPC', Date.now() - startTime, true);
      return result;
    } catch (err: any) {
      ProductionHealthService.registerExecution('SOLANA_RPC', Date.now() - startTime, false, err.message);
      logger.error(`[Blockchain Service Fatal] Solana operation "${operationName}" failed: ${err.message}`);
      throw new BlockchainError(`Solana blockchain operation "${operationName}" failed: ${err.message}`, err);
    }
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
      let signerSecretKey: Uint8Array | undefined;
      try {
        const publicKeyBytes = new PublicKey(signerPubkeyStr).toBytes();
        const publicKeyBase64 = Buffer.from(publicKeyBytes).toString('base64');
        const notary = await prisma.notary.findFirst({
          where: { publicKey: publicKeyBase64 }
        });
        if (notary) {
          const naclKeypair = HashService.getNotaryKeypair(notary.notaryId);
          signerSecretKey = naclKeypair.secretKey;
        }
      } catch (err) {
        logger.warn(`[BlockchainService] Failed to derive notary keypair for ${signerPubkeyStr}: ${err}`);
      }

      return await programClient.recordSignature(
        documentId,
        signerRoleByte,
        signerPubkeyStr,
        certRefHashHex,
        signerSecretKey
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
