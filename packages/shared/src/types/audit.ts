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
