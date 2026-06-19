import { prisma } from '../config/db';
import { HashService } from './hash.service';
import { QrService } from './qr.service';
import { StorageService } from './storage.service';
import { BlockchainService } from './blockchain.service';
import { FraudService } from './fraud.service';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AppError } from '../config/errors';

export class DocumentService {
  /**
   * Orchestrates file hashing, IPFS upload, DB record initialization,
   * Solana anchor PDA deployment, and QR code generation.
   */
  public static async uploadAndRegister(
    userId: string,
    title: string,
    type: string,
    fileBuffer: Buffer,
    filename: string,
    notaryId: string,
    requiredSigners = 1
  ) {
    // 1. Generate SHA-256 Checksum
    const contentHash = HashService.generateSHA256(fileBuffer);

    // 2. Upload Encrypted Binary to Pinata IPFS
    const { cid, keyReference } = await StorageService.uploadDocument(fileBuffer, filename);

    // 3. Create db entry (PENDING status)
    const doc = await prisma.document.create({
      data: {
        title,
        type,
        contentHash,
        status: DbDocumentStatus.PENDING,
        ownerUserId: userId,
        requiredSigners,
        ipfsReference: {
          create: {
            cid,
            keyReference
          }
        }
      },
      include: {
        ipfsReference: true
      }
    });

    // 4. Commit to Solana Cluster using Relayer HSM
    try {
      const { signature, pdaAddress } = await BlockchainService.registerDocumentOnChain(
        doc.documentId,
        contentHash,
        requiredSigners
      );

      // 5. Update status & timeline
      const updatedDoc = await prisma.document.update({
        where: { documentId: doc.documentId },
        data: {
          status: DbDocumentStatus.ONCHAIN_CONFIRMED,
          onchainTxSignature: signature,
          onchainPda: pdaAddress,
          verificationEvents: {
            create: {
              eventType: 'registration_confirmed',
              actorUserId: userId,
              actorLabel: 'Citizen Executant',
              onchainTxRef: signature
            }
          }
        },
        include: {
          ipfsReference: true
        }
      });

      return updatedDoc;
    } catch (err) {
      console.error('Failed to commit on-chain, document remains in PENDING status:', err);
      return doc;
    }
  }

  /**
   * Compares re-uploaded scan fingerprint against blockchain records
   * and runs rule-based fraud scoring.
   */
  public static async verifyScan(documentId: string, fileBuffer: Buffer, actorLabel: string, actorUserId?: string) {
    const doc = await prisma.document.findUnique({
      where: { documentId },
      include: { signatures: true }
    });

    if (!doc) throw new Error('DOCUMENT_NOT_FOUND');

    const submittedHash = HashService.generateSHA256(fileBuffer);
    const hashesMatch = HashService.compareHashes(doc.contentHash, submittedHash);

    // Dynamic Fraud Risk scoring
    const hasNotarySig = doc.signatures.some((s) => s.signerRole === DbSignerRole.NOTARY);
    const hasBlockchainTx = !!doc.onchainTxSignature;

    const { score, signals } = FraudService.calculateRiskScore({
      hashMismatch: !hashesMatch,
      missingBlockchainTx: !hasBlockchainTx,
      missingNotarySignature: !hasNotarySig,
      expiredVerification: false // Configurable
    });

    // Record verification event in ledger
    await prisma.verificationEvent.create({
      data: {
        documentId,
        eventType: hashesMatch ? 'VERIFICATION_SUCCESS' : 'VERIFICATION_TAMPER_DETECTED',
        actorUserId,
        actorLabel,
        onchainTxRef: doc.onchainTxSignature
      }
    });

    // Update document status to disputed if tampered
    if (!hashesMatch) {
      await prisma.document.update({
        where: { documentId },
        data: { status: DbDocumentStatus.DISPUTED }
      });
    }

    return {
      documentId,
      result: hashesMatch ? 'authentic' : 'modified',
      expectedHash: doc.contentHash,
      submittedHash,
      riskScore: score,
      signals,
      detectedAt: new Date()
    };
  }

