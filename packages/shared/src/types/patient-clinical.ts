import type { UUID } from './common';

export type PatientMedicationStatus = 'active' | 'review' | 'held' | 'discontinued';
export type PatientCarePlanStatus = 'open' | 'in_progress' | 'completed' | 'blocked';
export type PatientLabResultStatus = 'new' | 'needs_review' | 'reviewed' | 'filed';
export type PatientEncounterStatus = 'draft' | 'provider_review' | 'signed' | 'amended';

export interface PatientMedication {
  id: UUID;
  patient_id: UUID;
  name: string;
  dose: string | null;
  directions: string | null;
  source: string | null;
  status: PatientMedicationStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientMedicationListResponse {
  data: PatientMedication[];
  total: number;
}

export interface PatientCarePlanItem {
  id: UUID;
  patient_id: UUID;
  assigned_to_id: UUID | null;
  assigned_to_name: string | null;
  owner_role: string;
  item: string;
  due: string | null;
  status: PatientCarePlanStatus;
  escalation: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientCarePlanListResponse {
  data: PatientCarePlanItem[];
  total: number;
}

export interface PatientLabResult {
  id: UUID;
  patient_id: UUID;
  collected_at: string | null;
  panel: string;
  result: string;
  flag: string | null;
  status: PatientLabResultStatus;
  source: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientLabResultListResponse {
  data: PatientLabResult[];
  total: number;
}

export interface PatientEncounter {
  id: UUID;
  patient_id: UUID;
  appointment_id: UUID | null;
  provider_id: UUID | null;
  provider_name: string | null;
  encounter_type: string;
  status: PatientEncounterStatus;
  summary: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientEncounterListResponse {
  data: PatientEncounter[];
  total: number;
}
