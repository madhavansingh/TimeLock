import { SolanaClient, DocumentProgramClient } from 'blockchain';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_RELAYER_PRIVATE_KEY = process.env.SOLANA_RELAYER_PRIVATE_KEY || '';

export class BlockchainService {
  private static solanaClient: SolanaClient;
  private static programClient: DocumentProgramClient;

  private static getClients() {
    if (!this.solanaClient) {
      this.solanaClient = new SolanaClient(SOLANA_RPC_URL, SOLANA_RELAYER_PRIVATE_KEY);
      this.programClient = new DocumentProgramClient(this.solanaClient);
    }
    return { solanaClient: this.solanaClient, programClient: this.programClient };
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
    const sig = await programClient.initializeDocument(documentId, contentHashHex, requiredSigners);
    const { pda } = programClient.deriveDocumentPDA(documentId);

    return {
      signature: sig,
      pdaAddress: pda.toBase58()
    };
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
    return await programClient.recordSignature(
      documentId,
      signerRoleByte,
      signerPubkeyStr,
      certRefHashHex
    );
  }

  /**
   * Updates document status on-chain.
   */
  public static async updateStatusOnChain(documentId: string, statusByte: number): Promise<string> {
    const { programClient } = this.getClients();
    return await programClient.updateStatus(documentId, statusByte);
  }
}
