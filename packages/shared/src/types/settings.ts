export interface ClinicSettings {
  reminder_offsets_minutes: number[];
  reminder_sms_template: string;
  reminder_email_template: string;
  sender_identity: string;
  audit_retention_days: number;
  phi_reauth_minutes: number;
}

export type ClinicSettingsUpdate = Partial<ClinicSettings>;
