import { 
  CanonicalDocument, 
  CanonicalOwnershipTransfer, 
  CanonicalIdentity, 
  CanonicalEvidence, 
  CanonicalVerificationPassport 
} from './canonical-models';

export class CdmTranslationService {
  /**
   * Translates a database Document model to the Canonical Document format.
   */
  public static toCanonicalDocument(doc: any): CanonicalDocument {
    if (!doc) throw new Error('Document cannot be null for translation');

    let metadataParsed = null;
    if (doc.metadata) {
      metadataParsed = {
        surveyNumber: doc.metadata.surveyNumber || undefined,
        propertyId: doc.metadata.propertyId || undefined,
        registrationNumber: doc.metadata.registrationNumber || undefined,
        ownerName: doc.metadata.ownerName || undefined,
        ownerIdentifier: doc.metadata.ownerIdentifier || undefined,
      };
    }

    return {
      documentId: doc.documentId,
      title: doc.title,
      type: doc.type,
      contentHash: doc.contentHash,
      merkleRoot: doc.merkleRoot || null,
      status: String(doc.status),
      blockchainTxSignature: doc.onchainTxSignature || null,
      blockchainPda: doc.onchainPda || null,
      ownerId: doc.ownerUserId,
      createdAt: doc.createdAt,
      metadata: metadataParsed,
    };
  }

  /**
   * Translates a database OwnershipTransfer model to the Canonical format.
   */
  public static toCanonicalOwnershipTransfer(transfer: any): CanonicalOwnershipTransfer {
    if (!transfer) throw new Error('OwnershipTransfer cannot be null for translation');

    return {
      transferId: transfer.transferId,
      documentId: transfer.documentId,
      previousOwnerHash: transfer.previousOwnerHash,
      newOwnerHash: transfer.newOwnerHash,
      status: transfer.status,
      blockchainTxSig: transfer.blockchainTxSig || null,
      transferType: transfer.transferType,
      transferNotes: transfer.transferNotes || null,
      initiatedAt: transfer.initiatedAt,
      finalizedAt: transfer.finalizedAt || null,
    };
  }

  /**
   * Translates a database User model to the Canonical Identity format.
   */
  public static toCanonicalIdentity(user: any): CanonicalIdentity {
    if (!user) throw new Error('User cannot be null for translation');

    const federatedIdentities = Array.isArray(user.federatedIdentities)
      ? user.federatedIdentities.map((fed: any) => ({
          provider: fed.provider,
          externalId: fed.externalId,
          verifiedAt: fed.verifiedAt || null,
        }))
      : [];

    return {
      userId: user.userId,
      name: user.name || null,
      email: user.email,
      role: String(user.role),
      federatedIdentities,
    };
  }

  /**
   * Translates a database Evidence model to the Canonical format.
   */
  public static toCanonicalEvidence(evidence: any): CanonicalEvidence {
    if (!evidence) throw new Error('Evidence cannot be null for translation');

    return {
      evidenceId: evidence.evidenceId,
      caseId: evidence.caseId,
      title: evidence.title,
      ipfsCid: evidence.ipfsCid,
      createdAt: evidence.createdAt,
    };
  }

  /**
   * Translates a database DigitalTwin model to the Canonical Verification Passport.
   */
  public static toCanonicalVerificationPassport(twin: any): CanonicalVerificationPassport {
    if (!twin) throw new Error('DigitalTwin cannot be null for translation');

    return {
      twinId: twin.twinId,
      documentId: twin.documentId,
      version: twin.version,
      passportScore: twin.passportScore,
      passportStatus: twin.passportStatus,
      verificationHistory: twin.verificationHistory,
      ownershipHistory: twin.ownershipHistory,
      registryConsistency: twin.registryConsistency,
      blockchainIntegrity: twin.blockchainIntegrity,
      evidenceCompleteness: twin.evidenceCompleteness,
      aiAssessments: twin.aiAssessments,
      riskEvolution: twin.riskEvolution,
      legalLifecycle: twin.legalLifecycle,
    };
  }
}
