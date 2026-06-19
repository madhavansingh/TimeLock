import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { SolanaClient } from './solana-client';
import crypto from 'crypto';

// Anchor Program ID for Legal TimeLock Network (LTN)
export const PROGRAM_ID = new PublicKey('LTN1111111111111111111111111111111111111111');

export interface DocumentRecordOnChain {
  documentIdHash: Buffer;
  contentHash: Buffer;
  timestamp: number;
  status: string;
  signerCount: number;
  requiredSigners: number;
  authority: string;
}

export class DocumentProgramClient {
  private client: SolanaClient;

  constructor(client: SolanaClient) {
    this.client = client;
  }

  // Derive Document PDA: findProgramAddress(["document", sha256(document_id)], program_id)
  public deriveDocumentPDA(documentId: string): { pda: PublicKey; bump: number } {
    const docIdHash = crypto.createHash('sha256').update(documentId).digest();
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('document'), docIdHash],
      PROGRAM_ID
    );
    return { pda, bump };
  }

  // Derive Signature PDA: findProgramAddress(["signature", document_record_pubkey, signer_role_byte], program_id)
  public deriveSignaturePDA(documentPda: PublicKey, signerRoleByte: number): { pda: PublicKey; bump: number } {
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('signature'), documentPda.toBuffer(), Buffer.from([signerRoleByte])],
      PROGRAM_ID
    );
    return { pda, bump };
  }

  // Initialize a new Document Record on-chain
  public async initializeDocument(
    documentId: string,
    contentHashHex: string,
    requiredSigners = 1
  ): Promise<string> {
    const { pda } = this.deriveDocumentPDA(documentId);
    const contentHashBuffer = Buffer.from(contentHashHex, 'hex');

    // For Hackathon MVP/Testing, if using Localnet or Devnet we construct the transaction:
    // In production, this would call Anchor program instruction `initializeDocument`
    // We construct a mock transaction structure or real instruction data layout:
    try {
      const ixData = Buffer.concat([
        Buffer.from([0]), // Instruction index for initializeDocument
        crypto.createHash('sha256').update(documentId).digest(),
        contentHashBuffer,
        Buffer.from([requiredSigners])
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: this.client.relayerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: ixData
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = this.client.relayerKeypair.publicKey;
      
      // Attempt sending transaction to cluster (will fail if invalid cluster or fake keys, so catch)
      const sig = await this.client.connection.sendTransaction(tx, [this.client.relayerKeypair], {
        skipPreflight: true
      });
      return sig;
    } catch (err: any) {
      console.warn('Solana RPC send failed or program not deployed. Simulating on-chain receipt:', err.message);
      // Simulate receipt signature for hackathon dev environment
      return crypto.randomBytes(32).toString('hex') + '_mock_sig';
    }
  }

  // Record a Signature on-chain
  public async recordSignature(
    documentId: string,
    signerRoleByte: number,
    signerPublicKeyStr: string,
    certRefHashHex: string
  ): Promise<string> {
    const { pda: docPda } = this.deriveDocumentPDA(documentId);
    const signerPubkey = new PublicKey(signerPublicKeyStr);
    const { pda: sigPda } = this.deriveSignaturePDA(docPda, signerRoleByte);
    const certRefBuffer = Buffer.from(certRefHashHex, 'hex');

    try {
      const ixData = Buffer.concat([
        Buffer.from([1]), // Instruction index for recordSignature
        Buffer.from([signerRoleByte]),
        certRefBuffer
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: docPda, isSigner: false, isWritable: true },
          { pubkey: sigPda, isSigner: false, isWritable: true },
          { pubkey: signerPubkey, isSigner: true, isWritable: true },
          { pubkey: this.client.relayerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: ixData
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = this.client.relayerKeypair.publicKey;

      const sig = await this.client.connection.sendTransaction(tx, [
        this.client.relayerKeypair
      ], { skipPreflight: true });
      return sig;
    } catch (err: any) {
      console.warn('Solana RPC sign failed. Simulating on-chain signature receipt:', err.message);
      return crypto.randomBytes(32).toString('hex') + '_mock_sig';
    }
  }

  // Update Status of Document PDA on-chain (e.g. to DISPUTED or REVOKED)
  public async updateStatus(documentId: string, statusByte: number): Promise<string> {
    const { pda } = this.deriveDocumentPDA(documentId);

    try {
      const ixData = Buffer.from([2, statusByte]); // Instruction index 2 = updateStatus

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: pda, isSigner: false, isWritable: true },
          { pubkey: this.client.relayerKeypair.publicKey, isSigner: true, isWritable: true }
        ],
        programId: PROGRAM_ID,
        data: ixData
      });

      const tx = new Transaction().add(instruction);
      tx.feePayer = this.client.relayerKeypair.publicKey;

      const sig = await this.client.connection.sendTransaction(tx, [this.client.relayerKeypair]);
      return sig;
    } catch (err: any) {
      console.warn('Solana RPC update status failed. Simulating on-chain update receipt:', err.message);
      return crypto.randomBytes(32).toString('hex') + '_mock_sig';
    }
  }
}
