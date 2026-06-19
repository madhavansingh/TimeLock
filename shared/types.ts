import { DocumentStatus, UserRole, SignerRole } from './enums';

export interface User {
  userId: string;
  role: UserRole;
  phoneHash: string;
  emailHash: string;
}

export interface Document {
  documentId: string;
  title: string;
  type: string;
  contentHash: string;
  merkleRoot?: string;
  status: DocumentStatus;
  onchainTxSignature?: string;
  onchainPda?: string;
  ownerUserId: string;
  requiredSigners: number;
  signerCount: number;
  createdAt: Date;
}

export interface Signature {
  signatureId: string;
  documentId: string;
  notaryId: string;
  signerRole: SignerRole;
  signatureBytes: string; // Base64
  signedAt: Date;
}

export interface VerificationEvent {
  eventId: string;
  documentId: string;
  eventType: string;
  actorUserId?: string;
  actorLabel: string;
  onchainTxRef?: string;
  occurredAt: Date;
}

export interface FraudScore {
  documentId: string;
  score: number;
  signals: Record<string, any>;
  computedAt: Date;
}

export interface IPFSReference {
  documentId: string;
  cid: string;
  keyReference: string;
}
