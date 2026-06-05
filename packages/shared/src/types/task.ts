import type { UUID, TaskPriority, TaskStatus } from './common';

export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assigned_to_id: UUID | null;
  assigned_to_name: string | null;
  patient_id: UUID | null;
  patient_name: string | null;
  source_type: string | null;
  source_id: UUID | null;
  delivery_channel: string | null;
  delivery_status: string | null;
  delivery_recipient: string | null;
  delivery_provider_message_id: string | null;
  delivery_error: string | null;
  delivery_attempts: number;
  delivered_at: string | null;
  creator_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface TaskPatientOutreachDraft {
  task_id: UUID;
  patient_id: UUID;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  subject: string;
  body: string;
}

export interface TaskPatientOutreachDelivery {
  task_id: UUID;
  patient_id: UUID;
  channel: 'sms' | 'email';
  delivery_status: string;
  recipient: string | null;
  subject: string;
  provider_message_id: string | null;
  attempts: number;
}
