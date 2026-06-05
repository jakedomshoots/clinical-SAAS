import { z } from 'zod';

export const taskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  due_date: z.string().datetime().optional(),
  assigned_to_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  source_type: z.string().max(100).optional(),
  source_id: z.string().uuid().optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  due_date: z.string().datetime().nullable().optional(),
  assigned_to_id: z.string().uuid().nullable().optional(),
  source_type: z.string().max(100).nullable().optional(),
  source_id: z.string().uuid().nullable().optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
