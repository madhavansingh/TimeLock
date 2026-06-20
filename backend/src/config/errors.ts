/**
 * errors.ts — Custom Application Error Classes
 *
 * Provides a typed error hierarchy so the global error middleware can
 * distinguish operational errors (bad input, not found, auth failures)
 * from unexpected programmer errors (null deref, DB crash, etc.).
 *
 * Usage:
 *   throw new NotFoundError('Document not found.');
 *   throw new ValidationError('Invalid hash format.', { field: 'clientHash' });
 *   throw new UnauthorizedError();
 */

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------
export class AppError extends Error {
  /** HTTP status code to send to the client */
  public readonly statusCode: number;
  /** Machine-readable error code */
  public readonly code: string;
  /** Optional structured details for debugging */
  public readonly details?: unknown;
  /** Whether this error is safe to expose to clients */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ---------------------------------------------------------------------------
// 400 — Bad Request / Validation
// ---------------------------------------------------------------------------
export class ValidationError extends AppError {
  constructor(message = 'Request validation failed.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

// ---------------------------------------------------------------------------
// 401 — Unauthorized
// ---------------------------------------------------------------------------
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required. Provide a valid Bearer token.') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class InvalidOtpError extends AppError {
  constructor(message = 'The code provided is incorrect or has expired.') {
    super(message, 401, 'INVALID_OTP', true);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message = 'The session token provided is invalid or expired.') {
    super(message, 401, 'INVALID_TOKEN', true);
  }
}

// ---------------------------------------------------------------------------
// 403 — Forbidden / RBAC
// ---------------------------------------------------------------------------
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

// ---------------------------------------------------------------------------
// 404 — Not Found
// ---------------------------------------------------------------------------
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'NOT_FOUND', true);
  }
}

// ---------------------------------------------------------------------------
// 409 — Conflict
// ---------------------------------------------------------------------------
export class ConflictError extends AppError {
  constructor(message = 'A conflicting record already exists.') {
    super(message, 409, 'CONFLICT', true);
  }
}

// ---------------------------------------------------------------------------
// 422 — Business Logic / Integrity violations
// ---------------------------------------------------------------------------
export class IntegrityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 422, 'INTEGRITY_ERROR', true, details);
  }
}

// ---------------------------------------------------------------------------
// 429 — Rate Limit / Lockout
// ---------------------------------------------------------------------------
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'TOO_MANY_REQUESTS', true);
  }
}

// ---------------------------------------------------------------------------
// 500 — Internal Server / Unexpected
// ---------------------------------------------------------------------------
export class InternalError extends AppError {
  constructor(message = 'An unexpected error occurred.', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false, details);
  }
}

// ---------------------------------------------------------------------------
// 502 — Upstream / Blockchain / Storage failures
// ---------------------------------------------------------------------------
export class UpstreamError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `Upstream service "${service}" returned an error.`,
      502,
      'UPSTREAM_ERROR',
      true
    );
  }
}

// ApiError alias for AppError base class
export class ApiError extends AppError {}

// ---------------------------------------------------------------------------
// 502 — Blockchain Error
// ---------------------------------------------------------------------------
export class BlockchainError extends AppError {
  constructor(message = 'Solana blockchain transaction failed or network is offline.', details?: unknown) {
    super(message, 502, 'BLOCKCHAIN_UNAVAILABLE', true, details);
  }
}

// ---------------------------------------------------------------------------
// 502 — AI Service Error
// ---------------------------------------------------------------------------
export class AIServiceError extends AppError {
  constructor(message = 'NVIDIA Nemotron AI service returned an error or is unconfigured.', details?: unknown) {
    super(message, 502, 'AI_SERVICE_UNAVAILABLE', true, details);
  }
}

// ---------------------------------------------------------------------------
// 502 — Storage Error
// ---------------------------------------------------------------------------
export class StorageError extends AppError {
  constructor(message = 'IPFS/Pinata storage upload failed or credentials unconfigured.', details?: unknown) {
    super(message, 502, 'STORAGE_UNAVAILABLE', true, details);
  }
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
