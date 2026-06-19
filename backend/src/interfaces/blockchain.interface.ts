/**
 * blockchain.interface.ts — Blockchain Integration Contract
 *
 * Defines the interface that any blockchain integration layer must satisfy.
 * The current implementation (BlockchainService) wraps the local `/blockchain`
 * package. This interface ensures the backend is not tightly coupled to that
 * specific package — a different adapter (e.g. a REST relay, a mock, or a
 * different chain) can be swapped in by implementing this interface.
 *
 * DO NOT implement business logic here. This is a pure contract definition.
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

/** Result returned after a document is anchored on-chain */
export interface OnChainRegistrationResult {
  /** Blockchain transaction signature / hash (e.g. Solana tx signature) */
  signature: string;
  /** Derived Program Derived Address (PDA) public key as Base58 string */
  pdaAddress: string;
  /** Whether this is a real on-chain transaction or a simulated mock receipt */
  isMock: boolean;
}

/** Result returned after a signature is recorded on-chain */
export interface OnChainSignatureResult {
  /** Blockchain transaction signature for the signature record instruction */
  signature: string;
  /** Whether this is a real on-chain transaction or a simulated mock receipt */
  isMock: boolean;
}

/** Result returned after document status is updated on-chain */
export interface OnChainStatusUpdateResult {
  /** Blockchain transaction signature for the status update instruction */
  signature: string;
  isMock: boolean;
}

// ---------------------------------------------------------------------------
// Signer role bytes (matches Anchor program enum)
// ---------------------------------------------------------------------------
export enum SignerRoleByte {
  NOTARY = 1,
  BUYER = 2,
  SELLER = 3,
  OTHER = 4,
}

// ---------------------------------------------------------------------------
// Document status bytes (matches Anchor program enum)
// ---------------------------------------------------------------------------
export enum DocumentStatusByte {
  PENDING = 0,
  ONCHAIN_CONFIRMED = 1,
  NOTARY_SIGNED = 2,
  FULLY_EXECUTED = 3,
  DISPUTED = 4,
  REVOKED = 5,
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------
export interface IBlockchainService {
  /**
   * Anchors a document's hash and required-signer count on-chain.
   *
   * @param documentId  - UUID of the document (used to derive PDA seed)
   * @param contentHashHex - SHA-256 hash of document content (64-char hex)
   * @param requiredSigners - Number of signatures required to fully execute
   * @returns On-chain registration result with tx signature and PDA address
   */
  registerDocumentOnChain(
    documentId: string,
    contentHashHex: string,
    requiredSigners: number
  ): Promise<OnChainRegistrationResult>;

  /**
   * Records a party or notary signature on-chain.
   *
   * @param documentId      - UUID of the document
   * @param signerRoleByte  - Numeric role byte (see SignerRoleByte enum)
   * @param signerPublicKey - Signer's Solana public key (Base58)
   * @param certRefHashHex  - SHA-256 hash of the DSC certificate serial
   * @returns On-chain signature result
   */
  recordSignatureOnChain(
    documentId: string,
    signerRoleByte: number,
    signerPublicKey: string,
    certRefHashHex: string
  ): Promise<OnChainSignatureResult>;

  /**
   * Updates the status byte of a document's on-chain PDA record.
   *
   * @param documentId  - UUID of the document
   * @param statusByte  - Target status (see DocumentStatusByte enum)
   * @returns On-chain status update result
   */
  updateStatusOnChain(
    documentId: string,
    statusByte: number
  ): Promise<OnChainStatusUpdateResult>;
}
