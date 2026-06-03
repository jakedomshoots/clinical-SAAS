import type { UUID } from './common';

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
  group_number: string;
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
  phone: string;
  email: string;
  address: Address | null;
  emergency_contact: EmergencyContact | null;
  insurance: Insurance | null;
  allergies: Allergy[];
  problem_list: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientCreate {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  phone?: string;
  email?: string;
  address?: Address;
  emergency_contact?: EmergencyContact;
  insurance?: Insurance;
  allergies?: Allergy[];
  problem_list?: string[];
}

export interface PatientUpdate {
  first_name?: string;
  last_name?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: Address | null;
  emergency_contact?: EmergencyContact | null;
  insurance?: Insurance | null;
  allergies?: Allergy[];
  problem_list?: string[];
}
