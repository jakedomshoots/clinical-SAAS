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

export interface ChargeReviewItem {
  encounter_id: UUID;
  patient_id: UUID;
  patient_name: string;
  appointment_id: UUID | null;
  encounter_type: string;
  signed_at: string | null;
  summary: string | null;
  recommended_cpt_codes: string[];
  recommended_diagnosis_codes: string[];
}

export interface ChargeReviewListResponse {
  data: ChargeReviewItem[];
  total: number;
}

export interface EligibilityCheck {
  patient_id: UUID;
  payer: string | null;
  status: string;
  reference_id: string;
  message: string;
}

export interface BillingTimelineEvent {
  id: UUID;
  source?: 'audit' | 'integration';
  event_type: string;
  entity_type: string;
  entity_id: UUID;
  actor_id: UUID | null;
  payload: Record<string, unknown>;
  created_at: string;
  status?: string | null;
}

export interface BillingTimelineResponse {
  data: BillingTimelineEvent[];
  total: number;
}
