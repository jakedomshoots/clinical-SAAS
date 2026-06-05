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
  creator_id: UUID;
  created_at: string;
  updated_at: string;
}
