import { Connection, Keypair, Commitment } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Configuration options for the Legal TimeLock Network (LTN) blockchain integration.
 */
export interface BlockchainConfig {
  /**
   * Solana JSON-RPC URL (e.g., https://api.devnet.solana.com, http://127.0.0.1:8899).
   */
  rpcUrl?: string;
  /**
   * The private key of the Relayer / Fee-payer authority.
   * Can be a Base58 encoded string or a JSON number array string.
   */
  relayerPrivateKey?: string;
  /**
   * The legal timelock network program ID public key string.
   */
  programId?: string;
  /**
   * Default commitment level for transactions and queries.
   */
  commitment?: Commitment;
}

/**
 * SolanaClient manages the connection to the Solana cluster and holds the Relayer keypair
 * responsible for transaction construction and execution fees.
 */
export class SolanaClient {
  public connection: Connection;
  public relayerKeypair: Keypair;
  public programId: string;
  public commitment: Commitment;

  constructor(
    configOrRpcUrl?: BlockchainConfig | string,
    relayerPrivateKey?: string
  ) {
    let rpcUrl = '';
    let privateKey = '';
    let programId = 'LTN1111111111111111111111111111111111111111';
    let commitment: Commitment = 'confirmed';

    if (typeof configOrRpcUrl === 'string') {
      rpcUrl = configOrRpcUrl;
      privateKey = relayerPrivateKey || '';
    } else if (configOrRpcUrl && typeof configOrRpcUrl === 'object') {
      rpcUrl = configOrRpcUrl.rpcUrl || '';
      privateKey = configOrRpcUrl.relayerPrivateKey || '';
      programId = configOrRpcUrl.programId || programId;
      commitment = configOrRpcUrl.commitment || commitment;
    }

    // Fallbacks to environment variables
    rpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    privateKey = privateKey || process.env.SOLANA_RELAYER_PRIVATE_KEY || '';
    this.programId = process.env.SOLANA_PROGRAM_ID || programId;
    this.commitment = (process.env.SOLANA_COMMITMENT as Commitment) || commitment;

    this.connection = new Connection(rpcUrl, this.commitment);

    if (!privateKey) {
      console.warn('SOLANA_RELAYER_PRIVATE_KEY not set. Using ephemeral testing keypair.');
      this.relayerKeypair = Keypair.generate();
    } else {
      try {
        // Try decoding as base58
        this.relayerKeypair = Keypair.fromSecretKey(bs58.decode(privateKey));
      } catch (err) {
        try {
          // Try parsing as JSON array of numbers
          const parsed = JSON.parse(privateKey);
          this.relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(parsed));
        } catch {
          throw new Error('Invalid SOLANA_RELAYER_PRIVATE_KEY format. Must be base58 or JSON array.');
        }
      }
    }
  }

  /**
   * Retrieves the Base58 address of the relayer wallet.
   */
  public getAddress(): string {
    return this.relayerKeypair.publicKey.toBase58();
  }
}

