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

export interface OperatorHealthCheck {
  key: string;
  label: string;
  status: 'healthy' | 'attention' | 'warning' | 'critical';
  score: number;
  detail: string;
  route: string;
  last_seen_at: string | null;
}

export interface OperatorHealthAction {
  key: string;
  label: string;
  detail: string;
  severity: 'attention' | 'warning' | 'critical';
  route: string;
}

export interface OperatorHealth {
  status: 'healthy' | 'attention' | 'critical';
  score: number;
  generated_at: string;
  summary: Record<string, number>;
  checks: OperatorHealthCheck[];
  recommended_actions: OperatorHealthAction[];
}

export interface ProductionConfigCheck {
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

export interface ProductionConfigAudit {
  status: 'ready' | 'attention' | 'blocked';
  score: number;
  environment: string;
  generated_at: string;
  critical_count: number;
  warning_count: number;
  ready_count: number;
  total: number;
  checks: ProductionConfigCheck[];
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

export interface RehearsalGate {
  key: string;
  label: string;
  status: 'ready' | 'warning' | 'blocking';
  score: number;
  detail: string;
  route: string;
}

export interface RehearsalActionAssignment {
  id: string;
  action_key: string;
  owner_id: string | null;
  owner_name: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  due_date: string | null;
  note: string | null;
  assigned_by: string | null;
  assigned_at: string;
}

export interface RehearsalActionAssignmentUpdate {
  owner_id?: string | null;
  owner_name: string;
  status: 'open' | 'in_progress' | 'blocked' | 'done';
  due_date?: string | null;
  note?: string | null;
}

export interface RehearsalAction {
  key: string;
  label: string;
  detail: string;
  route: string;
  severity: 'warning' | 'blocking';
  assignment: RehearsalActionAssignment | null;
}

export interface ProductionRehearsalReport {
  status: 'ready' | 'attention';
  rehearsal_ready: boolean;
  score: number;
  blocking_count: number;
  warning_count: number;
  generated_at: string;
  gates: RehearsalGate[];
  recommended_actions: RehearsalAction[];
}

export interface LaunchWorkplanItem {
  key: string;
  source: 'rehearsal' | 'incident' | 'launch_requirement' | 'credential_preflight';
  category: string;
  label: string;
  detail: string;
  severity: 'warning' | 'blocking';
  route: string;
  owner_role: string;
  recommended_action: string;
  assignment: RehearsalActionAssignment | null;
}

export interface LaunchWorkplan {
  status: 'clear' | 'attention';
  generated_at: string;
  total: number;
  blocking_count: number;
  warning_count: number;
  assigned_count: number;
  unassigned_count: number;
  items: LaunchWorkplanItem[];
}

export interface LaunchWorkplanSnapshot {
  id: string;
  created_at: string;
  status: 'clear' | 'attention';
  total: number;
  blocking_count: number;
  warning_count: number;
  assigned_count: number;
  unassigned_count: number;
}

export interface LaunchWorkplanSnapshotList {
  data: LaunchWorkplanSnapshot[];
  total: number;
}

export interface GoLivePacketEvidence {
  key: string;
  label: string;
  status: 'ready' | 'warning' | 'blocking' | 'missing';
  detail: string;
  route: string;
  captured_at: string | null;
}

export interface GoLiveAttestation {
  id: string;
  created_at: string;
  decision: 'approved' | 'needs_changes' | 'rejected';
  note: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  packet_status: 'ready' | 'attention';
  go_live_ready: boolean;
  blocking_count: number;
  warning_count: number;
  evidence_ready_count: number;
  evidence_total: number;
}

export interface GoLiveAttestationCreate {
  decision: 'approved' | 'needs_changes' | 'rejected';
  note?: string | null;
}

export interface GoLiveAttestationList {
  data: GoLiveAttestation[];
  total: number;
}

export interface GoLivePacket {
  status: 'ready' | 'attention';
  go_live_ready: boolean;
  generated_at: string;
  environment: string;
  core_status: 'ok' | 'degraded';
  operational_status: 'ok' | 'degraded';
  launch_score: number;
  blocking_count: number;
  warning_count: number;
  evidence_ready_count: number;
  evidence_total: number;
  evidence: GoLivePacketEvidence[];
  open_workplan_items: LaunchWorkplanItem[];
  latest_attestation: GoLiveAttestation | null;
}

export interface RoleDryRunChecklistItem {
  key: string;
  label: string;
  detail: string;
  route: string;
  status: 'ready' | 'attention';
}

export interface RoleDryRunChecklist {
  key: string;
  label: string;
  summary: string;
  status: 'ready' | 'attention';
  ready_count: number;
  attention_count: number;
  total: number;
  items: RoleDryRunChecklistItem[];
}

export interface RoleDryRunChecklistList {
  generated_at: string;
  roles: RoleDryRunChecklist[];
  total_roles: number;
  ready_roles: number;
  attention_roles: number;
}

export interface RoleDryRunSessionStart {
  session_name?: string | null;
  note?: string | null;
}

export interface RoleDryRunSessionUpdate {
  role_key?: string | null;
  item_key?: string | null;
  dry_run_status?: 'pending' | 'complete' | 'blocked' | null;
  item_note?: string | null;
  session_status?: 'in_progress' | 'completed' | null;
  note?: string | null;
}

export interface RoleDryRunSessionItem extends RoleDryRunChecklistItem {
  dry_run_status: 'pending' | 'complete' | 'blocked';
  note: string | null;
}

export interface RoleDryRunSessionRole extends Omit<RoleDryRunChecklist, 'items'> {
  items: RoleDryRunSessionItem[];
}

export interface RoleDryRunSession {
  id: string;
  session_id: string;
  session_name: string;
  status: 'in_progress' | 'completed';
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  checklist_generated_at: string | null;
  item_count: number;
  complete_count: number;
  blocked_count: number;
  pending_count: number;
  roles: RoleDryRunSessionRole[];
}

export interface RoleDryRunSessionList {
  data: RoleDryRunSession[];
  total: number;
}

export interface ProductionRehearsalSnapshot {
  id: string;
  created_at: string;
  status: 'ready' | 'attention';
  rehearsal_ready: boolean;
  score: number;
  blocking_count: number;
  warning_count: number;
  recommended_action_count: number;
}

export interface ProductionRehearsalSnapshotList {
  data: ProductionRehearsalSnapshot[];
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
