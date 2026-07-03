import crypto from 'crypto';
import { config as baseConfig } from '../../config/env';

export interface SecretCredential {
  value: string;
  version: string;
  expiresAt?: Date;
  rotatedAt?: Date;
}

export class ConfigurationProvider {
  private static credentialsCache = new Map<string, SecretCredential[]>();
  private static encryptionKey = crypto.scryptSync(baseConfig.jwtSecret, 'salt-eif-v2', 32);
  private static ivLength = 16;

  /**
   * Initializes the Configuration Provider.
   * Caches base credentials from env in a structured format.
   */
  static {
    this.registerSecret('PINATA_JWT', baseConfig.pinataJwt);
    this.registerSecret('SOLANA_RELAYER_PRIVATE_KEY', baseConfig.solanaRelayerPrivateKey);
    this.registerSecret('RAZORPAY_KEY_SECRET', baseConfig.razorpayKeySecret);
    this.registerSecret('JWT_SECRET', baseConfig.jwtSecret);
  }

  /**
   * Registers a secret credential with optional versioning and expiration.
   */
  public static registerSecret(key: string, secretValue: string, version = '1.0.0', expiresAt?: Date): void {
    const existing = this.credentialsCache.get(key) || [];
    
    // Encrypt the value before storing it in memory for high security
    const encrypted = this.encrypt(secretValue);
    
    const credential: SecretCredential = {
      value: encrypted,
      version,
      expiresAt,
      rotatedAt: new Date(),
    };

    // Remove duplicates of same version
    const filtered = existing.filter(c => c.version !== version);
    filtered.unshift(credential); // newest first
    
    this.credentialsCache.set(key, filtered);
  }

  /**
   * Retrieves a configuration or secret value by key and version.
   * Throws if credential is expired.
   */
  public static get(key: string, version?: string): string {
    // First check our secure credentials cache
    const credentials = this.credentialsCache.get(key);
    if (credentials && credentials.length > 0) {
      const selected = version 
        ? credentials.find(c => c.version === version)
        : credentials[0]; // get latest

      if (!selected) {
        throw new Error(`[ConfigProvider] Credential version "${version}" not found for key "${key}"`);
      }

      // Check credential expiration
      if (selected.expiresAt && selected.expiresAt.getTime() < Date.now()) {
        throw new Error(`[ConfigProvider] Fatal: Credential for key "${key}" (version: ${selected.version}) has expired on ${selected.expiresAt.toISOString()}`);
      }

      return this.decrypt(selected.value);
    }

    // Fallback: check base static config
    const typedConfig = baseConfig as any;
    if (typedConfig[key] !== undefined) {
      return String(typedConfig[key]);
    }

    // Otherwise look up in process.env to bridge legacy gaps, but log a warning
    const rawVal = process.env[key];
    if (rawVal) {
      return rawVal;
    }

    throw new Error(`[ConfigProvider] Configuration key "${key}" is not registered or found.`);
  }

  /**
   * Triggers a key rotation for a secret key.
   */
  public static rotateKey(key: string, newSecretValue: string, nextVersion: string, lifespanDays = 90): void {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + lifespanDays);

    this.registerSecret(key, newSecretValue, nextVersion, expiry);
    console.log(`[ConfigProvider] Rotated secret key "${key}". New version: ${nextVersion}, Expires: ${expiry.toISOString()}`);
  }

  /**
   * Helper: Encrypts a string.
   */
  private static encrypt(text: string): string {
    if (!text) return '';
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Helper: Decrypts an encrypted string.
   */
  private static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
