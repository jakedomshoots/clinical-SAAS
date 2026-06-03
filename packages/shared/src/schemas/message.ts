import { z } from 'zod';

export const messageSendSchema = z.object({
  recipient_id: z.string().uuid(),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Message body is required'),
  thread_id: z.string().uuid().optional(),
});

export type MessageSendInput = z.infer<typeof messageSendSchema>;
