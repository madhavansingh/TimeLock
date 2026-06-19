import { z } from 'zod';
import { identifierValidator } from '../../../shared/validation';

export const LoginRequestSchema = z.object({
  identifier: identifierValidator,
  code: z.string().length(6, { message: 'OTP must be exactly 6 characters.' }),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required.' }),
});
