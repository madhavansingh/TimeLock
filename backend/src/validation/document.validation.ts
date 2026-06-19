import { z } from 'zod';
import { uuidValidator } from '../../../shared/validation';

export const LocalRegisterDocumentSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }).max(100),
  type: z.string().min(2).max(50),
  notaryId: uuidValidator,
  requiredSigners: z.coerce.number().int().min(1).max(10).optional(),
});
