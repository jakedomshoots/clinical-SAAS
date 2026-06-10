import { z } from 'zod';

export const appointmentCreateSchema = z.object({
  patient_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  type: z.string().default('office_visit'),
  notes: z.string().optional(),
});

export const appointmentUpdateSchema = z.object({
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  type: z.string().optional(),
  status: z
    .enum(['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .optional(),
  notes: z.string().nullable().optional(),
});

export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;
