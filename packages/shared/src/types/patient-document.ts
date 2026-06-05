import type { UUID } from './common';

export type PatientDocumentStatus =
  | 'received'
  | 'needs_review'
  | 'filed'
  | 'reconciled'
  | 'rejected';

export interface PatientDocument {
  id: UUID;
  patient_id: UUID;
  title: string;
  source: string;
  document_type: string;
  status: PatientDocumentStatus;
  matched_by: string | null;
  pages: number;
  file_url: string | null;
  summary: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface PatientDocumentListResponse {
  data: PatientDocument[];
  total: number;
  page: number;
  page_size: number;
}

export interface PatientDocumentAccess {
  document_id: UUID;
  available: boolean;
  url: string | null;
  expires_at: string | null;
  reason: string | null;
}
