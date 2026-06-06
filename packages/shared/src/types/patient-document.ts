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
  upload_status: string;
  ocr_status: string;
  classification: string | null;
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
  preview_supported: boolean;
  content_type: string | null;
  viewer_mode: 'inline' | 'download' | 'metadata';
  access_token: string | null;
  storage_status: string;
  file_name: string | null;
  source_uri_preview: string | null;
}

export interface PatientDocumentDownloadHandoff {
  document_id: UUID;
  title: string;
  file_name: string;
  content_type: string;
  viewer_mode: 'inline' | 'download';
  storage_status: string;
  source_uri_preview: string;
  presigned_url: string | null;
  message: string;
}

export interface PatientDocumentProcessResult {
  document: PatientDocument;
  created_task_id: UUID | null;
}

export interface PatientDocumentUploadPrepareResult {
  upload_url: string;
  file_url: string;
  upload_token: string;
  method: 'PUT';
  expires_at: string;
  headers: Record<string, string>;
}
