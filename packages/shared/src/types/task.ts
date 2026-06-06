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
  preferred_contact_channel: string | null;
  channel_options: {
    channel: 'sms' | 'email';
    recipient: string | null;
    eligible: boolean;
    blocked_reason: string | null;
  }[];
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
  eligible: boolean;
  blocked_reason: string | null;
  retryable: boolean;
}

export interface TaskWorkQueueAction {
  key: string;
  label: string;
  detail: string;
  severity: 'critical' | 'warning';
  route: string;
}

export interface TaskWorkQueue {
  generated_at: string;
  open_count: number;
  in_progress_count: number;
  blocked_count: number;
  urgent_count: number;
  high_priority_count: number;
  overdue_count: number;
  due_today_count: number;
  unassigned_count: number;
  role_buckets: Record<string, { open_count: number; urgent_count: number; overdue_count: number }>;
  source_buckets: Record<string, number>;
  next_actions: TaskWorkQueueAction[];
}

export interface TaskOutreachSummary {
  queued_count: number;
  delivered_count: number;
  failed_count: number;
  blocked_count: number;
  retryable_failed_count: number;
  consent_blocked_count: number;
  no_contact_blocked_count: number;
  total_outreach_tasks: number;
  consent_required: boolean;
}
