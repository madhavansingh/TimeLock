export interface CanonicalDocument {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  merkleRoot: string | null;
  status: string;
  blockchainTxSignature: string | null;
  blockchainPda: string | null;
  ownerId: string;
  createdAt: Date;
  metadata: {
    surveyNumber?: string;
    propertyId?: string;
    registrationNumber?: string;
    ownerName?: string;
    ownerIdentifier?: string;
  } | null;
}

export interface CanonicalOwnershipTransfer {
  transferId: string;
  documentId: string;
  previousOwnerHash: string;
  newOwnerHash: string;
  status: string;
  blockchainTxSig: string | null;
  transferType: string;
  transferNotes: string | null;
  initiatedAt: Date;
  finalizedAt: Date | null;
}

export interface CanonicalIdentity {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  federatedIdentities: Array<{
    provider: string;
    externalId: string;
    verifiedAt: Date | null;
  }>;
}

export interface CanonicalEvidence {
  evidenceId: string;
  caseId: string;
  title: string;
  ipfsCid: string;
  createdAt: Date;
}

export interface CanonicalVerificationPassport {
  twinId: string;
  documentId: string;
  version: number;
  passportScore: number;
  passportStatus: string;
  verificationHistory: any;
  ownershipHistory: any;
  registryConsistency: any;
  blockchainIntegrity: any;
  evidenceCompleteness: any;
  aiAssessments: any;
  riskEvolution: any;
  legalLifecycle: any;
}
