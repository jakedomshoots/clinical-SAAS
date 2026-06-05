import type { UUID } from './common';

export type PortalIntakeStatus = 'received' | 'needs_review' | 'applied' | 'rejected';

export interface PortalIntakeSubmission {
  id: UUID;
  patient_id: UUID | null;
  status: PortalIntakeStatus;
  source: string;
  request_type: string;
  submitted_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PortalIntakeListResponse {
  data: PortalIntakeSubmission[];
  total: number;
}

export interface EncounterTemplate {
  id: string;
  name: string;
  encounter_type: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface EncounterTemplateListResponse {
  data: EncounterTemplate[];
  total: number;
}
