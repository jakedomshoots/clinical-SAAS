export interface AnalyticsSummary {
  schedule: Record<string, number>;
  work: Record<string, number>;
  front_office: Record<string, number>;
  billing: Record<string, number>;
}

export interface IntegrationCapabilities {
  [key: string]: {
    configured: boolean;
    env_vars?: string[];
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

export interface ReadinessScoreItem {
  key: string;
  label: string;
  ready: boolean;
  detail: string;
}

export interface PilotReadiness {
  product_demo_score: number;
  internal_pilot_score: number;
  product_demo_ready: boolean;
  internal_pilot_ready: boolean;
  demo_items: ReadinessScoreItem[];
  pilot_items: ReadinessScoreItem[];
  generated_at: string;
}
