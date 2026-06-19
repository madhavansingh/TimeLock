import { z } from 'zod';
import { DbUserRole } from '@prisma/client';

export const GetUserParamsSchema = z.object({
  id: z.string().uuid({ message: 'Invalid User ID format. Must be a valid UUID.' }),
});

export const UpdateUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format. Must be E.164.' }).optional(),
  role: z.nativeEnum(DbUserRole, { message: 'Invalid user role.' }).optional(),
});

export const ListUsersQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : 10),
    z.number().int().positive().max(100).default(10)
  ),
  skip: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : 0),
    z.number().int().nonnegative().default(0)
  ),
  role: z.nativeEnum(DbUserRole).optional(),
});
