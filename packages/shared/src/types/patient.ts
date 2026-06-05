import type { UUID } from './common';
import type { PatientCreateInput, PatientUpdateInput } from '../schemas/patient';

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Insurance {
  provider: string;
  plan: string;
  member_id: string;
  group_number?: string | null;
}

export interface Allergy {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe';
}

export interface Patient {
  id: UUID;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  phone: string | null;
  email: string | null;
  address: Address | null;
  emergency_contact: EmergencyContact | null;
  insurance: Insurance | null;
  allergies: Allergy[];
  problem_list: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PatientCreate = PatientCreateInput;
export type PatientUpdate = PatientUpdateInput;

export interface PatientListResponse {
  data: Patient[];
  total: number;
  page?: number;
  page_size?: number;
}
