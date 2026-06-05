import type { UUID, AppointmentStatus } from './common';

export interface Appointment {
  id: UUID;
  patient_id: UUID;
  patient_name: string;
  provider_id: UUID;
  provider_name: string;
  start_time: string;
  end_time: string;
  type: string;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodayQueueItem {
  appointment: Appointment;
  checkout_readiness: 'ready' | 'blocked';
  blockers: string[];
  documents_needing_review: number;
  open_tasks: number;
  urgent_tasks: number;
  unsigned_encounters: number;
}

export interface TodayQueue {
  data: TodayQueueItem[];
  total: number;
  checked_in: number;
  blocked: number;
}

export interface ProviderAvailability {
  id: UUID;
  provider_id: UUID;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AppointmentReminderQueue {
  appointment_id: UUID;
  queued: number;
  event_ids: UUID[];
}
