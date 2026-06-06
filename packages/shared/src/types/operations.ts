export interface AnalyticsSummary {
  schedule: Record<string, number>;
  work: Record<string, number>;
  front_office: Record<string, number>;
  billing: Record<string, number>;
}

export interface DailyCloseoutRisk {
  label: string;
  category: string;
  count: number;
  severity: 'critical' | 'warning' | 'normal';
  detail: string;
}

export interface DailyCloseoutAction {
  key: string;
  severity: 'critical' | 'warning' | 'normal';
  label: string;
  detail: string;
  route: string;
}

export interface DailyCloseout {
  status: 'clear' | 'attention';
  generated_at: string;
  totals: Record<string, number>;
  aging: Record<string, number>;
  billing: Record<string, number>;
  risk_register: DailyCloseoutRisk[];
  recommended_actions: DailyCloseoutAction[];
}

export interface OperationsIncident {
  key: string;
  title: string;
  severity: 'critical' | 'warning' | 'normal';
  source: string;
  status: string;
  owner_role: string;
  count: number;
  detail: string;
  recommended_action: string;
  route: string;
}

export interface OperationsIncidentList {
  data: OperationsIncident[];
  open_count: number;
  critical_count: number;
  warning_count: number;
  generated_at: string;
}

export interface ReadinessSnapshot {
  id: string;
  created_at: string;
  operational_status: 'ok' | 'degraded';
  core_status: 'ok' | 'degraded';
  launch_score: number;
  incident_count: number;
  critical_count: number;
  warning_count: number;
}

export interface ReadinessSnapshotList {
  data: ReadinessSnapshot[];
  total: number;
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
  sandbox_tests: string[];
  docs: string[];
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

export interface CredentialPreflightStep {
  key: string;
  label: string;
  status: 'ready' | 'missing' | 'pending' | 'blocked';
  detail: string;
}

export interface SandboxEvidence {
  id: string | null;
  integration: string | null;
  test_key: string;
  test_label: string;
  status: 'missing' | 'passed' | 'failed';
  notes: string;
  reference_url: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
}

export interface CredentialPreflightItem {
  key: string;
  label: string;
  status: 'ready' | 'staged' | 'missing' | 'blocked';
  configured: boolean;
  healthy: boolean;
  mode: string;
  missing_fields: string[];
  configured_fields: string[];
  workflows: string[];
  sandbox_tests: string[];
  sandbox_evidence: SandboxEvidence[];
  blockers: string[];
  steps: CredentialPreflightStep[];
  docs: string[];
  last_tested_at: string | null;
  last_test_status: string | null;
}

export interface SandboxEvidenceCreate {
  test_label: string;
  status: 'passed' | 'failed';
  notes: string;
  reference_url?: string | null;
}

export interface CredentialPreflight {
  generated_at: string;
  ready_count: number;
  staged_count: number;
  blocking_count: number;
  total: number;
  data: CredentialPreflightItem[];
}

export interface SessionPolicy {
  user_id: string;
  role: string;
  access_token_expire_minutes: number;
  mfa_required: boolean;
  mfa_enabled: boolean;
  mfa_provider: string;
  access_review_required: boolean;
  access_review_window_days: number;
  last_login_at: string | null;
  last_access_reviewed_at: string | null;
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
