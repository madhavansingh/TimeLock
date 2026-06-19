import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_hackathon';

export class QrService {
  /**
   * Generates a signed, time-bound verification token for a document ID.
   */
  public static generateVerificationToken(documentId: string): string {
    // Generates an expiring token (e.g. valid for 30 days) to prevent dictionary attacks on hashes
    return jwt.sign({ documentId, purpose: 'verify' }, JWT_SECRET, { expiresIn: '30d' });
  }

  /**
   * Generates the verification URL for a given document.
   */
  public static generateVerificationUrl(documentId: string): string {
    const token = this.generateVerificationToken(documentId);
    const origin = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000';
    return `${origin}/verify?id=${documentId}&token=${token}`;
  }

  /**
   * Generates a QR Code as a Base64 PNG Data URL for a document ID.
   */
  public static async generateQrCodeDataUrl(documentId: string): Promise<string> {
    const url = this.generateVerificationUrl(documentId);
    try {
      // Generate QR Code with Error Correction Level Q (allows up to 25% damage)
      return await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'Q',
        margin: 2,
        width: 300,
        color: {
          dark: '#1E3A8A', // LTN Royal Blue branding
          light: '#FFFFFF'
        }
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      throw new Error('QR Code generation failed');
    }
  }

  /**
   * Helper to verify a verification URL token and extract the Document ID.
   */
  public static verifyToken(token: string): string | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { documentId: string; purpose: string };
      if (decoded.purpose !== 'verify') return null;
      return decoded.documentId;
    } catch {
      return null;
    }
  }
}
