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
});

export const LocalRecordSignatureSchema = z.object({
  signerRole: z.nativeEnum(SignerRole),
  signatureBytes: z.string().min(1, { message: 'Signature bytes must not be empty.' }),
  certSerial: z.string().min(1, { message: 'Certificate serial must not be empty.' }),
  notaryId: z.string().uuid({ message: 'Invalid Notary ID format.' }).optional(),
});
