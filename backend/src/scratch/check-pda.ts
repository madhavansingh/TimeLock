import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config/env';
import crypto from 'crypto';

async function checkPda() {
  const connection = new Connection(config.solanaRpcUrl || 'https://api.devnet.solana.com', 'confirmed');
  const programId = new PublicKey(config.solanaProgramId);
  const documentId = 'ffe2b82f-605e-4e30-8241-744eff9934d0';

  const docIdHash = crypto.createHash('sha256').update(documentId).digest();
  const [docPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('document'), docIdHash],
    programId
  );

  console.log(`Document PDA Address: ${docPda.toBase58()}`);

  const accountInfo = await connection.getAccountInfo(docPda);
  if (!accountInfo) {
    console.log('Account not found on-chain');
    return;
  }

  const data = accountInfo.data;
  console.log(`Account Data Length: ${data.length} bytes`);

  const docIdHashHex = data.slice(8, 40).toString('hex');
  const contentHashHex = data.slice(40, 72).toString('hex');
  const timestamp = data.readBigInt64LE(72);
  const status = data[80];
  const signerCount = data[81];
  const requiredSigners = data[82];
  const authority = new PublicKey(data.slice(83, 115));
  const bump = data[115];

  console.log('=== On-Chain Document PDA State ===');
  console.log(`Document ID Hash: ${docIdHashHex}`);
  console.log(`Content Hash:     ${contentHashHex}`);
  console.log(`Timestamp:        ${new Date(Number(timestamp) * 1000).toISOString()} (${timestamp})`);
  console.log(`Status:           ${status}`);
  console.log(`Signer Count:     ${signerCount}`);
  console.log(`Req Signers:      ${requiredSigners}`);
  console.log(`Authority:        ${authority.toBase58()}`);
  console.log(`Bump:             ${bump}`);
}

checkPda().catch(console.error);
