export interface ClinicSettings {
  reminder_offsets_minutes: number[];
  reminder_sms_template: string;
  reminder_email_template: string;
  sender_identity: string;
}

export type ClinicSettingsUpdate = Partial<ClinicSettings>;
