import type { UUID } from './common';

export interface WorkloadBucket {
  owner_role: string;
  assigned_to_id: UUID | null;
  assigned_to_name: string | null;
  open_items: number;
  blocked_items: number;
  escalated_items: number;
  source_linked_tasks: number;
  urgent_tasks: number;
}

export interface WorkloadSummary {
  data: WorkloadBucket[];
  total_open_items: number;
  unassigned_items: number;
  source_linked_tasks: number;
  urgent_tasks: number;
}
