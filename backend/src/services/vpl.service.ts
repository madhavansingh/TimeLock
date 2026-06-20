import { prisma } from '../config/db';
import { DbDocumentStatus, DbSignerRole } from '@prisma/client';
import { BlockchainService } from './blockchain.service';
import { HashService } from './hash.service';
import { AppError, NotFoundError } from '../config/errors';
import { PublicKey } from '@solana/web3.js';
import { AiAssessmentService } from './ai/ai-assessment.service';
import { VerificationCopilotService } from './ai/verification-copilot.service';

export interface ChecklistItem {
  id: string;
  label: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
}

export interface ChallengeItem {
  id: string;
  type: 'CONFLICT' | 'MISSING_EVIDENCE';
  field: string;
  question: string;
  resolved: boolean;
  justification: string | null;
}

export class VplService {
  /**
   * Initializes a verification case for a document assigned to a notary.
   */
  public static async createCase(documentId: string, notaryId: string) {
    // Check if case already exists
    const existing = await prisma.verificationCase.findUnique({
      where: { documentId }
    });
    if (existing) return existing;

    // Default checklist items
    const defaultChecklist: ChecklistItem[] = [
      { id: 'title_deed_check', label: 'Title Deed History Check', status: 'PENDING' },
      { id: 'encumbrance_check', label: 'Encumbrance & Mortgage Search', status: 'PENDING' },
      { id: 'identity_check', label: 'Buyer & Seller Identity Check', status: 'PENDING' },
      { id: 'hash_check', label: 'Solana On-Chain Hash Integrity Check', status: 'PENDING' },
      { id: 'conflict_check', label: 'Double-Registration Conflict Scan', status: 'PENDING' }
    ];

    // Initial challenges list
    const challenges: ChallengeItem[] = [];

    // Check for mandatory evidence items
    const mandatoryEvidence = ['Identity Proof', 'Prior Title Deed', 'Tax Receipt'];
    for (const title of mandatoryEvidence) {
      challenges.push({
        id: `evidence_missing_${title.toLowerCase().replace(/\s+/g, '_')}`,
        type: 'MISSING_EVIDENCE',
        field: title,
        question: `Missing mandatory evidence document: ${title}. Please upload a scanned copy.`,
        resolved: false,
        justification: null
      });
    }

    // Run conflict detection to populate initial conflicts
    const meta = await prisma.documentMetadata.findUnique({
      where: { documentId }
    });

    if (meta) {
      // 1. Survey Number check
      if (meta.surveyNumber) {
        const matches = await prisma.documentMetadata.findMany({
          where: {
            surveyNumber: meta.surveyNumber,
            documentId: { not: documentId }
          }
        });
        if (matches.length > 0) {
          const matchIds = matches.map(m => m.documentId).join(', ');
          challenges.push({
            id: `conflict_survey_${meta.surveyNumber.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'CONFLICT',
            field: 'surveyNumber',
            question: `Survey number ${meta.surveyNumber} is already registered under Document ID(s) [${matchIds}]. Justification required.`,
            resolved: false,
            justification: null
          });
        }
      }

      // 2. Property ID check
      if (meta.propertyId) {
        const matches = await prisma.documentMetadata.findMany({
          where: {
            propertyId: meta.propertyId,
            documentId: { not: documentId }
          }
        });
        if (matches.length > 0) {
          const matchIds = matches.map(m => m.documentId).join(', ');
          challenges.push({
            id: `conflict_property_${meta.propertyId.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'CONFLICT',
            field: 'propertyId',
            question: `Property ID ${meta.propertyId} matches active registration(s) [${matchIds}]. Provide ownership clearance justification.`,
            resolved: false,
            justification: null
          });
        }
      }

      // 3. Registration Number check
      if (meta.registrationNumber) {
        const matches = await prisma.documentMetadata.findMany({
          where: {
            registrationNumber: meta.registrationNumber,
            documentId: { not: documentId }
          }
        });
        if (matches.length > 0) {
          const matchIds = matches.map(m => m.documentId).join(', ');
          challenges.push({
            id: `conflict_reg_${meta.registrationNumber.toLowerCase().replace(/\s+/g, '_')}`,
            type: 'CONFLICT',
            field: 'registrationNumber',
            question: `Duplicate registration number ${meta.registrationNumber} matches Document ID [${matchIds}]. Confirm title validity.`,
            resolved: false,
            justification: null
          });
        }
      }
    }

    const initialScore = this.computeScore(defaultChecklist, challenges);

    return await prisma.verificationCase.create({
      data: {
        documentId,
        notaryId,
        status: 'PENDING',
        checklist: defaultChecklist as any,
        challenges: challenges as any,
        trustScore: initialScore
      }
    });
  }

  /**
   * Internal helper to compute the trust score based on checklist and challenges status.
   */
  private static computeScore(checklist: ChecklistItem[], challenges: ChallengeItem[]): number {
    let score = 100;

    // 1. Checklist deductions: Deduct 4 points for each item not marked PASSED
    for (const item of checklist) {
      if (item.status !== 'PASSED') {
        score -= 4;
      }
    }

    // 2. Challenge deductions
    for (const challenge of challenges) {
      if (challenge.type === 'CONFLICT') {
        if (!challenge.resolved) {
          score -= 25; // Large penalty for unresolved title conflicts
        } else {
          score -= 8;  // Minor penalty remains even if resolved (audit warning history)
        }
      } else if (challenge.type === 'MISSING_EVIDENCE') {
        if (!challenge.resolved) {
          score -= 10; // Penalty for missing mandatory documents
        }
      }
    }

    // Bound between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Recalculates and updates the trust score for a case in the database.
   */
  public static async updateScore(caseId: string) {
    const c = await prisma.verificationCase.findUnique({
      where: { caseId }
    });
    if (!c) throw new NotFoundError('Verification case');

    const checklist = c.checklist as unknown as ChecklistItem[];
    const challenges = c.challenges as unknown as ChallengeItem[];

    const newScore = this.computeScore(checklist, challenges);

    return await prisma.verificationCase.update({
      where: { caseId },
      data: { trustScore: newScore }
    });
  }

  /**
   * Adds an evidence record, resolving the corresponding missing evidence challenge if it exists.
   */
  public static async addEvidence(documentId: string, title: string, ipfsCid: string) {
    const c = await prisma.verificationCase.findUnique({
      where: { documentId }
    });
    if (!c) throw new NotFoundError('Verification case');

    // Save evidence record
    const evidence = await prisma.evidence.create({
      data: {
        caseId: c.caseId,
        title,
        ipfsCid
      }
    });

    // Try to resolve corresponding missing evidence challenge
    const challenges = c.challenges as unknown as ChallengeItem[];
    const targetChallengeId = `evidence_missing_${title.toLowerCase().replace(/\s+/g, '_')}`;
    
    let challengesUpdated = false;
    const updatedChallenges = challenges.map(challenge => {
      if (challenge.id === targetChallengeId || (challenge.type === 'MISSING_EVIDENCE' && challenge.field.toLowerCase() === title.toLowerCase())) {
        challengesUpdated = true;
        return {
          ...challenge,
          resolved: true,
          justification: `Evidence file uploaded. IPFS CID: ${ipfsCid}`
        };
      }
      return challenge;
    });

    if (challengesUpdated) {
      const newScore = this.computeScore(c.checklist as unknown as ChecklistItem[], updatedChallenges);
      await prisma.verificationCase.update({
        where: { caseId: c.caseId },
        data: {
          challenges: updatedChallenges as any,
          trustScore: newScore,
          status: 'IN_PROGRESS'
        }
      });
    }

    // Trigger AI regeneration on evidence upload
    AiAssessmentService.triggerRegeneration(documentId, 'EVIDENCE_CHANGED');
    VerificationCopilotService.triggerRegeneration(documentId, 'EVIDENCE_CHANGED');

    return evidence;
  }

  /**
   * Adds an evidence request challenge to the verification case.
   */
  public static async addEvidenceRequest(documentId: string, title: string) {
    const c = await prisma.verificationCase.findUnique({
      where: { documentId }
    });
    if (!c) throw new NotFoundError('Verification case');

    const challenges = c.challenges as unknown as ChallengeItem[];
    const targetChallengeId = `evidence_missing_${title.toLowerCase().replace(/\s+/g, '_')}`;

    // Check if challenge already exists
    if (challenges.some(ch => ch.id === targetChallengeId)) {
      return c;
    }

    const updatedChallenges: ChallengeItem[] = [...challenges, {
      id: targetChallengeId,
      type: 'MISSING_EVIDENCE' as const,
      field: title,
      question: `Additional evidence requested: ${title}. Please upload a scanned copy.`,
      resolved: false,
      justification: null
    }];

    const checklist = c.checklist as unknown as ChecklistItem[];
    const newScore = this.computeScore(checklist, updatedChallenges);

    const result = await prisma.verificationCase.update({
      where: { caseId: c.caseId },
      data: {
        challenges: updatedChallenges as any,
        trustScore: newScore,
        status: 'IN_PROGRESS'
      }
    });

    // Trigger AI regeneration on evidence request
    AiAssessmentService.triggerRegeneration(documentId, 'EVIDENCE_REQUESTED');
    VerificationCopilotService.triggerRegeneration(documentId, 'EVIDENCE_REQUESTED');

    return result;
  }

  /**
   * Updates checklist item status.
   */
  public static async updateChecklist(documentId: string, checklistItems: ChecklistItem[]) {
    const c = await prisma.verificationCase.findUnique({
      where: { documentId }
    });
    if (!c) throw new NotFoundError('Verification case');

    const challenges = c.challenges as unknown as ChallengeItem[];
    const newScore = this.computeScore(checklistItems, challenges);

    const result = await prisma.verificationCase.update({
      where: { caseId: c.caseId },
      data: {
        checklist: checklistItems as any,
        trustScore: newScore,
        status: 'IN_PROGRESS'
      }
    });

    // Trigger AI regeneration on checklist change
    AiAssessmentService.triggerRegeneration(documentId, 'CHECKLIST_CHANGED');
    VerificationCopilotService.triggerRegeneration(documentId, 'CHECKLIST_CHANGED');

    return result;
  }

  /**
   * Resolves a challenge question with a notary justification string.
   */
  public static async resolveChallenge(documentId: string, challengeId: string, justification: string) {
    const c = await prisma.verificationCase.findUnique({
      where: { documentId }
    });
    if (!c) throw new NotFoundError('Verification case');

    const challenges = c.challenges as unknown as ChallengeItem[];
    let found = false;

    const updatedChallenges = challenges.map(ch => {
      if (ch.id === challengeId) {
        found = true;
        return {
          ...ch,
          resolved: true,
          justification
        };
      }
      return ch;
    });

    if (!found) throw new NotFoundError('Challenge');

    const checklist = c.checklist as unknown as ChecklistItem[];
    const newScore = this.computeScore(checklist, updatedChallenges);

    const result = await prisma.verificationCase.update({
      where: { caseId: c.caseId },
      data: {
        challenges: updatedChallenges as any,
        trustScore: newScore,
        status: 'IN_PROGRESS'
      }
    });

    // Trigger AI regeneration on challenge resolution
    AiAssessmentService.triggerRegeneration(documentId, 'CHALLENGE_RESOLVED');
    VerificationCopilotService.triggerRegeneration(documentId, 'CHALLENGE_RESOLVED');

    return result;
  }

  /**
   * Finalizes verification workspace, hashes the Proof Record, and anchors it to Solana.
   */
  public static async anchorVerificationProof(documentId: string, notaryUserId: string) {
    const c = await prisma.verificationCase.findUnique({
      where: { documentId },
      include: {
        evidence: true,
        notary: true
      }
    });
    if (!c) throw new NotFoundError('Verification case');

    const checklist = c.checklist as unknown as ChecklistItem[];
    const challenges = c.challenges as unknown as ChallengeItem[];

    // Ensure all checklist items are reviewed
    const pendingItems = checklist.filter(item => item.status === 'PENDING');
    if (pendingItems.length > 0) {
      throw new AppError('Cannot finalize case. Some checklist items are still pending.', 400, 'CHECKLIST_PENDING');
    }

    // Ensure all challenges are resolved/justified
    const unresolvedChallenges = challenges.filter(ch => !ch.resolved);
    if (unresolvedChallenges.length > 0) {
      throw new AppError('Cannot finalize case. Some checklist challenges are unresolved.', 400, 'CHALLENGES_PENDING');
    }

    const finalScore = this.computeScore(checklist, challenges);
    const completedItems = checklist.filter(item => item.status === 'PASSED').length;
    const completionPercentage = Math.round((completedItems / checklist.length) * 100);

    // 1. Generate Verification Proof Record
    const proofRecord = {
      caseId: c.caseId,
      documentId: c.documentId,
      notaryId: c.notaryId,
      evidenceCount: c.evidence.length,
      checklistCompletion: completionPercentage,
      conflictsDetected: challenges.filter(ch => ch.type === 'CONFLICT').length,
      conflictsResolved: challenges.filter(ch => ch.type === 'CONFLICT' && ch.resolved).length,
      notaryJustifications: challenges.map(ch => ({
        challengeId: ch.id,
        question: ch.question,
        justification: ch.justification
      })),
      finalTrustScore: finalScore,
      verificationTimestamp: new Date().toISOString()
    };

    // 2. Generate SHA-256 hash of Proof Record
    const proofRecordString = JSON.stringify(proofRecord);
    const vplProofHash = HashService.generateSHA256(proofRecordString);

    // 3. Convert notary public key to Solana address format
    const publicKeyBytes = Buffer.from(c.notary.publicKey, 'base64');
    const solanaPubkeyStr = publicKeyBytes.length === 32
      ? new PublicKey(publicKeyBytes).toBase58()
      : '5h3K1111111111111111111111111111111111111111';

    // 4. Anchor VPL record on Solana using recordSignature (roleByte = 10 for VPL)
    const roleByteVPL = 10;
    const txSig = await BlockchainService.recordSignatureOnChain(
      documentId,
      roleByteVPL,
      solanaPubkeyStr,
      vplProofHash
    );

    // 5. Update VerificationCase record in PostgreSQL
    const updatedCase = await prisma.verificationCase.update({
      where: { caseId: c.caseId },
      data: {
        status: 'VERIFIED',
        trustScore: finalScore,
        vplProofHash,
        vplOnchainTx: txSig
      }
    });

    // 6. Record signature in signatures table (mirror on-chain VPL registration)
    await prisma.signature.create({
      data: {
        documentId,
        notaryId: c.notaryId,
        signerRole: DbSignerRole.NOTARY,
        signatureBytes: HashService.signWithNotary(vplProofHash, c.notaryId),
        signedAt: new Date()
      }
    });

    // 7. Update document status
    const doc = await prisma.document.findUnique({ where: { documentId } });
    if (doc) {
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
            create: [
              {
                eventType: 'NOTARY_SIGNED',
                actorLabel: `Notary VPL Anchor: ${c.notary.name}`,
                onchainTxRef: txSig
              }
            ]
          }
        }
      });
    }

    return updatedCase;
  }
}
