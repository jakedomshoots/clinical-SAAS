import { z } from 'zod';

export const faxSendSchema = z.object({
  to_number: z.string().min(10, 'Valid fax number required'),
  patient_id: z.string().uuid().optional(),
  file_url: z.string().optional(),
});

export const faxMatchSchema = z.object({
  patient_id: z.string().uuid(),
});

export type FaxSendInput = z.infer<typeof faxSendSchema>;
export type FaxMatchInput = z.infer<typeof faxMatchSchema>;
