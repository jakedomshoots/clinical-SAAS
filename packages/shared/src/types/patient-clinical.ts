import type { UUID } from './common';

export type PatientMedicationStatus = 'active' | 'review' | 'held' | 'discontinued';
export type PatientCarePlanStatus = 'open' | 'in_progress' | 'completed' | 'blocked';
export type PatientLabResultStatus = 'new' | 'needs_review' | 'reviewed' | 'filed';

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
  owner_role: string;
  item: string;
  due: string | null;
  status: PatientCarePlanStatus;
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
