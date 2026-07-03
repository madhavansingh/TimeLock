import { z } from 'zod';
import { uuidValidator } from '../shared/validation';
import { SignerRole } from '../shared/enums';

export const LocalRegisterDocumentSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(100),
  type: z.string().min(2).max(50),
  notaryId: uuidValidator,
  requiredSigners: z.coerce.number().int().min(1).max(10).optional(),
  surveyNumber: z.string().optional(),
  propertyId: z.string().optional(),
  registrationNumber: z.string().optional(),
  ownerName: z.string().optional(),
  paymentId: z.string().uuid().optional(),
  clientHash: z.string().regex(/^[a-fA-F0-9]{64}$/, { message: 'Invalid client hash format.' }),
  uploadTimestamp: z.string(),
  uploadSessionId: z.string().uuid({ message: 'Invalid upload session ID.' }),
  algorithm: z.enum(['SHA256', 'SHA3', 'BLAKE3']).default('SHA256'),
  frontendVersion: z.string(),
  browserTimezone: z.string(),
  browserUserAgent: z.string(),
  browserLanguage: z.string(),
  clientVersion: z.string(),
});

export const LocalRecordSignatureSchema = z.object({
  signerRole: z.nativeEnum(SignerRole),
  signatureBytes: z.string().min(1, { message: 'Signature bytes must not be empty.' }),
  certSerial: z.string().min(1, { message: 'Certificate serial must not be empty.' }),
  notaryId: z.string().uuid({ message: 'Invalid Notary ID format.' }).optional(),
});
