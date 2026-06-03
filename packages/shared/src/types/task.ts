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
  creator_id: UUID;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to_id?: UUID;
  patient_id?: UUID;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  assigned_to_id?: UUID | null;
}
