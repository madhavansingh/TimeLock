import { z } from 'zod';
import { SignerRole } from './enums';

// Helper Regex Patterns
export const SHA256_REGEX = /^[a-fA-aligned0-9]{64}$/i;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Primitive Valdiators
export const hashValidator = z.string().regex(SHA256_REGEX, {
  message: 'Invalid SHA-256 hash format. Must be a 64-character hex string.'
});

export const uuidValidator = z.string().uuid({
  message: 'Invalid UUID format.'
});

export const identifierValidator = z.string().refine(
  (val: string) => {
    const isEmail = z.string().email().safeParse(val).success;
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(val); // E.164 phone check
    return isEmail || isPhone;
  },
  {
    message: 'Identifier must be a valid email or E.164 phone number.'
  }
);

// Payload Validators
export const OtpRequestSchema = z.object({
  identifier: identifierValidator
});

export const OtpVerifySchema = z.object({
  identifier: identifierValidator,
  code: z.string().length(6, { message: 'OTP must be exactly 6 characters.' })
});

export const RegisterDocumentSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(100),
  type: z.string().min(2).max(50),
  clientHash: hashValidator,
  notaryId: uuidValidator,
  requiredSigners: z.number().int().min(1).max(10).optional()
});

export const RecordSignatureSchema = z.object({
  signerRole: z.nativeEnum(SignerRole),
  signatureBytes: z.string().min(1, { message: 'Signature bytes must not be empty.' }),
  certSerial: z.string().min(1, { message: 'Certificate serial must not be empty.' })
});

export const NotaryOnboardSchema = z.object({
  name: z.string().min(2).max(100),
  dscCertificateSerial: z.string().min(1),
  publicKeyBase64: z.string().min(1)
});
