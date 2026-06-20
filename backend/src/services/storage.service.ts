import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { StorageError } from '../config/errors';

export class StorageService {
  private static readonly MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || 'ltn_master_enc_key_2026_kleos_super_secure';

  public static encryptKey(plaintextKey: string): string {
    const iv = crypto.randomBytes(12);
    const hashedMaster = crypto.createHash('sha256').update(this.MASTER_KEY).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', hashedMaster, iv);
    let encrypted = cipher.update(plaintextKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  public static decryptKey(encryptedKey: string): string {
    try {
      const parts = encryptedKey.split(':');
      if (parts.length !== 3) return encryptedKey; // Fallback if already plaintext
      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const hashedMaster = crypto.createHash('sha256').update(this.MASTER_KEY).digest();
      const decipher = crypto.createDecipheriv('aes-256-gcm', hashedMaster, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      return encryptedKey;
    }
  }

  /**
   * Helper to execute a fetch operation with exponential backoff retries.
   */
  private static async fetchWithRetry(url: string, init: RequestInit, operationName: string): Promise<Response> {
    const maxRetries = 3;
    let attempt = 1;
    let delay = 1000; // 1s initial delay

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s request timeout
        const res = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);
        return res;
      } catch (err: any) {
        logger.warn(`[Storage Retry] Operation "${operationName}" Attempt ${attempt} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        delay *= 2; // Exponential backoff
      }
    }
    throw new Error(`Storage operation "${operationName}" failed after retries.`);
  }

  /**
   * Uploads an encrypted copy of the document to decentralized storage.
   * STRICT NO-MOCK POLICY: If credentials are mock or upload fails, throw StorageError.
   */
  public static async uploadDocument(
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ cid: string; keyReference: string; isMock: boolean }> {
    const isMock = !config.pinataJwt || 
                   config.pinataJwt === 'mock_pinata_jwt_token_for_hackathon' ||
                   config.pinataJwt.startsWith('mock');

    // 1. Encrypt raw file using local symmetric AES-256 key
    const key = crypto.randomBytes(32); // Generate a secure random 256-bit key
    const iv = crypto.randomBytes(16);  // Generate 128-bit initialization vector

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encryptedBytes = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);

    // Prepend the 16-byte IV to the encrypted bytes so that it is retrieved alongside the file
    const payload = Buffer.concat([iv, encryptedBytes]);
    const rawKeyRef = key.toString('hex');
    const keyReference = StorageService.encryptKey(rawKeyRef);

    if (isMock) {
      logger.error('[STORAGE ERROR] Mock Pinata upload requested but STRICT NO-MOCK POLICY is active.');
      throw new StorageError('IPFS/Pinata storage credentials are not configured or invalid. Please configure a valid PINATA_JWT in the environment.');
    }

    // 2. Real Pinata IPFS upload using fetch and FormData
    logger.info(`[STORAGE] Starting real Pinata upload for ${filename}...`);
    try {
      const formData = new FormData();
      // Convert buffer payload to Blob
      const blob = new Blob([payload], { type: 'application/octet-stream' });
      formData.append('file', blob, filename);

      // Add optional metadata
      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          encType: 'aes-256-cbc',
          uploadedAt: new Date().toISOString(),
        }
      });
      formData.append('pinataMetadata', metadata);

      const response = await this.fetchWithRetry('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.pinataJwt}`,
        },
        body: formData,
      }, 'pinFileToIPFS');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata response error: ${response.status} - ${errorText}`);
      }

      const resJson = (await response.json()) as any;
      const cid = resJson.IpfsHash;

      logger.info(`[STORAGE] Real Pinata upload completed. File: ${filename}, Size: ${payload.length} bytes, CID: ${cid}`);

      return {
        cid,
        keyReference,
        isMock: false
      };
    } catch (err: any) {
      logger.error('[STORAGE] Real Pinata upload failed, throwing StorageError', { error: err.message });
      throw new StorageError(`Failed to upload document to IPFS storage: ${err.message}`, err);
    }
  }

  /**
   * Downloads and decrypts document contents from IPFS storage.
   */
  public static async downloadDocument(cid: string, keyReference: string): Promise<Buffer> {
    const isMock = !config.pinataJwt || 
                   config.pinataJwt === 'mock_pinata_jwt_token_for_hackathon' ||
                   config.pinataJwt.startsWith('mock');

    const decryptedKey = StorageService.decryptKey(keyReference);
    const key = Buffer.from(decryptedKey, 'hex');

    if (isMock) {
      logger.error('[STORAGE ERROR] Mock Pinata download requested but STRICT NO-MOCK POLICY is active.');
      throw new StorageError('IPFS/Pinata storage credentials are not configured or invalid. Please configure a valid PINATA_JWT in the environment.');
    }

    logger.info(`[STORAGE] Downloading real file from IPFS gateway... CID: ${cid}`);
    try {
      // Normalize gateway URL
      let gatewayUrl = config.pinataGateway;
      if (!gatewayUrl.startsWith('http://') && !gatewayUrl.startsWith('https://')) {
        gatewayUrl = 'https://' + gatewayUrl;
      }
      if (gatewayUrl.endsWith('/')) {
        gatewayUrl = gatewayUrl.slice(0, -1);
      }

      const url = `${gatewayUrl}/ipfs/${cid}`;
      const response = await this.fetchWithRetry(url, { method: 'GET' }, 'downloadFromIPFS');

      if (!response.ok) {
        throw new Error(`IPFS gateway download failed: ${response.status} - ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const payload = Buffer.from(arrayBuffer);

      if (payload.length < 16) {
        throw new Error('Downloaded payload is corrupted or too short (missing IV header).');
      }

      // Extract IV (first 16 bytes) and ciphertext (rest)
      const iv = payload.subarray(0, 16);
      const encryptedBytes = payload.subarray(16);

      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(encryptedBytes), decipher.final()]);

      logger.info(`[STORAGE] Real IPFS download and decryption completed successfully for CID: ${cid}`);
      return decrypted;
    } catch (err: any) {
      logger.error(`[STORAGE] Real IPFS download/decryption failed for CID: ${cid}`, { error: err.message });
      throw new StorageError(`Failed to retrieve and decrypt document from IPFS: ${err.message}`, err);
    }
  }
}
