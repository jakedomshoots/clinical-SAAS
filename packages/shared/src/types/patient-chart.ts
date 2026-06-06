import type { Appointment } from './schedule';
import type { Fax } from './fax';
import type { PatientDocument } from './patient-document';
import type { Task } from './task';
import type { UUID } from './common';

export interface PatientChartSummaryCounts {
  documents_total: number;
  documents_needing_review: number;
  open_tasks: number;
  urgent_tasks: number;
  recent_faxes: number;
  upcoming_appointments: number;
  unsigned_encounters: number;
  medications_needing_review: number;
  labs_needing_review: number;
  care_plan_blockers: number;
}

export interface PatientChartSummary {
  patient_id: UUID;
  checkout_readiness: 'ready' | 'blocked';
  blockers: string[];
  counts: PatientChartSummaryCounts;
  documents: PatientDocument[];
  open_tasks: Task[];
  recent_faxes: Fax[];
  upcoming_appointments: Appointment[];
}
