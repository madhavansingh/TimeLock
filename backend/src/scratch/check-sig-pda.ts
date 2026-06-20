import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config/env';
import crypto from 'crypto';

async function checkSigPda() {
  const connection = new Connection(config.solanaRpcUrl || 'https://api.devnet.solana.com', 'confirmed');
  const programId = new PublicKey(config.solanaProgramId);
  const documentId = 'ffe2b82f-605e-4e30-8241-744eff9934d0';

  const docIdHash = crypto.createHash('sha256').update(documentId).digest();
  const [docPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('document'), docIdHash],
    programId
  );

  const [sigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('signature'), docPda.toBuffer(), Buffer.from([10])],
    programId
  );

  console.log(`Document PDA:  ${docPda.toBase58()}`);
  console.log(`Signature PDA: ${sigPda.toBase58()} (role 10)`);

  const accountInfo = await connection.getAccountInfo(sigPda);
  if (!accountInfo) {
    console.log('Signature account not found on-chain');
    return;
  }

  const data = accountInfo.data;
  console.log(`Signature Account Data Length: ${data.length} bytes`);

  // Parse according to layout:
  // 0-8: Discriminator
  // 8-40: document_record (Pubkey - 32 bytes)
  // 40: signer_role (u8)
  // 41-73: signer_pubkey (Pubkey - 32 bytes)
  // 73-81: signed_at (i64)
  // 81-113: off_chain_cert_ref (32 bytes)

  const docRecord = new PublicKey(data.slice(8, 40));
  const signerRole = data[40];
  const signerPubkey = new PublicKey(data.slice(41, 73));
  const signedAt = data.readBigInt64LE(73);
  const certRef = data.slice(81, 113).toString('hex');

  console.log('=== On-Chain Signature PDA State ===');
  console.log(`Doc Record:    ${docRecord.toBase58()}`);
  console.log(`Signer Role:   ${signerRole}`);
  console.log(`Signer PubKey: ${signerPubkey.toBase58()}`);
  console.log(`Signed At:     ${new Date(Number(signedAt) * 1000).toISOString()} (${signedAt})`);
  console.log(`Cert Ref:      ${certRef}`);
}

checkSigPda().catch(console.error);
