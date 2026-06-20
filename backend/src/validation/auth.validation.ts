import { z } from 'zod';
import { identifierValidator } from '../shared/validation';
import { UserRole } from '../shared/enums';

export const LoginRequestSchema = z.object({
  identifier: identifierValidator,
  code: z.string().length(6, { message: 'OTP must be exactly 6 characters.' }),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, { message: 'Refresh token is required.' }),
});

export const RegisterRequestSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.nativeEnum(UserRole),
});

export const PasswordLoginRequestSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});
