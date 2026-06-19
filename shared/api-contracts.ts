import { DocumentStatus, SignerRole } from './enums';
import { Document, VerificationEvent } from './types';

// API Standard Response Envelope
export interface ApiResponseEnvelope<T> {
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
  requestId: string;
}

// POST /v1/auth/otp/request
export interface OtpRequestPayload {
  identifier: string; // phone or email
}
export interface OtpRequestResponse {
  message: string;
}

// POST /v1/auth/otp/verify
export interface OtpVerifyPayload {
  identifier: string;
  code: string;
}
export interface OtpVerifyResponse {
  token: string;
  user: {
    userId: string;
    role: string;
  };
}

// POST /v1/documents
export interface RegisterDocumentPayload {
  title: string;
  type: string;
  clientHash: string;
  notaryId: string;
  requiredSigners?: number;
}
export interface RegisterDocumentResponse {
  documentId: string;
  hash: string;
  cid: string;
  status: DocumentStatus;
  onchainTxSignature?: string;
}

// GET /v1/documents/:id/status
export interface DocumentStatusResponse {
  documentId: string;
  status: DocumentStatus;
  contentHash: string;
  onchainTxSignature?: string;
  timestamp: string;
  notarySummary?: {
    notaryId: string;
    signedAt: string;
  };
  signers: {
    required: number;
    completed: number;
  };
}

// POST /v1/documents/:id/verify
export interface VerifyFileResponse {
  documentId: string;
  result: 'authentic' | 'modified';
  expectedHash: string;
  submittedHash: string;
  detectedAt: string;
  riskScore: number;
}

// POST /v1/documents/:id/signatures
export interface RecordSignaturePayload {
  signerRole: SignerRole;
  signatureBytes: string; // Base64
  certSerial: string;
}
export interface RecordSignatureResponse {
  signatureId: string;
  status: DocumentStatus;
}

// GET /v1/documents/:id/custody
export interface DocumentCustodyResponse {
  documentId: string;
  timeline: VerificationEvent[];
}

// GET /v1/documents/:id/certificate
export interface DownloadCertificateResponse {
  documentId: string;
  timestamp: string;
  onchainTxSignature: string;
  status: DocumentStatus;
  qrCodeUrl: string;
  pdfBase64: string; // Printable base64 encoded certificate
}

// GET /v1/documents/search
export interface DocumentSearchQuery {
  status?: DocumentStatus;
  startDate?: string;
  endDate?: string;
  notaryId?: string;
  page?: number;
  limit?: number;
}
export interface DocumentSearchResponse {
  items: Document[];
  total: number;
  page: number;
  limit: number;
}

// GET /v1/documents/:id/fraud-score
export interface FraudScoreResponse {
  documentId: string;
  score: number;
  signals: Record<string, string | number | boolean>;
  computedAt: string;
}

// POST /v1/notaries/onboard
export interface NotaryOnboardPayload {
  name: string;
  dscCertificateSerial: string;
  publicKeyBase64: string;
}
export interface NotaryOnboardResponse {
  notaryId: string;
  message: string;
}
