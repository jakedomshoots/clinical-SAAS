import type { UUID } from './common';

export type BillingCaseStatus = 'draft' | 'ready' | 'submitted' | 'denied' | 'paid';

export interface BillingCase {
  id: UUID;
  patient_id: UUID;
  appointment_id: UUID | null;
  status: BillingCaseStatus;
  payer: string | null;
  eligibility_status: string;
  claim_control_number: string | null;
  submission_ready_at: string | null;
  submitted_at: string | null;
  denied_at: string | null;
  denial_reason: string | null;
  denial_worked_at: string | null;
  remittance_status: string;
  allowed_amount: number | null;
  paid_amount: number | null;
  paid_at: string | null;
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

export interface BillingClaimReadiness {
  case_id: UUID;
  ready: boolean;
  blockers: string[];
  warnings: string[];
  recommended_next_step: string;
}

export interface BillingWorkQueue {
  draft_count: number;
  ready_count: number;
  submitted_count: number;
  denied_count: number;
  paid_count: number;
  missing_coding_count: number;
  eligibility_needed_count: number;
  denial_rework_count: number;
  remittance_pending_count: number;
  total: number;
}
