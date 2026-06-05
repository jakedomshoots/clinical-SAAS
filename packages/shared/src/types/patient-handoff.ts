import type { Patient } from './patient';
import type { PatientChartSummary } from './patient-chart';
import type {
  PatientCarePlanItem,
  PatientEncounter,
  PatientLabResult,
  PatientMedication,
} from './patient-clinical';
import type { PatientDocument } from './patient-document';

export interface PatientCheckoutHandoff {
  patient: Patient;
  chart_summary: PatientChartSummary;
  documents_needing_review: PatientDocument[];
  medications_needing_review: PatientMedication[];
  labs_needing_review: PatientLabResult[];
  care_plan_open_items: PatientCarePlanItem[];
  unsigned_encounters: PatientEncounter[];
}
