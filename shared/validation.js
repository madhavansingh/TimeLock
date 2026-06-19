"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotaryOnboardSchema = exports.RecordSignatureSchema = exports.RegisterDocumentSchema = exports.OtpVerifySchema = exports.OtpRequestSchema = exports.identifierValidator = exports.uuidValidator = exports.hashValidator = exports.UUID_REGEX = exports.SHA256_REGEX = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
// Helper Regex Patterns
exports.SHA256_REGEX = /^[a-fA-aligned0-9]{64}$/i;
exports.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Primitive Valdiators
exports.hashValidator = zod_1.z.string().regex(exports.SHA256_REGEX, {
    message: 'Invalid SHA-256 hash format. Must be a 64-character hex string.'
});
exports.uuidValidator = zod_1.z.string().uuid({
    message: 'Invalid UUID format.'
});
exports.identifierValidator = zod_1.z.string().refine((val) => {
    const isEmail = zod_1.z.string().email().safeParse(val).success;
    const isPhone = /^\+?[1-9]\d{1,14}$/.test(val); // E.164 phone check
    return isEmail || isPhone;
}, {
    message: 'Identifier must be a valid email or E.164 phone number.'
});
// Payload Validators
exports.OtpRequestSchema = zod_1.z.object({
    identifier: exports.identifierValidator
});
exports.OtpVerifySchema = zod_1.z.object({
    identifier: exports.identifierValidator,
    code: zod_1.z.string().length(6, { message: 'OTP must be exactly 6 characters.' })
});
exports.RegisterDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(100),
    type: zod_1.z.string().min(2).max(50),
    clientHash: exports.hashValidator,
    notaryId: exports.uuidValidator,
    requiredSigners: zod_1.z.number().int().min(1).max(10).optional()
});
exports.RecordSignatureSchema = zod_1.z.object({
    signerRole: zod_1.z.nativeEnum(enums_1.SignerRole),
    signatureBytes: zod_1.z.string().min(1, { message: 'Signature bytes must not be empty.' }),
    certSerial: zod_1.z.string().min(1, { message: 'Certificate serial must not be empty.' })
});
exports.NotaryOnboardSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    dscCertificateSerial: zod_1.z.string().min(1),
    publicKeyBase64: zod_1.z.string().min(1)
});
