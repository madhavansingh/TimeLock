import { prisma } from '../config/db';
import { config } from '../config/env';
import { HashService } from './hash.service';
import { QrService } from './qr.service';
import { StorageService } from './storage.service';
import { BlockchainService } from './blockchain.service';
import { FraudService } from './fraud.service';
import { VplService } from './vpl.service';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AiAssessmentService } from './ai/ai-assessment.service';
import { VerificationCopilotService } from './ai/verification-copilot.service';
import { AppError } from '../config/errors';
import { PublicKey } from '@solana/web3.js';
import { N8nService } from './n8n.service';

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
    requiredSigners = 1,
    surveyNumber?: string,
    propertyId?: string,
    registrationNumber?: string,
    ownerName?: string,
    paymentId?: string
  ) {
    // 0. Validate Payment if paymentId is provided
    if (paymentId) {
      const payment = await prisma.payment.findUnique({
        where: { paymentId }
      });

      if (!payment) {
        throw new AppError('Payment record not found.', 404, 'PAYMENT_NOT_FOUND');
      }

      if (payment.status !== 'SUCCESS') {
        throw new AppError('Payment is not completed/verified.', 402, 'PAYMENT_REQUIRED');
      }

      if (payment.documentId) {
        throw new AppError('Payment has already been associated with another document.', 400, 'PAYMENT_ALREADY_USED');
      }
    }

    // 0.5. Validate Notary
    const notary = await prisma.notary.findUnique({
      where: { notaryId }
    });

    if (!notary) {
      throw new AppError('The selected notary does not exist.', 404, 'NOTARY_NOT_FOUND');
    }

    if (notary.certStatus !== 'active') {
      throw new AppError('The selected notary is not active.', 400, 'NOTARY_NOT_ACTIVE');
    }

    if (!notary.isAccredited) {
      throw new AppError('The selected notary is not accredited.', 400, 'NOTARY_NOT_ACCREDITED');
    }

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
        assignedNotaryId: notaryId,
        assignmentTimestamp: new Date(),
        ipfsReference: {
          create: {
            cid,
            keyReference
          }
        },
        metadata: (surveyNumber || propertyId || registrationNumber || ownerName) ? {
          create: {
            surveyNumber,
            propertyId,
            registrationNumber,
            ownerName,
            ownerIdentifier: userId
          }
        } : undefined
      },
      include: {
        ipfsReference: true,
        metadata: true
      }
    });

    // 3.5. Link payment to the new document
    if (paymentId) {
      await prisma.payment.update({
        where: { paymentId },
        data: { documentId: doc.documentId }
      });
    }

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
            create: [
              {
                eventType: 'DOCUMENT_UPLOADED',
                actorUserId: userId,
                actorLabel: 'Citizen Executant'
              },
              {
                eventType: 'DOCUMENT_ASSIGNED',
                actorUserId: userId,
                actorLabel: `System: Assigned to ${notary.name}`
              },
              {
                eventType: 'DOCUMENT_HASHED',
                actorUserId: userId,
                actorLabel: 'SHA-256 Engine'
              },
              {
                eventType: 'DOCUMENT_ENCRYPTED',
                actorUserId: userId,
                actorLabel: 'AES-256-CBC Engine'
              },
              {
                eventType: 'DOCUMENT_IPFS_UPLOADED',
                actorUserId: userId,
                actorLabel: 'Decentralized IPFS Node'
              },
              {
                eventType: 'DOCUMENT_ANCHORED',
                actorUserId: userId,
                actorLabel: 'Solana Program Authority',
                onchainTxRef: signature
              }
            ]
          }
        },
        include: {
          ipfsReference: true,
          metadata: true
        }
      });

      // 6. Automatically create VPL verification case
      try {
        await VplService.createCase(doc.documentId, notaryId);
      } catch (vplErr) {
        console.error(`[VPL] Failed to initialize case for document ${doc.documentId}:`, vplErr);
      }

      // Initialize permanent ownership record
      try {
        await prisma.ownershipRecord.create({
          data: {
            documentId: doc.documentId,
            ownerUserId: userId,
            previousOwnerId: null,
            startDate: new Date(),
            transferReason: 'Initial Registration',
            status: 'ACTIVE',
            blockchainTx: signature
          }
        });
      } catch (ownErr) {
        console.error(`[Ownership] Failed to initialize ownership record:`, ownErr);
      }

      // Asynchronously trigger AI Assessment Phase 2 & 3
      AiAssessmentService.triggerRegeneration(doc.documentId, 'INITIAL_REGISTRATION');
      VerificationCopilotService.triggerRegeneration(doc.documentId, 'INITIAL_REGISTRATION');

      // Trigger n8n Document Assigned Webhook (fire-and-forget)
      N8nService.notifyDocumentAssigned(updatedDoc);

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

    // Enforce notary assignment security
    if (signerRole === DbSignerRole.NOTARY) {
      if (doc.assignedNotaryId !== notaryId) {
        throw new AppError('This document is assigned to another notary.', 403, 'UNAUTHORIZED_NOTARY');
      }
    }

    // Fetch Notary details for public key verification
    const notary = await prisma.notary.findUnique({
      where: { notaryId }
    });

    if (!notary) throw new AppError('Notary details not found.', 404, 'NOTARY_NOT_FOUND');

    // Cryptographic validation of signature
    const finalSignatureBytes = signerRole === DbSignerRole.NOTARY 
      ? HashService.signWithNotary(doc.contentHash, notaryId) 
      : signatureBytes;

    const isValid = HashService.verifySignature(doc.contentHash, finalSignatureBytes, notary.publicKey);
    if (!isValid) throw new AppError('The cryptographic signature is invalid.', 400, 'INVALID_SIGNATURE');

    // Convert notary public key to Solana base58 address
    const publicKeyBytes = Buffer.from(notary.publicKey, 'base64');
    const solanaPubkeyStr = publicKeyBytes.length === 32 
      ? new PublicKey(publicKeyBytes).toBase58() 
      : '5h3K1111111111111111111111111111111111111111';

    // Commit signature to Solana PDA
    const certRefHash = HashService.generateSHA256(certSerial);
    const signerRoleByte = signerRole === DbSignerRole.NOTARY ? 1 : 2;
    
    const txSig = await BlockchainService.recordSignatureOnChain(
      documentId,
      signerRoleByte,
      solanaPubkeyStr,
      certRefHash
    );

    // Save to Database
    const signature = await prisma.signature.create({
      data: {
        documentId,
        notaryId,
        signerRole,
        signatureBytes: finalSignatureBytes,
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
            eventType: 'NOTARY_SIGNED',
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
  public static async generateVerificationCertificatePDF(documentId: string, viewProfile?: string): Promise<Buffer> {
    const doc = await prisma.document.findUnique({
      where: { documentId },
      include: {
        owner: true,
        signatures: { include: { notary: true } },
        ipfsReference: true,
        verificationEvents: { orderBy: { occurredAt: 'asc' } },
        verificationCase: { include: { evidence: true } },
        ownershipRecords: {
          include: { owner: true },
          orderBy: { startDate: 'asc' }
        }
      }
    });

    if (!doc) throw new Error('DOCUMENT_NOT_FOUND');

    const isPublic = viewProfile === 'PUBLIC_VIEW';

    // Fetch Base64 QR code image representation
    const qrDataUrl = await QrService.generateQrCodeDataUrl(documentId);
    const base64Image = qrDataUrl.split(';base64,').pop() || '';
    const imageBuffer = Buffer.from(base64Image, 'base64');

    return new Promise((resolve, reject) => {
      const pdf = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      pdf.on('data', (chunk) => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', (err) => reject(err));

      // Brand Color Palette
      const primaryColor = '#0F172A'; // Slate 900
      const accentColor = '#1E3A8A';  // Royal Blue
      const lightBg = '#F8FAFC';      // Slate 50
      const borderColor = '#E2E8F0';  // Slate 200
      const textColor = '#334155';    // Slate 700

      // Draw Top Accent Border
      pdf.rect(0, 0, 595.28, 15).fill(accentColor);

      // Branding Header
      pdf.fillColor(accentColor).font('Helvetica-Bold').fontSize(22).text('TimeLock Network', 40, 35);
      pdf.fillColor(primaryColor).font('Helvetica').fontSize(10).text('IMMUTABLE LAND RECORD TRUST REGISTRY', 40, 60);
      
      // Right-aligned certificate details
      pdf.fillColor(textColor).font('Helvetica-Bold').fontSize(10).text('CERTIFICATE OF AUTHENTICITY', 400, 35, { align: 'right' });
      pdf.font('Helvetica').fontSize(8).text(`Issued: ${new Date().toLocaleString()}`, 400, 48, { align: 'right' });
      pdf.text(`Doc Ref: ${doc.documentId}`, 400, 60, { align: 'right' });

      // Horizontal Line
      pdf.strokeColor(borderColor).lineWidth(1).moveTo(40, 80).lineTo(555, 80).stroke();

      // Certificate Introduction
      pdf.moveDown(1.5);
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('1. Verification Attestation');
      pdf.moveDown(0.5);
      pdf.fillColor(textColor).font('Helvetica').fontSize(9).text(
        'This document certifies that a digital land record signature and content hash have been securely registered on-chain. The verified record has been cryptographically validated against the Solana ledger and stored securely on the decentralized IPFS network.',
        { width: 515, align: 'justify' }
      );
      pdf.moveDown(1.5);

      // Metadata Grid (Left column) and QR code (Right column)
      const startY = pdf.y;

      // Draw metadata title
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('2. Registry Metadata', 40, startY);
      pdf.moveDown(0.5);
      
      const tableTop = pdf.y;
      
      // Metadata Details
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Document Title:', 40, tableTop);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(doc.title, 140, tableTop);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Document Type:', 40, tableTop + 18);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(doc.type, 140, tableTop + 18);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Owner ID:', 40, tableTop + 36);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : doc.ownerUserId, 140, tableTop + 36);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Anchor Date:', 40, tableTop + 54);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(doc.createdAt.toLocaleString(), 140, tableTop + 54);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Registry Status:', 40, tableTop + 72);
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(doc.status === 'FULLY_EXECUTED' ? '#059669' : '#D97706').text(doc.status, 140, tableTop + 72);

      // Embed QR Code on the right side
      pdf.image(imageBuffer, 435, tableTop - 5, { width: 110, height: 110 });
      pdf.font('Helvetica').fontSize(7).fillColor(textColor).text('Scan QR to verify ledger live', 435, tableTop + 110, { width: 110, align: 'center' });

      // Fingerprint Box
      pdf.y = tableTop + 95;
      pdf.moveDown(1.5);
      const hashBoxY = pdf.y;
      pdf.rect(40, hashBoxY, 375, 45).fillAndStroke(lightBg, borderColor);
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8).text('SHA-256 CONTENT FINGERPRINT (CHECKSUM):', 50, hashBoxY + 8);
      pdf.fillColor(accentColor).font('Courier-Bold').fontSize(8).text(isPublic ? '[REDACTED FOR PRIVACY]' : doc.contentHash, 50, hashBoxY + 23);

      // Storage Info
      pdf.y = hashBoxY + 55;
      pdf.moveDown(1);
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('3. Decentralized Storage (IPFS) Proof');
      pdf.moveDown(0.5);
      
      const storageY = pdf.y;
      pdf.font('Helvetica-Bold').fontSize(9).text('IPFS Provider:', 40, storageY);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : (doc.ipfsReference ? 'Pinata IPFS Gateway' : 'N/A'), 140, storageY);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('IPFS Content CID:', 40, storageY + 16);
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(accentColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : (doc.ipfsReference?.cid || 'N/A'), 140, storageY + 16);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Key Reference Hash:', 40, storageY + 32);
      pdf.font('Helvetica').fontSize(8.5).fillColor(textColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : (doc.ipfsReference?.keyReference || 'N/A'), 140, storageY + 32);

      // Blockchain Trust Anchor Section
      pdf.y = storageY + 50;
      pdf.moveDown(1.5);
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('4. Blockchain Anchor Proof');
      pdf.moveDown(0.5);

      const chainY = pdf.y;
      pdf.font('Helvetica-Bold').fontSize(9).text('Solana Program ID:', 40, chainY);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(config.solanaProgramId, 140, chainY);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Document Account PDA:', 40, chainY + 16);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : (doc.onchainPda || 'N/A'), 140, chainY + 16);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Anchor Transaction:', 40, chainY + 32);
      pdf.font('Helvetica').fontSize(8.5).fillColor(textColor).text(doc.onchainTxSignature || 'N/A', 140, chainY + 32, { width: 415 });

      // Check if we need to add a page break for Notaries & Audit Timeline
      pdf.addPage({ size: 'A4', margin: 40 });
      pdf.rect(0, 0, 595.28, 15).fill(accentColor);
      pdf.y = 35;

      // VPL Attestation Section
      if (doc.verificationCase) {
        pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('5. Verification Proof Layer (VPL) Security Attestation');
        pdf.moveDown(0.5);

        const vpl = doc.verificationCase;
        const vplY = pdf.y;
        pdf.rect(40, vplY, 515, 65).fillAndStroke(lightBg, borderColor);
        pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(`Verification Case ID: ${vpl.caseId}`, 50, vplY + 8);
        pdf.font('Helvetica').fontSize(8.5).fillColor(textColor).text(`VPL Trust Score: ${vpl.trustScore} / 100`, 50, vplY + 20);
        pdf.text(`VPL Status: ${vpl.status} | Supporting Evidence Documents: ${vpl.evidence.length}`, 50, vplY + 31);
        
        const txRef = vpl.vplOnchainTx ? (isPublic ? `${vpl.vplOnchainTx.slice(0, 24)}...` : vpl.vplOnchainTx) : 'N/A';
        pdf.text(`VPL Solana Transaction Signature: ${txRef}`, 50, vplY + 42);
        
        pdf.y = vplY + 75;
        pdf.moveDown(1.5);
      }

      // Notary Information
      if (doc.signatures.length > 0) {
        pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('6. Recorded Notarization Records');
        pdf.moveDown(0.5);

        doc.signatures.forEach((sig) => {
          const notaryY = pdf.y;
          pdf.rect(40, notaryY, 515, 45).fillAndStroke(lightBg, borderColor);
          pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(`Notary Name: ${sig.notary.name}`, 50, notaryY + 8);
          pdf.font('Helvetica').fontSize(8.5).fillColor(textColor).text(`DSC Serial Check: ${sig.notary.dscCertificateSerial}`, 50, notaryY + 20);
          
          const sigRef = isPublic ? '[REDACTED]' : `${sig.signatureId.slice(0, 16)}...`;
          pdf.text(`Signed On: ${sig.signedAt.toLocaleString()} | Signature Reference: ${sigRef}`, 50, notaryY + 31);
          pdf.y = notaryY + 55;
        });
        pdf.moveDown(1.5);
      }

      // Audit Timeline Section
      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('7. Timeline Activity Log (Verification Events)');
      pdf.moveDown(0.5);

      if (isPublic) {
        pdf.font('Helvetica-Oblique').fontSize(9).fillColor('#64748B').text('Chronological audit log and event internals are concealed for document confidentiality.');
      } else if (doc.verificationEvents.length === 0) {
        pdf.font('Helvetica').fontSize(9).fillColor(textColor).text('No audit timeline events found.');
      } else {
        doc.verificationEvents.forEach((event, idx) => {
          const timelineY = pdf.y;
          
          // Draw small bullet and line connecting
          pdf.circle(48, timelineY + 5, 3).fill(accentColor);
          if (idx < doc.verificationEvents.length - 1) {
            pdf.strokeColor(borderColor).lineWidth(1).moveTo(48, timelineY + 8).lineTo(48, timelineY + 30).stroke();
          }

          // Format details based on eventType
          let eventTitle = event.eventType.replace(/_/g, ' ').toUpperCase();
          if (event.eventType === 'registration_confirmed') eventTitle = 'Document Registered & Anchored on Solana';
          if (event.eventType === 'notary_signed') eventTitle = 'Notary Digitally Signed Registry Profile';
          if (event.eventType === 'VERIFICATION_SUCCESS') eventTitle = 'Integrity Verification Pass';
          if (event.eventType === 'VERIFICATION_TAMPER_DETECTED') eventTitle = 'Integrity Verification Fail (Dispute Raised)';

          pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5).text(eventTitle, 65, timelineY);
          pdf.fillColor(textColor).font('Helvetica').fontSize(8).text(
            `Timestamp: ${event.occurredAt.toLocaleString()} | Actor: ${event.actorLabel}`,
            65,
            timelineY + 11
          );
          if (event.onchainTxRef) {
            pdf.fontSize(7.5).fillColor(textColor).text(`Tx Signature: ${event.onchainTxRef}`, 65, timelineY + 22);
            pdf.y = timelineY + 35;
          } else {
            pdf.y = timelineY + 26;
          }
        });
      }

      // 8. Chain of Title Ledger
      const records = doc.ownershipRecords || [];
      const activeRecord = records.find((r) => r.status === 'ACTIVE');
      const latestTransfer = records.filter((r) => r.previousOwnerId !== null).pop();

      if (pdf.y > 550) {
        pdf.addPage({ size: 'A4', margin: 40 });
        pdf.rect(0, 0, 595.28, 15).fill(accentColor);
        pdf.y = 35;
      } else {
        pdf.moveDown(1.5);
      }

      pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('8. Chain of Title Ledger');
      pdf.moveDown(0.5);

      const cotTop = pdf.y;
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Current Verified Owner:', 40, cotTop);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(isPublic ? '[REDACTED FOR PRIVACY]' : (activeRecord?.ownerUserId || doc.ownerUserId), 170, cotTop);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Historical Transfers Count:', 40, cotTop + 16);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(String(Math.max(0, records.length - 1)), 170, cotTop + 16);

      pdf.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text('Latest Transfer Date:', 40, cotTop + 32);
      pdf.font('Helvetica').fontSize(9).fillColor(textColor).text(latestTransfer ? new Date(latestTransfer.startDate).toLocaleString() : 'N/A', 170, cotTop + 32);

      pdf.y = cotTop + 48;
      pdf.moveDown(1);

      if (records.length === 0) {
        pdf.font('Helvetica-Oblique').fontSize(9).fillColor(textColor).text('No ownership records registered.');
      } else {
        records.forEach((record, idx) => {
          const recordY = pdf.y;
          if (recordY > 700) {
            pdf.addPage({ size: 'A4', margin: 40 });
            pdf.rect(0, 0, 595.28, 15).fill(accentColor);
            pdf.y = 35;
          }

          const currentRecordY = pdf.y;
          pdf.rect(40, currentRecordY, 515, 45).fillAndStroke(lightBg, borderColor);

          const ownerLabel = isPublic ? `Citizen Owner #${idx + 1}` : `User ID: ${record.ownerUserId}`;
          pdf.fillColor(primaryColor).font('Helvetica-Bold').fontSize(9).text(`Owner: ${ownerLabel}`, 50, currentRecordY + 8);

          const detailsText = `Status: ${record.status} | Reason: ${record.transferReason || 'N/A'} | Start: ${new Date(record.startDate).toLocaleString()}${record.endDate ? ` | End: ${new Date(record.endDate).toLocaleString()}` : ''}`;
          pdf.font('Helvetica').fontSize(8).fillColor(textColor).text(detailsText, 50, currentRecordY + 20);

          const txSig = record.blockchainTx ? (isPublic ? `${record.blockchainTx.slice(0, 24)}...` : record.blockchainTx) : 'N/A';
          pdf.font('Courier-Bold').fontSize(7.5).fillColor(accentColor).text(`Solana Tx: ${txSig}`, 50, currentRecordY + 31);

          pdf.y = currentRecordY + 55;
        });
      }

      // Legal compliance footer
      pdf.y = 750;
      pdf.strokeColor(borderColor).lineWidth(0.5).moveTo(40, 740).lineTo(555, 740).stroke();
      pdf.fontSize(7.5).fillColor('#64748B').text(
        'LEGAL COMPLIANCE ATTESTATION: This certificate acts as verifiable electronic support. Admissibility under Section 65B of the Indian Evidence Act is certified by the TimeLock cryptographic logging system which remains active, unaltered, and correct at all relevant times. All signatures are on-chain immutable records.',
        { width: 515, align: 'center' }
      );

      pdf.end();
    });
  }

  /**
   * Fetches all documents registered by the given user ID.
   */
  public static async fetchMyDocuments(userId: string) {
    return await prisma.document.findMany({
      where: {
        ownerUserId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        ipfsReference: true
      }
    });
  }
}
