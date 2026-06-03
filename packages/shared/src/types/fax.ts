import type { UUID, FaxDirection, FaxStatus } from './common';

export interface Fax {
  id: UUID;
  direction: FaxDirection;
  status: FaxStatus;
  from_number: string;
  to_number: string;
  pages: number;
  file_url: string | null;
  patient_id: UUID | null;
  patient_name: string | null;
  matched_by: string | null;
  ocr_text: string | null;
  created_at: string;
}

export interface FaxSendRequest {
  to_number: string;
  patient_id?: UUID;
  file_url?: string;
}
