export interface AnalyticsSummary {
  schedule: Record<string, number>;
  work: Record<string, number>;
  front_office: Record<string, number>;
  billing: Record<string, number>;
}

export interface IntegrationCapabilities {
  [key: string]: {
    label?: string;
    configured: boolean;
    healthy?: boolean;
    mode?: string;
    env_vars?: string[];
    supports: string[];
    workflows?: string[];
    action?: string;
    error?: string | null;
  };
}

export interface LaunchRequirement {
  key: string;
  category: string;
  label: string;
  ready: boolean;
  severity: 'critical' | 'warning';
  detail: string;
  action: string;
  env_vars: string[];
  docs: string[];
}

export interface LaunchReadiness {
  production_ready: boolean;
  score: number;
  critical_blockers: number;
  warnings: number;
  environment: string;
  requirements: LaunchRequirement[];
}

export interface IntegrationConfigField {
  key: string;
  label: string;
  required: boolean;
  secret: boolean;
  configured: boolean;
  source: 'environment' | 'setup_draft' | 'missing';
  value_preview: string | null;
}

export interface IntegrationConfig {
  key: string;
  label: string;
  configured: boolean;
  healthy: boolean;
  mode: 'environment' | 'setup_draft' | 'demo';
  status: 'healthy' | 'configured' | 'draft' | 'missing';
  fields: IntegrationConfigField[];
  workflows: string[];
  action: string;
  last_tested_at: string | null;
  last_test_status: string | null;
}

export interface IntegrationConfigListResponse {
  data: IntegrationConfig[];
}

export interface IntegrationConnectionTestResult {
  integration: string;
  status: string;
  configured: boolean;
  healthy: boolean;
  mode: string;
  message: string;
  event_id: string;
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
