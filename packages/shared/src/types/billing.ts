import type { UUID } from './common';

export type BillingCaseStatus = 'draft' | 'ready' | 'submitted' | 'denied' | 'paid';

export interface BillingCase {
  id: UUID;
  patient_id: UUID;
  appointment_id: UUID | null;
  status: BillingCaseStatus;
  payer: string | null;
  eligibility_status: string;
  cpt_codes: string[];
  diagnosis_codes: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingCaseListResponse {
  data: BillingCase[];
  total: number;
}

export interface EligibilityCheck {
  patient_id: UUID;
  payer: string | null;
  status: string;
  reference_id: string;
  message: string;
}
