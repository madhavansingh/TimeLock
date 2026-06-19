import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../config/logger';

export class StorageService {
  /**
   * Uploads an encrypted copy of the document to decentralized storage.
   * Uses real Pinata IPFS API or falls back to simulation mode if mock JWT is active.
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
    const keyReference = key.toString('hex'); // The key reference holds the key itself (hex encoded)

    if (isMock) {
      // Compute mock IPFS CID based on SHA256 of payload bytes
      const hash = crypto.createHash('sha256').update(payload).digest('hex');
      const cid = 'Qm' + hash.slice(0, 44);
      logger.info(`[STORAGE MOCK] Simulated IPFS upload. File: ${filename}, Encrypted Size: ${payload.length} bytes, CID: ${cid}`);
      return { cid, keyReference, isMock: true };
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

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.pinataJwt}`,
        },
        body: formData,
      });

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
    } catch (err) {
      logger.error('[STORAGE] Real Pinata upload failed, throwing error', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Downloads and decrypts document contents from IPFS storage.
   */
  public static async downloadDocument(cid: string, keyReference: string): Promise<Buffer> {
    const isMock = !config.pinataJwt || 
                   config.pinataJwt === 'mock_pinata_jwt_token_for_hackathon' ||
                   config.pinataJwt.startsWith('mock');

    const key = Buffer.from(keyReference, 'hex');

    if (isMock) {
      logger.info(`[STORAGE MOCK] Downloading simulated file from IPFS CID: ${cid}`);
      return Buffer.from('mocked_decrypted_document_binary_data');
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
      const response = await fetch(url);

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
    } catch (err) {
      logger.error(`[STORAGE] Real IPFS download/decryption failed for CID: ${cid}`, { error: (err as Error).message });
      throw err;
    }
  }
}
