import { Connection, PublicKey } from '@solana/web3.js';

// Pre-computed account discriminator for DocumentRecord: sha256("account:DocumentRecord").slice(0, 8)
export const DOCUMENT_RECORD_DISCRIMINATOR = [137, 240, 169, 137, 60, 48, 172, 97];

export interface FieldDefinition {
  name: string;
  type: 'u8' | 'i64' | 'Pubkey' | 'bytes32';
}

export const DOCUMENT_RECORD_SCHEMA: FieldDefinition[] = [
  { name: 'documentIdHash', type: 'bytes32' },
  { name: 'contentHash', type: 'bytes32' },
  { name: 'timestamp', type: 'i64' },
  { name: 'status', type: 'u8' },
  { name: 'signerCount', type: 'u8' },
  { name: 'requiredSigners', type: 'u8' },
  { name: 'authority', type: 'Pubkey' },
  { name: 'bump', type: 'u8' }
];

export async function sha256(message: string): Promise<Uint8Array> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  return new Uint8Array(hashBuffer);
}

export async function deriveDocumentPDA(documentId: string, programIdStr: string) {
  const docIdHash = await sha256(documentId);
  const programId = new PublicKey(programIdStr);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('document'), docIdHash],
    programId
  );
  return { pda, bump };
}

// Convert Uint8Array to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to read 64-bit int from little-endian bytes safely in JS double floats
function readInt64LE(bytes: Uint8Array, offset: number): number {
  const low = bytes[offset] + 
              (bytes[offset + 1] << 8) + 
              (bytes[offset + 2] << 16) + 
              ((bytes[offset + 3] << 24) >>> 0);
  const high = bytes[offset + 4] + 
               (bytes[offset + 5] << 8) + 
               (bytes[offset + 6] << 16) + 
               ((bytes[offset + 7] << 24) >>> 0);
  return high * 4294967296 + low;
}

export function deserializeDocumentRecord(data: Uint8Array) {
  if (data.length < 116) {
    throw new Error(`Data too short. Expected at least 116 bytes, got ${data.length}`);
  }

  // Check discriminator
  for (let i = 0; i < 8; i++) {
    if (data[i] !== DOCUMENT_RECORD_DISCRIMINATOR[i]) {
      throw new Error('Invalid account discriminator. Not a DocumentRecord.');
    }
  }

  const result: any = {};
  let offset = 8; // skip discriminator

  for (const field of DOCUMENT_RECORD_SCHEMA) {
    if (field.type === 'u8') {
      result[field.name] = data[offset];
      offset += 1;
    } else if (field.type === 'i64') {
      result[field.name] = readInt64LE(data, offset);
      offset += 8;
    } else if (field.type === 'bytes32') {
      result[field.name] = data.slice(offset, offset + 32);
      offset += 32;
    } else if (field.type === 'Pubkey') {
      const pubkeyBytes = data.slice(offset, offset + 32);
      result[field.name] = new PublicKey(pubkeyBytes).toBase58();
      offset += 32;
    }
  }

  return result;
}

export function isStatusCompatible(onchainStatus: number, backendStatus: string): boolean {
  if (backendStatus === 'PENDING') return onchainStatus === 0;
  if (backendStatus === 'ONCHAIN_CONFIRMED') return onchainStatus === 1 || onchainStatus === 2;
  if (backendStatus === 'NOTARY_REVIEW_STARTED') return onchainStatus === 1 || onchainStatus === 2;
  if (backendStatus === 'READY_FOR_SIGNATURE') return onchainStatus === 1 || onchainStatus === 2;
  // NOTARY_SIGNED could map to active status (1 or 2) or fully signed status (3) if it met the threshold
  if (backendStatus === 'NOTARY_SIGNED') return onchainStatus === 1 || onchainStatus === 2 || onchainStatus === 3;
  if (backendStatus === 'FULLY_EXECUTED') return onchainStatus === 3;
  if (backendStatus === 'DISPUTED') return onchainStatus === 5;
  if (backendStatus === 'REVOKED') return onchainStatus === 6;
  return false;
}

export interface VerificationDetails {
  pdaAddress: string;
  slot: number;
  onchainStatus: number;
  onchainHash: string;
  ownerMatches: boolean;
  signatureValid: boolean;
  statusValid: boolean;
  hashValid: boolean;
}

