import type { UUID } from './common';

export interface AuditEvent {
  id: UUID;
  actor_id: UUID | null;
  event_type: string;
  entity_type: string;
  entity_id: UUID;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditReviewCategory {
  key: string;
  label: string;
  count: number;
  severity: 'critical' | 'warning' | 'clear';
  event_types: string[];
  last_event_at: string | null;
  route: string;
}

export interface AuditReviewAction {
  key: string;
  label: string;
  detail: string;
  severity: 'critical' | 'warning' | 'clear';
  route: string;
}

export interface AuditReviewSummary {
  generated_at: string;
  total_event_count: number;
  sensitive_event_count: number;
  categories: AuditReviewCategory[];
  recommended_actions: AuditReviewAction[];
}
