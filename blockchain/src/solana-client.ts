import { Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

export class SolanaClient {
  public connection: Connection;
  public relayerKeypair: Keypair;

  constructor(rpcUrl: string, relayerPrivateKey: string) {
    if (!rpcUrl) {
      throw new Error('SOLANA_RPC_URL must be provided.');
    }
    this.connection = new Connection(rpcUrl, 'confirmed');

    if (!relayerPrivateKey) {
      // Fallback keypair for testing if not configured
      console.warn('SOLANA_RELAYER_PRIVATE_KEY not set. Using ephemeral testing keypair.');
      this.relayerKeypair = Keypair.generate();
    } else {
      try {
        // Try parsing as base58
        this.relayerKeypair = Keypair.fromSecretKey(bs58.decode(relayerPrivateKey));
      } catch (err) {
        try {
          // Try parsing as json array
          const parsed = JSON.parse(relayerPrivateKey);
          this.relayerKeypair = Keypair.fromSecretKey(Uint8Array.from(parsed));
        } catch {
          throw new Error('Invalid SOLANA_RELAYER_PRIVATE_KEY format. Must be base58 or JSON array.');
        }
      }
    }
  }

  public getAddress(): string {
    return this.relayerKeypair.publicKey.toBase58();
  }
}