export async function verifyDocumentOnChain(
  documentId: string,
  expectedTxSignature: string | null,
  expectedStatus: string,
  expectedContentHash: string | null, // can be '[REDACTED]' or the calculated hash
  programIdStr: string = 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w',
  rpcUrl: string = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
): Promise<{ success: boolean; details?: VerificationDetails; error?: string }> {
  try {
    const { pda } = await deriveDocumentPDA(documentId, programIdStr);
    const pdaAddress = pda.toBase58();

    const connection = new Connection(rpcUrl, 'confirmed');

    // 1. Fetch account info along with current context slot
    const accountInfoRes = await connection.getAccountInfoAndContext(pda);
    const readSlot = accountInfoRes.context.slot;
    const accountInfo = accountInfoRes.value;

    if (!accountInfo) {
      return { success: false, error: 'PDA account does not exist on Solana Devnet ledger.' };
    }

    // 2. Verify account owner matches program ID
    const ownerMatches = accountInfo.owner.toBase58() === programIdStr;
    if (!ownerMatches) {
      return { success: false, error: 'Account owner does not match program ID.' };
    }

    // 3. Deserialize data
    const record = deserializeDocumentRecord(accountInfo.data);
    const onchainHash = bytesToHex(record.contentHash);
    const onchainStatus = record.status;

    // 4. Verify status compatibility
    const statusValid = isStatusCompatible(onchainStatus, expectedStatus);

    // 5. Verify transaction signature existence and confirmation status
    let signatureValid = false;
    let txSlot = readSlot;
    if (expectedTxSignature) {
      const sigStatus = await connection.getSignatureStatus(expectedTxSignature);
      if (sigStatus && sigStatus.value) {
        signatureValid = true;
        txSlot = sigStatus.value.slot;
      }
    } else {
      // If there is no signature from backend, then transaction signature check cannot pass
      signatureValid = false;
    }

    // 6. Verify hash
    let hashValid = true;
    if (expectedContentHash && expectedContentHash !== '[REDACTED]') {
      hashValid = onchainHash === expectedContentHash;
    }

    const success = ownerMatches && statusValid && signatureValid && hashValid;

    return {
      success,
      details: {
        pdaAddress,
        slot: txSlot,
        onchainStatus,
        onchainHash,
        ownerMatches,
        signatureValid,
        statusValid,
        hashValid
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error occurred during on-chain verification.' };
  }
}

export const SIGNATURE_RECORD_DISCRIMINATOR = [131, 228, 158, 203, 39, 52, 166, 51];

export interface SignatureRecordDetails {
  pdaAddress: string;
  signerRole: number;
  signerPubkey: string;
  signedAt: number;
  offChainCertRef: string;
  isValid: boolean;
}

export async function verifySignatureRecordOnChain(
  documentId: string,
  signerRoleByte: number,
  expectedCertRefHashHex: string | null,
  programIdStr: string = 'EbKjjyvxck5REvVXTXuAvPDrydzKFniiGgLdKSeyfc3w',
  rpcUrl: string = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
): Promise<{ success: boolean; details?: SignatureRecordDetails; error?: string }> {
  try {
    const { pda: docPda } = await deriveDocumentPDA(documentId, programIdStr);
    const programId = new PublicKey(programIdStr);
    
    // Seeds: signature, documentPda, [signerRoleByte]
    const [pda] = PublicKey.findProgramAddressSync(
      [
        new TextEncoder().encode('signature'),
        docPda.toBuffer(),
        new Uint8Array([signerRoleByte])
      ],
      programId
    );
    const pdaAddress = pda.toBase58();

    const connection = new Connection(rpcUrl, 'confirmed');
    const accountInfo = await connection.getAccountInfo(pda);

    if (!accountInfo) {
      return { success: false, error: 'Signature record PDA account does not exist on Solana Devnet ledger.' };
    }

    const data = new Uint8Array(accountInfo.data);
    if (data.length < 113) {
      return { success: false, error: `SignatureRecord data too short: ${data.length} bytes` };
    }

    // Check discriminator
    for (let i = 0; i < 8; i++) {
      if (data[i] !== SIGNATURE_RECORD_DISCRIMINATOR[i]) {
        return { success: false, error: 'Account discriminator mismatch. Not a valid SignatureRecord.' };
      }
    }

    const signerRole = data[40];
    const signerPubkey = new PublicKey(data.slice(41, 73)).toBase58();
    const signedAt = readInt64LE(data, 73);
    const offChainCertRef = bytesToHex(data.slice(81, 113));

    let isValid = true;
    if (expectedCertRefHashHex) {
      isValid = offChainCertRef.toLowerCase() === expectedCertRefHashHex.toLowerCase();
    }

    return {
      success: isValid,
      details: {
        pdaAddress,
        signerRole,
        signerPubkey,
        signedAt,
        offChainCertRef,
        isValid
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error occurred during on-chain signature verification.' };
  }
}

