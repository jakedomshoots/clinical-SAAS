export type UUID = string;

export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    page_size: number;
  };
}

export interface ApiError {
  detail: string;
  code?: string;
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export type Role = 'admin' | 'provider' | 'ma' | 'front_desk' | 'manager';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type AppointmentStatus =
  | 'scheduled'
  | 'checked_in'
  | 'roomed'
  | 'provider_review'
  | 'checkout'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type FaxDirection = 'inbound' | 'outbound';
export type FaxStatus = 'pending' | 'sending' | 'sent' | 'received' | 'processing' | 'failed';

export type SyncHealth = 'green' | 'amber' | 'red';
