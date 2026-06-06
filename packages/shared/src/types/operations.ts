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

export interface OperationsTimelineItem {
  key: string;
  occurred_at: string;
  severity: 'critical' | 'warning' | 'normal';
  category: string;
  title: string;
  detail: string;
  source: string;
  route: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface OperationsIncidentTimeline {
  data: OperationsTimelineItem[];
  total: number;
  critical_count: number;
  warning_count: number;
  generated_at: string;
}

export interface OperationsAlertRule {
  key: string;
  label: string;
  status: 'triggered' | 'clear';
  severity: 'critical' | 'warning';
  count: number;
  detail: string;
  route: string;
  last_triggered_at: string | null;
}

export interface OperationsAlertRuleList {
  data: OperationsAlertRule[];
  total: number;
  triggered_count: number;
  critical_count: number;
  warning_count: number;
  generated_at: string;
}

export interface DocumentStorageReadinessCheck {
  key: string;
  label: string;
  status: 'triggered' | 'clear';
  severity: 'critical' | 'warning';
  count: number;
  detail: string;
  recommended_action: string;
  route: string;
}

export interface DocumentStorageHandoff {
  document_id: string;
  patient_id: string | null;
  occurred_at: string;
  storage_status: string;
  presigned: boolean;
  expires_at: string | null;
  expired: boolean;
}

export interface DocumentStorageReadiness {
  status: 'ready' | 'attention' | 'blocked';
  score: number;
  generated_at: string;
  summary: Record<string, number>;
  checks: DocumentStorageReadinessCheck[];
  recent_handoffs: DocumentStorageHandoff[];
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

export interface BrowserQaChecklistItem {
  key: string;
  label: string;
  detail: string;
  route: string;
  category: string;
}

export interface BrowserQaChecklist {
  generated_at: string;
  items: BrowserQaChecklistItem[];
  total: number;
}

export interface BrowserQaSessionStart {
  session_name?: string | null;
  browser?: string | null;
  note?: string | null;
}

export interface BrowserQaSessionUpdate {
  item_key?: string | null;
  qa_status?: 'pending' | 'passed' | 'failed' | null;
  item_note?: string | null;
  session_status?: 'in_progress' | 'completed' | null;
  note?: string | null;
}

export interface BrowserQaSessionItem extends BrowserQaChecklistItem {
  qa_status: 'pending' | 'passed' | 'failed';
  note: string | null;
}

export interface BrowserQaSession {
  id: string;
  session_id: string;
  session_name: string;
  browser: string | null;
  status: 'in_progress' | 'completed';
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  item_count: number;
  passed_count: number;
  failed_count: number;
  pending_count: number;
  items: BrowserQaSessionItem[];
}

export interface BrowserQaSessionList {
  data: BrowserQaSession[];
  total: number;
}

export interface StaffTrainingChecklistItem {
  key: string;
  label: string;
  detail: string;
  route: string;
  category: string;
}

export interface StaffTrainingChecklistRole {
  key: string;
  label: string;
  summary: string;
  items: StaffTrainingChecklistItem[];
}

export interface StaffTrainingChecklist {
  generated_at: string;
  roles: StaffTrainingChecklistRole[];
  total_roles: number;
  total_items: number;
}

export interface StaffTrainingSessionStart {
  session_name?: string | null;
  trainer_name?: string | null;
  note?: string | null;
}

export interface StaffTrainingSessionUpdate {
  role_key?: string | null;
  item_key?: string | null;
  training_status?: 'pending' | 'reviewed' | 'signed' | null;
  item_note?: string | null;
  session_status?: 'in_progress' | 'completed' | null;
  note?: string | null;
}

export interface StaffTrainingSessionItem extends StaffTrainingChecklistItem {
  training_status: 'pending' | 'reviewed' | 'signed';
  note: string | null;
}

export interface StaffTrainingSessionRole extends Omit<StaffTrainingChecklistRole, 'items'> {
  items: StaffTrainingSessionItem[];
}

export interface StaffTrainingSession {
  id: string;
  session_id: string;
  session_name: string;
  trainer_name: string | null;
  status: 'in_progress' | 'completed';
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  item_count: number;
  signed_count: number;
  reviewed_count: number;
  pending_count: number;
  roles: StaffTrainingSessionRole[];
}

export interface StaffTrainingSessionList {
  data: StaffTrainingSession[];
  total: number;
}

export interface PolicyApprovalChecklistItem {
  key: string;
  label: string;
  detail: string;
  route: string;
  category: string;
  docs: string[];
}

export interface PolicyApprovalChecklist {
  generated_at: string;
  items: PolicyApprovalChecklistItem[];
  total: number;
}

export interface PolicyApprovalSessionStart {
  session_name?: string | null;
  reviewer_name?: string | null;
  note?: string | null;
}

export interface PolicyApprovalSessionUpdate {
  item_key?: string | null;
  approval_status?: 'pending' | 'approved' | 'needs_changes' | null;
  item_note?: string | null;
  session_status?: 'in_progress' | 'completed' | null;
  note?: string | null;
}

export interface PolicyApprovalSessionItem extends PolicyApprovalChecklistItem {
  approval_status: 'pending' | 'approved' | 'needs_changes';
  note: string | null;
}

export interface PolicyApprovalSession {
  id: string;
  session_id: string;
  session_name: string;
  reviewer_name: string | null;
  status: 'in_progress' | 'completed';
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  item_count: number;
  approved_count: number;
  needs_changes_count: number;
  pending_count: number;
  items: PolicyApprovalSessionItem[];
}

export interface PolicyApprovalSessionList {
  data: PolicyApprovalSession[];
  total: number;
}

export interface RestoreDrillChecklistItem {
  key: string;
  label: string;
  detail: string;
  route: string;
  category: string;
}

export interface RestoreDrillChecklist {
  generated_at: string;
  items: RestoreDrillChecklistItem[];
  total: number;
}

export interface RestoreDrillSessionStart {
  session_name?: string | null;
  owner_name?: string | null;
  backup_reference?: string | null;
  note?: string | null;
}

export interface RestoreDrillSessionUpdate {
  item_key?: string | null;
  drill_status?: 'pending' | 'complete' | 'blocked' | null;
  item_note?: string | null;
  rto_minutes?: number | null;
  rpo_minutes?: number | null;
  session_status?: 'in_progress' | 'completed' | null;
  note?: string | null;
}

export interface RestoreDrillSessionItem extends RestoreDrillChecklistItem {
  drill_status: 'pending' | 'complete' | 'blocked';
  note: string | null;
}

export interface RestoreDrillSession {
  id: string;
  session_id: string;
  session_name: string;
  owner_name: string | null;
  backup_reference: string | null;
  status: 'in_progress' | 'completed';
  rto_minutes: number | null;
  rpo_minutes: number | null;
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  item_count: number;
  complete_count: number;
  blocked_count: number;
  pending_count: number;
  items: RestoreDrillSessionItem[];
}

export interface RestoreDrillSessionList {
  data: RestoreDrillSession[];
  total: number;
}

export interface CutoverRunbookStep {
  key: string;
  label: string;
  detail: string;
  owner_role: string;
  expected_minute: number;
  rollback_trigger: string | null;
}

export interface CutoverRunbookPhase {
  key: string;
  label: string;
  objective: string;
  steps: CutoverRunbookStep[];
}

export interface CutoverRunbook {
  generated_at: string;
  phases: CutoverRunbookPhase[];
  total_phases: number;
  total_steps: number;
}

export interface CutoverRunbookSessionStart {
  session_name?: string | null;
  cutover_owner?: string | null;
  scheduled_for?: string | null;
  note?: string | null;
}

export interface CutoverRunbookSessionUpdate {
  phase_key?: string | null;
  step_key?: string | null;
  step_status?: 'pending' | 'complete' | 'blocked' | 'rollback' | null;
  owner_name?: string | null;
  step_note?: string | null;
  rollback_status?: 'not_reviewed' | 'rollback_ready' | 'rollback_required' | 'not_needed' | null;
  rollback_decision?: string | null;
  session_status?: 'in_progress' | 'completed' | 'aborted' | null;
  note?: string | null;
}

export interface CutoverRunbookSessionStep extends CutoverRunbookStep {
  step_status: 'pending' | 'complete' | 'blocked' | 'rollback';
  owner_name: string | null;
  note: string | null;
}

export interface CutoverRunbookSessionPhase extends Omit<CutoverRunbookPhase, 'steps'> {
  steps: CutoverRunbookSessionStep[];
}

export interface CutoverRunbookSession {
  id: string;
  session_id: string;
  session_name: string;
  cutover_owner: string | null;
  scheduled_for: string | null;
  status: 'in_progress' | 'completed' | 'aborted';
  rollback_status: 'not_reviewed' | 'rollback_ready' | 'rollback_required' | 'not_needed';
  rollback_decision: string | null;
  note: string | null;
  started_by: string | null;
  completed_by: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  step_count: number;
  complete_count: number;
  blocked_count: number;
  rollback_count: number;
  pending_count: number;
  phases: CutoverRunbookSessionPhase[];
}

export interface CutoverRunbookSessionList {
  data: CutoverRunbookSession[];
  total: number;
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
  unassigned_blocking_count: number;
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
  unassigned_blocking_count: number;
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

export interface LiveUseRehearsalGate {
  key: string;
  label: string;
  status: 'ready' | 'warning' | 'blocking' | 'missing';
  detail: string;
  route: string;
  captured_at: string | null;
}

export interface LiveUseRehearsalAction {
  key: string;
  label: string;
  detail: string;
  route: string;
  severity: 'warning' | 'blocking';
}

export interface LiveUseRehearsal {
  status: 'ready' | 'attention' | 'blocked';
  launch_ready: boolean;
  score: number;
  generated_at: string;
  summary: Record<string, number>;
  gates: LiveUseRehearsalGate[];
  evidence: GoLivePacketEvidence[];
  next_actions: LiveUseRehearsalAction[];
  open_workplan_items: LaunchWorkplanItem[];
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
  adapter_implemented: boolean;
  adapter_detail: string | null;
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
  adapter_implemented: boolean;
  adapter_detail: string | null;
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
