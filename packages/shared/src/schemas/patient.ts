import { z } from 'zod';

export const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
});

export const emergencyContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(10),
});

export const insuranceSchema = z.object({
  provider: z.string().min(1),
  plan: z.string().min(1),
  member_id: z.string().min(1),
  group_number: z.string().optional(),
});

export const allergySchema = z.object({
  substance: z.string().min(1),
  reaction: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'severe']),
});

export const patientCreateSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  gender: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: addressSchema.optional(),
  emergency_contact: emergencyContactSchema.optional(),
  insurance: insuranceSchema.optional(),
  allergies: z.array(allergySchema).optional(),
  problem_list: z.array(z.string()).optional(),
});

export const patientUpdateSchema = patientCreateSchema.partial();

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
