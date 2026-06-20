import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { HashService } from '../hash.service';
import { SolanaClient } from './solana-client';
import { config } from '../../config/env';
import crypto from 'crypto';

const getAnchorDiscriminator = (name: string): Buffer => {
  const hash = HashService.generateSHA256(`global:${name}`);
  return Buffer.from(hash.substring(0, 16), 'hex');
};

async function simulate() {
  const documentId = 'ffe2b82f-605e-4e30-8241-744eff9934d0';
  const statusByte = 3; // Fully signed

  const solanaClient = new SolanaClient({
    rpcUrl: config.solanaRpcUrl,
    relayerPrivateKey: config.solanaRelayerPrivateKey,
    programId: config.solanaProgramId
  });

  const programId = new PublicKey(config.solanaProgramId);
  const docIdHash = crypto.createHash('sha256').update(documentId).digest();
  
  const [docPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('document'), docIdHash],
    programId
  );

  const discriminator = getAnchorDiscriminator('update_status');
  const statusBuffer = Buffer.from([statusByte]);

  const ixData = Buffer.concat([
    discriminator,
    statusBuffer
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: docPda, isSigner: false, isWritable: true },
      { pubkey: solanaClient.relayerKeypair.publicKey, isSigner: true, isWritable: true }
    ],
    programId,
    data: ixData
  });

  const tx = new Transaction().add(instruction);
  
  const { blockhash } = await solanaClient.connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = solanaClient.relayerKeypair.publicKey;

  tx.sign(solanaClient.relayerKeypair);

  console.log('Simulating update_status...');
  try {
    const res = await solanaClient.connection.simulateTransaction(tx);
    console.log('Simulation result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error during simulation:', err);
  }
}

simulate();
