/**
 * storage.interface.ts — Storage Provider Contract
 *
 * Defines the interface for document storage adapters.
 * Current implementation: StorageService (simulated Pinata IPFS mock).
 * Future implementations: Real Pinata, AWS S3, Azure Blob.
 *
 * DO NOT implement business logic here. This is a pure contract definition.
 */

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

/** Result returned after uploading a document to decentralized storage */
export interface StorageUploadResult {
  /**
   * Content Identifier (CID) — the IPFS content-addressed hash.
   * In mock mode this is a deterministic "Qm..." prefixed string.
   */
  cid: string;

  /**
   * Opaque reference to the encryption key used to encrypt the file
   * before storage. In production this would be a KMS key ID or ARN.
   * In mock mode this is a random "kms_key_ref_..." string.
   */
  keyReference: string;

  /** Whether this is a real IPFS upload or a simulated local mock */
  isMock: boolean;
}

/** Result returned after downloading and decrypting a document */
export interface StorageDownloadResult {
  /** Decrypted file content as a Buffer */
  content: Buffer;
  /** MIME type if determinable; otherwise undefined */
  mimeType?: string;
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------
export interface IStorageService {
  /**
   * Encrypts and uploads a document to decentralized storage.
   *
   * @param fileBuffer - Raw binary content of the file
   * @param filename   - Original filename (used for metadata/logging)
   * @returns Upload result with CID and key reference
   */
  uploadDocument(fileBuffer: Buffer, filename: string): Promise<StorageUploadResult>;

  /**
   * Downloads and decrypts a document from decentralized storage.
   *
   * @param cid          - IPFS Content Identifier
   * @param keyReference - Encryption key reference returned during upload
   * @returns Download result with decrypted file content
   */
  downloadDocument(cid: string, keyReference: string): Promise<StorageDownloadResult>;
}
