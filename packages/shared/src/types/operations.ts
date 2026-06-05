export interface AnalyticsSummary {
  schedule: Record<string, number>;
  work: Record<string, number>;
  front_office: Record<string, number>;
  billing: Record<string, number>;
}

export interface IntegrationCapabilities {
  [key: string]: {
    configured: boolean;
    supports: string[];
  };
}

export interface SessionPolicy {
  user_id: string;
  role: string;
  access_token_expire_minutes: number;
  mfa_required: boolean;
  phi_reauth_required: boolean;
  phi_reauth_minutes: number;
  audit_retention_days: number;
  audit_events: string[];
}