  /**
   * Validates digital signature and commits it to Solana and Postgres ledger.
   */
  public static async recordSignature(
    documentId: string,
    signerRole: DbSignerRole,
    signatureBytes: string,
    certSerial: string,
    notaryId: string
  ) {
    const doc = await prisma.document.findUnique({
      where: { documentId }
    });

    if (!doc) throw new AppError('Document registry not found.', 404, 'DOCUMENT_NOT_FOUND');

    // Fetch Notary details for public key verification
    const notary = await prisma.notary.findUnique({
      where: { notaryId }
    });

    if (!notary) throw new AppError('Notary details not found.', 404, 'NOTARY_NOT_FOUND');

    // Cryptographic validation of signature
    const isValid = HashService.verifySignature(doc.contentHash, signatureBytes, notary.publicKey);
    if (!isValid) throw new AppError('The cryptographic signature is invalid.', 400, 'INVALID_SIGNATURE');

    // Commit signature to Solana PDA
    const certRefHash = HashService.generateSHA256(certSerial);
    const signerRoleByte = signerRole === DbSignerRole.NOTARY ? 1 : 2;
    
    const txSig = await BlockchainService.recordSignatureOnChain(
      documentId,
      signerRoleByte,
      '5h3K1111111111111111111111111111111111111111', // Simulated notary pubkey
      certRefHash
    );

    // Save to Database
    const signature = await prisma.signature.create({
      data: {
        documentId,
        notaryId,
        signerRole,
        signatureBytes,
        signedAt: new Date()
      }
    });

    // Increment signer count and update status
    const newSignerCount = doc.signerCount + 1;
    let newStatus: DbDocumentStatus = DbDocumentStatus.NOTARY_SIGNED;
    if (newSignerCount >= doc.requiredSigners) {
      newStatus = DbDocumentStatus.FULLY_EXECUTED;
    }

    await prisma.document.update({
      where: { documentId },
      data: {
        status: newStatus,
        signerCount: newSignerCount,
        verificationEvents: {
          create: {
            eventType: 'notary_signed',
            actorLabel: `Notary: ${notary.name}`,
            onchainTxRef: txSig
          }
        }
      }
    });

    return signature;
  }

  /**
   * Generates downloadable verification certificate using PDFKit
   */
  public static async generateVerificationCertificatePDF(documentId: string): Promise<Buffer> {
    const doc = await prisma.document.findUnique({
      where: { documentId },
      include: { owner: true, signatures: { include: { notary: true } } }
    });

    if (!doc) throw new Error('DOCUMENT_NOT_FOUND');

    // Fetch Base64 QR code image representation
    const qrDataUrl = await QrService.generateQrCodeDataUrl(documentId);
    const base64Image = qrDataUrl.split(';base64,').pop() || '';
    const imageBuffer = Buffer.from(base64Image, 'base64');

    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      pdf.on('data', (chunk) => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', (err) => reject(err));

      // PDF Styling & Content Layout
      pdf.fillColor('#1E3A8A').fontSize(24).text('Legal TimeLock Network (LTN)', { align: 'center' });
      pdf.fillColor('#111827').fontSize(14).text('Document Verification Certificate', { align: 'center' });
      pdf.moveDown(2);

      pdf.fontSize(10).fillColor('#4B5563').text('This certificate serves as independent, cryptographically secure proof of document integrity anchored on the Solana Blockchain.');
      pdf.moveDown(1.5);

      // Metadata Table Layout
      pdf.fillColor('#111827').fontSize(11).text('Document Metadata:', { underline: true });
      pdf.moveDown(0.5);
      pdf.fontSize(10).fillColor('#111827');
      pdf.text(`Document ID: ${doc.documentId}`);
      pdf.text(`Title: ${doc.title}`);
      pdf.text(`Type: ${doc.type}`);
      pdf.text(`Created Timestamp: ${doc.createdAt.toISOString()}`);
      pdf.text(`Current Registry Status: ${doc.status}`);
      pdf.text(`SHA-256 Fingerprint: ${doc.contentHash}`);
      pdf.moveDown(1.5);

      pdf.fillColor('#111827').fontSize(11).text('Solana Trust Anchor Record:', { underline: true });
      pdf.moveDown(0.5);
      pdf.fontSize(10);
      pdf.text(`Solana Tx Signature: ${doc.onchainTxSignature || 'N/A'}`);
      pdf.text(`Solana PDA Account: ${doc.onchainPda || 'N/A'}`);
      pdf.moveDown(1.5);

      if (doc.signatures.length > 0) {
        pdf.fillColor('#111827').fontSize(11).text('Recorded Signatures:', { underline: true });
        pdf.moveDown(0.5);
        doc.signatures.forEach((sig) => {
          pdf.fontSize(10).text(`- Signed by: ${sig.notary.name} (Notary)`);
          pdf.text(`  Timestamp: ${sig.signedAt.toISOString()}`);
          pdf.text(`  DSC Certificate Serial: ${sig.notary.dscCertificateSerial}`);
        });
        pdf.moveDown(1.5);
      }

      // Embed QR code image
      pdf.text('Scan below to view current audit timeline:', { align: 'center' });
      pdf.image(imageBuffer, {
        fit: [150, 150],
        align: 'center',
        valign: 'center'
      });

      pdf.moveDown(2);
      pdf.fontSize(8).fillColor('#9CA3AF').text('DISCLAIMER: This certificate acts as electronic verification support. Admissibility under Section 65B of the Indian Evidence Act is subject to legal authorization. Consult counsel.', { align: 'center' });

      pdf.end();
    });
  }
}
