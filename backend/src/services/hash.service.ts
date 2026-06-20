import crypto from 'crypto';
import nacl from 'tweetnacl';

export class HashService {
  private static readonly MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY || 'ltn_master_enc_key_2026_kleos_super_secure';

  /**
   * Generates SHA-256 checksum fingerprint for file buffer or string data.
   */
  public static generateSHA256(data: Buffer | string): string {
    const content = typeof data === 'string' ? Buffer.from(data) : data;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Compares two hex hashes in a constant-time manner to prevent timing attacks.
   */
  public static compareHashes(hashA: string, hashB: string): boolean {
    if (hashA.length !== hashB.length) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hashA, 'hex'),
        Buffer.from(hashB, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Derives a stable Ed25519 keypair for a notary deterministically.
   */
  public static getNotaryKeypair(notaryId: string) {
    const seed = crypto.createHash('sha256').update(notaryId + this.MASTER_KEY).digest();
    return nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  }

  /**
   * Generates a real Ed25519 signature for a document hash on behalf of a notary.
   */
  public static signWithNotary(hashHex: string, notaryId: string): string {
    const keypair = this.getNotaryKeypair(notaryId);
    const message = Buffer.from(hashHex, 'hex');
    const signature = nacl.sign.detached(new Uint8Array(message), keypair.secretKey);
    return Buffer.from(signature).toString('base64');
  }

  /**
   * Cryptographically verifies an Ed25519 signature against a message hash.
   */
  public static verifySignature(
    hashHex: string,
    signatureBase64: string,
    publicKeyBase64: string
  ): boolean {
    try {
      const message = Buffer.from(hashHex, 'hex');
      const signatureBytes = Buffer.from(signatureBase64, 'base64');
      const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');

      return nacl.sign.detached.verify(
        new Uint8Array(message),
        new Uint8Array(signatureBytes),
        new Uint8Array(publicKeyBytes)
      );
    } catch (err) {
      console.error('Cryptographic Ed25519 signature verification failed:', err);
      return false;
    }
  }
}
