import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  CheckCircle2,
  LockKeyhole,
  PlugZap,
  Play,
  RefreshCw,
  RotateCw,
  Server,
  ShieldCheck,
  Download,
  ClipboardList,
  Camera,
} from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ROUTES, type AdapterImplementationPacket, type AnalyticsSummary, type AuditEvent, type AuditReviewSummary, type BillingWorkQueue, type BrowserQaChecklist, type BrowserQaSession, type BrowserQaSessionList, type BrowserQaSessionStart, type BrowserQaSessionUpdate, type CredentialBinderSnapshot, type CredentialBinderSnapshotList, type CredentialDryRunBinder, type CutoverRunbook, type CutoverRunbookSession, type CutoverRunbookSessionList, type CutoverRunbookSessionStart, type CutoverRunbookSessionUpdate, type DocumentStorageReadiness, type GoLiveAttestation, type GoLiveAttestationCreate, type GoLivePacket, type IntegrationCapabilities, type IntegrationCutoverReadinessItem, type IntegrationCutoverReadinessPacket, type LaunchWorkplan, type LaunchWorkplanSnapshot, type LaunchWorkplanSnapshotList, type LiveUseRehearsal, type OperatorHealth, type OperationsAlertRuleList, type OperationsIncidentList, type OperationsIncidentTimeline, type PolicyApprovalChecklist, type PolicyApprovalSession, type PolicyApprovalSessionList, type PolicyApprovalSessionStart, type PolicyApprovalSessionUpdate, type ProductionConfigAudit, type ProductionRehearsalReport, type ProductionRehearsalSnapshot, type ProductionRehearsalSnapshotList, type ReadinessSnapshot, type ReadinessSnapshotList, type RehearsalAction, type RehearsalActionAssignmentUpdate, type RestoreDrillChecklist, type RestoreDrillSession, type RestoreDrillSessionList, type RestoreDrillSessionStart, type RestoreDrillSessionUpdate, type RoleDryRunChecklistList, type RoleDryRunSession, type RoleDryRunSessionList, type RoleDryRunSessionStart, type RoleDryRunSessionUpdate, type SessionPolicy, type StaffTrainingChecklist, type StaffTrainingSession, type StaffTrainingSessionList, type StaffTrainingSessionStart, type StaffTrainingSessionUpdate, type TaskOutreachSummary, type VendorCredentialRequestPacket } from '@concierge-os/shared';

export const Route = createFileRoute('/operations/')({
  component: OperationsPage,
});

interface ReadyCheck {
  ok: boolean;
  configured?: boolean;
  env_var?: string;
  mode?: string;
  error?: string;
  bucket?: string;
}

interface ReadyResponse {
  status: 'ok' | 'degraded';
  operational_status: 'ok' | 'degraded';
  environment: string;
  checks: Record<string, ReadyCheck>;
  integrations: Record<string, ReadyCheck>;
  deployment?: Record<string, ReadyCheck & { path?: string }>;
}

interface IntegrationEvent {
  id: string;
  integration: string;
  direction: string;
  action: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  attempts: number;
  error: string | null;
  created_at: string;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

type AssignmentFormState = {
  owner_name: string;
  status: RehearsalActionAssignmentUpdate['status'];
  due_date: string;
  note: string;
};

type DryRunItemFormState = {
  dry_run_status: NonNullable<RoleDryRunSessionUpdate['dry_run_status']>;
  item_note: string;
};

type BrowserQaItemFormState = {
  qa_status: NonNullable<BrowserQaSessionUpdate['qa_status']>;
  item_note: string;
};

type StaffTrainingItemFormState = {
  training_status: NonNullable<StaffTrainingSessionUpdate['training_status']>;
  item_note: string;
};

type PolicyApprovalItemFormState = {
  approval_status: NonNullable<PolicyApprovalSessionUpdate['approval_status']>;
  item_note: string;
};

type RestoreDrillItemFormState = {
  drill_status: NonNullable<RestoreDrillSessionUpdate['drill_status']>;
  item_note: string;
};

type CutoverStepFormState = {
  step_status: NonNullable<CutoverRunbookSessionUpdate['step_status']>;
  owner_name: string;
  step_note: string;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
      ok
        ? 'border-accent-soft bg-accent-soft text-accent'
        : 'border-warn/20 bg-warn/10 text-warn'
    }`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function OperationsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [auditExport, setAuditExport] = useState({ event_type: '', entity_type: '', entity_id: '', limit: '10000' });
  const [assignmentForms, setAssignmentForms] = useState<Record<string, AssignmentFormState>>({});
  const [cutoverAssignmentForms, setCutoverAssignmentForms] = useState<Record<string, AssignmentFormState>>({});
  const [dryRunSessionForm, setDryRunSessionForm] = useState<RoleDryRunSessionStart>({ session_name: 'Clinic dry run', note: '' });
  const [dryRunItemForms, setDryRunItemForms] = useState<Record<string, DryRunItemFormState>>({});
  const [browserQaSessionForm, setBrowserQaSessionForm] = useState<BrowserQaSessionStart>({ session_name: 'Browser QA run', browser: 'Chrome', note: '' });
  const [browserQaItemForms, setBrowserQaItemForms] = useState<Record<string, BrowserQaItemFormState>>({});
  const [staffTrainingSessionForm, setStaffTrainingSessionForm] = useState<StaffTrainingSessionStart>({ session_name: 'Staff training', trainer_name: '', note: '' });
  const [staffTrainingItemForms, setStaffTrainingItemForms] = useState<Record<string, StaffTrainingItemFormState>>({});
  const [policyApprovalSessionForm, setPolicyApprovalSessionForm] = useState<PolicyApprovalSessionStart>({ session_name: 'Policy approval', reviewer_name: '', note: '' });
  const [policyApprovalItemForms, setPolicyApprovalItemForms] = useState<Record<string, PolicyApprovalItemFormState>>({});
  const [restoreDrillSessionForm, setRestoreDrillSessionForm] = useState<RestoreDrillSessionStart>({ session_name: 'Restore drill', owner_name: '', backup_reference: '', note: '' });
  const [restoreDrillItemForms, setRestoreDrillItemForms] = useState<Record<string, RestoreDrillItemFormState>>({});
  const [restoreDrillMetricsForm, setRestoreDrillMetricsForm] = useState({ rto_minutes: '', rpo_minutes: '', note: '' });
  const [cutoverSessionForm, setCutoverSessionForm] = useState<CutoverRunbookSessionStart>({ session_name: 'Production cutover rehearsal', cutover_owner: '', scheduled_for: '', note: '' });
  const [cutoverStepForms, setCutoverStepForms] = useState<Record<string, CutoverStepFormState>>({});
  const [cutoverRollbackForm, setCutoverRollbackForm] = useState({
    rollback_status: 'not_reviewed' as NonNullable<CutoverRunbookSessionUpdate['rollback_status']>,
    rollback_decision: '',
  });
  const [attestationForm, setAttestationForm] = useState<{ decision: GoLiveAttestationCreate['decision']; note: string }>({ decision: 'needs_changes', note: '' });
  const { data: ready } = useQuery({
    queryKey: QUERY_KEYS.READINESS,
    queryFn: () => api.get<ReadyResponse>('/ready'),
  });
  const { data: events } = useQuery({
    queryKey: QUERY_KEYS.INTEGRATION_EVENTS,
    queryFn: () => api.get<ListResponse<IntegrationEvent>>('/integrations/events?page=1&page_size=12'),
  });
  const { data: auditEvents } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'phi-access'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=8&event_type=patient_document.accessed'),
  });
  const { data: assistantEvents } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'assistant-actions'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=8&event_type=assistant.task_created'),
  });
  const { data: auditReviewSummary } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'review-summary'],
    queryFn: () => api.get<AuditReviewSummary>(ROUTES.AUDIT_REVIEW_SUMMARY),
  });
  const { data: analytics } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'analytics-summary'],
    queryFn: () => api.get<AnalyticsSummary>(ROUTES.ANALYTICS_SUMMARY),
  });
  const { data: capabilities } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'integration-capabilities'],
    queryFn: () => api.get<IntegrationCapabilities>(ROUTES.INTEGRATION_CAPABILITIES),
  });
  const { data: sessionPolicy } = useQuery({
    queryKey: [...QUERY_KEYS.USER, 'session-policy'],
    queryFn: () => api.get<SessionPolicy>(ROUTES.SESSION_POLICY),
  });
  const { data: outreachSummary } = useQuery({
    queryKey: QUERY_KEYS.TASK_OUTREACH_SUMMARY,
    queryFn: () => api.get<TaskOutreachSummary>(ROUTES.TASK_PATIENT_OUTREACH_SUMMARY),
  });
  const { data: billingWorkQueue } = useQuery({
    queryKey: QUERY_KEYS.BILLING_WORK_QUEUE,
    queryFn: () => api.get<BillingWorkQueue>(ROUTES.BILLING_WORK_QUEUE),
  });
  const { data: incidents } = useQuery({
    queryKey: QUERY_KEYS.OPERATIONS_INCIDENTS,
    queryFn: () => api.get<OperationsIncidentList>(ROUTES.OPERATIONS_INCIDENTS),
  });
  const { data: incidentTimeline } = useQuery({
    queryKey: [...QUERY_KEYS.OPERATIONS_INCIDENTS, 'timeline'],
    queryFn: () => api.get<OperationsIncidentTimeline>(ROUTES.OPERATIONS_INCIDENT_TIMELINE),
  });
  const { data: alertRules } = useQuery({
    queryKey: [...QUERY_KEYS.OPERATIONS_INCIDENTS, 'alert-rules'],
    queryFn: () => api.get<OperationsAlertRuleList>(ROUTES.OPERATIONS_ALERT_RULES),
  });
  const { data: documentStorageReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'document-storage-readiness'],
    queryFn: () => api.get<DocumentStorageReadiness>(ROUTES.OPERATIONS_DOCUMENT_STORAGE_READINESS),
  });
  const { data: operatorHealth } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'operator-health'],
    queryFn: () => api.get<OperatorHealth>(ROUTES.OPERATIONS_OPERATOR_HEALTH),
  });
  const { data: productionConfigAudit } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'production-config-audit'],
    queryFn: () => api.get<ProductionConfigAudit>(ROUTES.OPERATIONS_PRODUCTION_CONFIG_AUDIT),
  });
  const { data: browserQaChecklist } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'browser-qa-checklist'],
    queryFn: () => api.get<BrowserQaChecklist>(ROUTES.OPERATIONS_BROWSER_QA_CHECKLIST),
  });
  const { data: browserQaSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'browser-qa-sessions'],
    queryFn: () => api.get<BrowserQaSessionList>(ROUTES.OPERATIONS_BROWSER_QA_SESSIONS),
  });
  const { data: staffTrainingChecklist } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'staff-training-checklist'],
    queryFn: () => api.get<StaffTrainingChecklist>(ROUTES.OPERATIONS_STAFF_TRAINING_CHECKLIST),
  });
  const { data: staffTrainingSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'staff-training-sessions'],
    queryFn: () => api.get<StaffTrainingSessionList>(ROUTES.OPERATIONS_STAFF_TRAINING_SESSIONS),
  });
  const { data: policyApprovalChecklist } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'policy-approval-checklist'],
    queryFn: () => api.get<PolicyApprovalChecklist>(ROUTES.OPERATIONS_POLICY_APPROVAL_CHECKLIST),
  });
  const { data: policyApprovalSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'policy-approval-sessions'],
    queryFn: () => api.get<PolicyApprovalSessionList>(ROUTES.OPERATIONS_POLICY_APPROVAL_SESSIONS),
  });
  const { data: restoreDrillChecklist } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'restore-drill-checklist'],
    queryFn: () => api.get<RestoreDrillChecklist>(ROUTES.OPERATIONS_RESTORE_DRILL_CHECKLIST),
  });
  const { data: restoreDrillSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'restore-drill-sessions'],
    queryFn: () => api.get<RestoreDrillSessionList>(ROUTES.OPERATIONS_RESTORE_DRILL_SESSIONS),
  });
  const { data: cutoverRunbook } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'cutover-runbook'],
    queryFn: () => api.get<CutoverRunbook>(ROUTES.OPERATIONS_CUTOVER_RUNBOOK),
  });
  const { data: cutoverSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'cutover-runbook-sessions'],
    queryFn: () => api.get<CutoverRunbookSessionList>(ROUTES.OPERATIONS_CUTOVER_RUNBOOK_SESSIONS),
  });
  const { data: goLivePacket } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'],
    queryFn: () => api.get<GoLivePacket>(ROUTES.OPERATIONS_GO_LIVE_PACKET),
  });
  const { data: credentialBinder } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'credential-dry-run-binder'],
    queryFn: () => api.get<CredentialDryRunBinder>(ROUTES.OPERATIONS_CREDENTIAL_DRY_RUN_BINDER),
  });
  const { data: vendorCredentialPacket } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'vendor-credential-request-packet'],
    queryFn: () => api.get<VendorCredentialRequestPacket>(ROUTES.OPERATIONS_VENDOR_CREDENTIAL_REQUEST_PACKET),
  });
  const { data: adapterPacket } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'adapter-implementation-packet'],
    queryFn: () => api.get<AdapterImplementationPacket>(ROUTES.OPERATIONS_ADAPTER_IMPLEMENTATION_PACKET),
  });
  const { data: cutoverReadinessPacket } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'integration-cutover-readiness-packet'],
    queryFn: () => api.get<IntegrationCutoverReadinessPacket>(ROUTES.OPERATIONS_INTEGRATION_CUTOVER_READINESS_PACKET),
  });
  const { data: credentialBinderSnapshots } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'credential-dry-run-binder'],
    queryFn: () => api.get<CredentialBinderSnapshotList>(ROUTES.OPERATIONS_CREDENTIAL_DRY_RUN_BINDER_SNAPSHOTS),
  });
  const { data: liveUseRehearsal } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'live-use-rehearsal'],
    queryFn: () => api.get<LiveUseRehearsal>(ROUTES.OPERATIONS_LIVE_USE_REHEARSAL),
  });
  const { data: roleChecklists } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'role-dry-run-checklists'],
    queryFn: () => api.get<RoleDryRunChecklistList>(ROUTES.OPERATIONS_ROLE_DRY_RUN_CHECKLISTS),
  });
  const { data: dryRunSessions } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'role-dry-run-sessions'],
    queryFn: () => api.get<RoleDryRunSessionList>(ROUTES.OPERATIONS_ROLE_DRY_RUN_SESSIONS),
  });
  const { data: workplan } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'launch-workplan'],
    queryFn: () => api.get<LaunchWorkplan>(ROUTES.OPERATIONS_LAUNCH_WORKPLAN),
  });
  const { data: workplanSnapshots } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'launch-workplan'],
    queryFn: () => api.get<LaunchWorkplanSnapshotList>(ROUTES.OPERATIONS_LAUNCH_WORKPLAN_SNAPSHOTS),
  });
  const { data: snapshots } = useQuery({
    queryKey: QUERY_KEYS.READINESS_SNAPSHOTS,
    queryFn: () => api.get<ReadinessSnapshotList>(ROUTES.OPERATIONS_READINESS_SNAPSHOTS),
  });
  const { data: rehearsal } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'production-rehearsal'],
    queryFn: () => api.get<ProductionRehearsalReport>(ROUTES.OPERATIONS_PRODUCTION_REHEARSAL),
  });
  const { data: rehearsalSnapshots } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'production-rehearsal'],
    queryFn: () => api.get<ProductionRehearsalSnapshotList>(ROUTES.OPERATIONS_PRODUCTION_REHEARSAL_SNAPSHOTS),
  });
  const retryMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/integrations/events/${eventId}/retry`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
    },
  });
  const snapshotMutation = useMutation({
    mutationFn: () => api.post<ReadinessSnapshot>(ROUTES.OPERATIONS_READINESS_SNAPSHOTS, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS_SNAPSHOTS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.OPERATIONS_INCIDENTS });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const rehearsalSnapshotMutation = useMutation({
    mutationFn: () => api.post<ProductionRehearsalSnapshot>(ROUTES.OPERATIONS_PRODUCTION_REHEARSAL_SNAPSHOTS, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'production-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const workplanSnapshotMutation = useMutation({
    mutationFn: () => api.post<LaunchWorkplanSnapshot>(ROUTES.OPERATIONS_LAUNCH_WORKPLAN_SNAPSHOTS, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'launch-workplan'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const credentialBinderSnapshotMutation = useMutation({
    mutationFn: () => api.post<CredentialBinderSnapshot>(ROUTES.OPERATIONS_CREDENTIAL_DRY_RUN_BINDER_SNAPSHOTS, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS_SNAPSHOTS, 'credential-dry-run-binder'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const assignmentMutation = useMutation({
    mutationFn: ({ actionKey, data }: { actionKey: string; data: RehearsalActionAssignmentUpdate }) => api.post(
      ROUTES.OPERATIONS_REHEARSAL_ACTION_ASSIGNMENT(actionKey),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'production-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'launch-workplan'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const cutoverAssignmentMutation = useMutation({
    mutationFn: ({ integration, data }: { integration: string; data: RehearsalActionAssignmentUpdate }) => api.post(
      ROUTES.OPERATIONS_INTEGRATION_CUTOVER_ASSIGNMENT(integration),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'integration-cutover-readiness-packet'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'launch-workplan'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const attestationMutation = useMutation({
    mutationFn: (data: GoLiveAttestationCreate) => api.post<GoLiveAttestation>(ROUTES.OPERATIONS_GO_LIVE_ATTESTATIONS, data),
    onSuccess: async () => {
      setAttestationForm({ decision: 'needs_changes', note: '' });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startDryRunSessionMutation = useMutation({
    mutationFn: (data: RoleDryRunSessionStart) => api.post<RoleDryRunSession>(ROUTES.OPERATIONS_ROLE_DRY_RUN_SESSIONS, data),
    onSuccess: async () => {
      setDryRunSessionForm({ session_name: 'Clinic dry run', note: '' });
      setDryRunItemForms({});
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'role-dry-run-sessions'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updateDryRunSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: RoleDryRunSessionUpdate }) => api.patch<RoleDryRunSession>(
      ROUTES.OPERATIONS_ROLE_DRY_RUN_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'role-dry-run-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startBrowserQaSessionMutation = useMutation({
    mutationFn: (data: BrowserQaSessionStart) => api.post<BrowserQaSession>(ROUTES.OPERATIONS_BROWSER_QA_SESSIONS, data),
    onSuccess: async () => {
      setBrowserQaSessionForm({ session_name: 'Browser QA run', browser: 'Chrome', note: '' });
      setBrowserQaItemForms({});
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'browser-qa-sessions'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updateBrowserQaSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: BrowserQaSessionUpdate }) => api.patch<BrowserQaSession>(
      ROUTES.OPERATIONS_BROWSER_QA_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'browser-qa-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startStaffTrainingSessionMutation = useMutation({
    mutationFn: (data: StaffTrainingSessionStart) => api.post<StaffTrainingSession>(ROUTES.OPERATIONS_STAFF_TRAINING_SESSIONS, data),
    onSuccess: async () => {
      setStaffTrainingSessionForm({ session_name: 'Staff training', trainer_name: '', note: '' });
      setStaffTrainingItemForms({});
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'staff-training-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updateStaffTrainingSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: StaffTrainingSessionUpdate }) => api.patch<StaffTrainingSession>(
      ROUTES.OPERATIONS_STAFF_TRAINING_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'staff-training-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startPolicyApprovalSessionMutation = useMutation({
    mutationFn: (data: PolicyApprovalSessionStart) => api.post<PolicyApprovalSession>(ROUTES.OPERATIONS_POLICY_APPROVAL_SESSIONS, data),
    onSuccess: async () => {
      setPolicyApprovalSessionForm({ session_name: 'Policy approval', reviewer_name: '', note: '' });
      setPolicyApprovalItemForms({});
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'policy-approval-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updatePolicyApprovalSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: PolicyApprovalSessionUpdate }) => api.patch<PolicyApprovalSession>(
      ROUTES.OPERATIONS_POLICY_APPROVAL_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'policy-approval-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startRestoreDrillSessionMutation = useMutation({
    mutationFn: (data: RestoreDrillSessionStart) => api.post<RestoreDrillSession>(ROUTES.OPERATIONS_RESTORE_DRILL_SESSIONS, data),
    onSuccess: async () => {
      setRestoreDrillSessionForm({ session_name: 'Restore drill', owner_name: '', backup_reference: '', note: '' });
      setRestoreDrillItemForms({});
      setRestoreDrillMetricsForm({ rto_minutes: '', rpo_minutes: '', note: '' });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'restore-drill-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'live-use-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updateRestoreDrillSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: RestoreDrillSessionUpdate }) => api.patch<RestoreDrillSession>(
      ROUTES.OPERATIONS_RESTORE_DRILL_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'restore-drill-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'live-use-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const startCutoverSessionMutation = useMutation({
    mutationFn: (data: CutoverRunbookSessionStart) => api.post<CutoverRunbookSession>(ROUTES.OPERATIONS_CUTOVER_RUNBOOK_SESSIONS, data),
    onSuccess: async () => {
      setCutoverSessionForm({ session_name: 'Production cutover rehearsal', cutover_owner: '', scheduled_for: '', note: '' });
      setCutoverStepForms({});
      setCutoverRollbackForm({ rollback_status: 'not_reviewed', rollback_decision: '' });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'cutover-runbook-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'live-use-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const updateCutoverSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: CutoverRunbookSessionUpdate }) => api.patch<CutoverRunbookSession>(
      ROUTES.OPERATIONS_CUTOVER_RUNBOOK_SESSION(sessionId),
      data,
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'cutover-runbook-sessions'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'] });
      await queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.READINESS, 'live-use-rehearsal'] });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });

  const coreChecks = ready ? Object.entries(ready.checks) : [];
  const integrations = ready ? Object.entries(ready.integrations) : [];
  const deployment = ready?.deployment ? Object.entries(ready.deployment) : [];
  const failedEvents = events?.data.filter((event) => event.status === 'failed') ?? [];
  const activeDryRunSession = dryRunSessions?.data[0] ?? null;
  const activeBrowserQaSession = browserQaSessions?.data[0] ?? null;
  const activeStaffTrainingSession = staffTrainingSessions?.data[0] ?? null;
  const activePolicyApprovalSession = policyApprovalSessions?.data[0] ?? null;
  const activeRestoreDrillSession = restoreDrillSessions?.data[0] ?? null;
  const activeCutoverSession = cutoverSessions?.data[0] ?? null;
  const auditExportHref = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(auditExport).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return `/api/audit/export?${params.toString()}`;
  }, [auditExport]);
  const rehearsalExportHref = useMemo(() => {
    if (!rehearsal) return ROUTES.OPERATIONS_PRODUCTION_REHEARSAL_EXPORT;
    const rows = [['section', 'key', 'label', 'status', 'score', 'detail', 'route', 'severity', 'owner', 'assignment_status', 'due_date', 'note']];
    rehearsal.gates.forEach((gate) => rows.push(['gate', gate.key, gate.label, gate.status, String(gate.score), gate.detail, gate.route, '', '', '', '', '']));
    rehearsal.recommended_actions.forEach((action) => rows.push([
      'action',
      action.key,
      action.label,
      '',
      '',
      action.detail,
      action.route,
      action.severity,
      action.assignment?.owner_name ?? '',
      action.assignment?.status ?? '',
      action.assignment?.due_date ?? '',
      action.assignment?.note ?? '',
    ]));
    return `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map((row) => row.map(csvCell).join(',')).join('\n'))}`;
  }, [rehearsal]);
  const workplanExportHref = useMemo(() => {
    if (!workplan) return ROUTES.OPERATIONS_LAUNCH_WORKPLAN_EXPORT;
    const rows = [['key', 'source', 'category', 'label', 'severity', 'detail', 'route', 'owner_role', 'recommended_action', 'owner', 'assignment_status', 'due_date', 'note']];
    workplan.items.forEach((item) => rows.push([
      item.key,
      item.source,
      item.category,
      item.label,
      item.severity,
      item.detail,
      item.route,
      item.owner_role,
      item.recommended_action,
      item.assignment?.owner_name ?? '',
      item.assignment?.status ?? '',
      item.assignment?.due_date ?? '',
      item.assignment?.note ?? '',
    ]));
    return `data:text/csv;charset=utf-8,${encodeURIComponent(rows.map((row) => row.map(csvCell).join(',')).join('\n'))}`;
  }, [workplan]);
  const formForAction = (action: RehearsalAction): AssignmentFormState => assignmentForms[action.key] ?? {
    owner_name: action.assignment?.owner_name ?? '',
    status: action.assignment?.status ?? 'open',
    due_date: action.assignment?.due_date ?? '',
    note: action.assignment?.note ?? '',
  };
  const updateAssignmentForm = (actionKey: string, patch: Partial<AssignmentFormState>) => {
    setAssignmentForms((current) => ({
      ...current,
      [actionKey]: { ...(current[actionKey] ?? { owner_name: '', status: 'open', due_date: '', note: '' }), ...patch },
    }));
  };
  const submitAssignment = (action: RehearsalAction) => {
    const form = formForAction(action);
    if (!form.owner_name.trim()) return;
    assignmentMutation.mutate({
      actionKey: action.key,
      data: {
        owner_name: form.owner_name.trim(),
        status: form.status,
        due_date: form.due_date || null,
        note: form.note.trim() || null,
      },
    });
  };
  const formForCutoverLane = (lane: IntegrationCutoverReadinessItem): AssignmentFormState => cutoverAssignmentForms[lane.integration] ?? {
    owner_name: lane.assignment?.owner_name ?? '',
    status: lane.assignment?.status ?? 'open',
    due_date: lane.assignment?.due_date ?? '',
    note: lane.assignment?.note ?? '',
  };
  const updateCutoverAssignmentForm = (integration: string, patch: Partial<AssignmentFormState>) => {
    setCutoverAssignmentForms((current) => ({
      ...current,
      [integration]: { ...(current[integration] ?? { owner_name: '', status: 'open', due_date: '', note: '' }), ...patch },
    }));
  };
  const submitCutoverAssignment = (lane: IntegrationCutoverReadinessItem) => {
    const form = formForCutoverLane(lane);
    if (!form.owner_name.trim()) return;
    cutoverAssignmentMutation.mutate({
      integration: lane.integration,
      data: {
        owner_name: form.owner_name.trim(),
        status: form.status,
        due_date: form.due_date || null,
        note: form.note.trim() || null,
      },
    });
  };
  const dryRunItemKey = (sessionId: string, roleKey: string, itemKey: string) => `${sessionId}:${roleKey}:${itemKey}`;
  const formForDryRunItem = (session: RoleDryRunSession, roleKey: string, itemKey: string): DryRunItemFormState => {
    const key = dryRunItemKey(session.session_id, roleKey, itemKey);
    const role = session.roles.find((item) => item.key === roleKey);
    const item = role?.items.find((entry) => entry.key === itemKey);
    return dryRunItemForms[key] ?? {
      dry_run_status: item?.dry_run_status ?? 'pending',
      item_note: item?.note ?? '',
    };
  };
  const updateDryRunItemForm = (sessionId: string, roleKey: string, itemKey: string, patch: Partial<DryRunItemFormState>) => {
    const key = dryRunItemKey(sessionId, roleKey, itemKey);
    setDryRunItemForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { dry_run_status: 'pending', item_note: '' }), ...patch },
    }));
  };
  const submitDryRunItem = (session: RoleDryRunSession, roleKey: string, itemKey: string) => {
    const form = formForDryRunItem(session, roleKey, itemKey);
    updateDryRunSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        role_key: roleKey,
        item_key: itemKey,
        dry_run_status: form.dry_run_status,
        item_note: form.item_note.trim() || null,
      },
    });
  };
  const browserQaItemKey = (sessionId: string, itemKey: string) => `${sessionId}:${itemKey}`;
  const formForBrowserQaItem = (session: BrowserQaSession, itemKey: string): BrowserQaItemFormState => {
    const key = browserQaItemKey(session.session_id, itemKey);
    const item = session.items.find((entry) => entry.key === itemKey);
    return browserQaItemForms[key] ?? {
      qa_status: item?.qa_status ?? 'pending',
      item_note: item?.note ?? '',
    };
  };
  const updateBrowserQaItemForm = (sessionId: string, itemKey: string, patch: Partial<BrowserQaItemFormState>) => {
    const key = browserQaItemKey(sessionId, itemKey);
    setBrowserQaItemForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { qa_status: 'pending', item_note: '' }), ...patch },
    }));
  };
  const submitBrowserQaItem = (session: BrowserQaSession, itemKey: string) => {
    const form = formForBrowserQaItem(session, itemKey);
    updateBrowserQaSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        item_key: itemKey,
        qa_status: form.qa_status,
        item_note: form.item_note.trim() || null,
      },
    });
  };
  const staffTrainingItemKey = (sessionId: string, roleKey: string, itemKey: string) => `${sessionId}:${roleKey}:${itemKey}`;
  const formForStaffTrainingItem = (session: StaffTrainingSession, roleKey: string, itemKey: string): StaffTrainingItemFormState => {
    const key = staffTrainingItemKey(session.session_id, roleKey, itemKey);
    const role = session.roles.find((item) => item.key === roleKey);
    const item = role?.items.find((entry) => entry.key === itemKey);
    return staffTrainingItemForms[key] ?? {
      training_status: item?.training_status ?? 'pending',
      item_note: item?.note ?? '',
    };
  };
  const updateStaffTrainingItemForm = (sessionId: string, roleKey: string, itemKey: string, patch: Partial<StaffTrainingItemFormState>) => {
    const key = staffTrainingItemKey(sessionId, roleKey, itemKey);
    setStaffTrainingItemForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { training_status: 'pending', item_note: '' }), ...patch },
    }));
  };
  const submitStaffTrainingItem = (session: StaffTrainingSession, roleKey: string, itemKey: string) => {
    const form = formForStaffTrainingItem(session, roleKey, itemKey);
    updateStaffTrainingSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        role_key: roleKey,
        item_key: itemKey,
        training_status: form.training_status,
        item_note: form.item_note.trim() || null,
      },
    });
  };
  const policyApprovalItemKey = (sessionId: string, itemKey: string) => `${sessionId}:${itemKey}`;
  const formForPolicyApprovalItem = (session: PolicyApprovalSession, itemKey: string): PolicyApprovalItemFormState => {
    const key = policyApprovalItemKey(session.session_id, itemKey);
    const item = session.items.find((entry) => entry.key === itemKey);
    return policyApprovalItemForms[key] ?? {
      approval_status: item?.approval_status ?? 'pending',
      item_note: item?.note ?? '',
    };
  };
  const updatePolicyApprovalItemForm = (sessionId: string, itemKey: string, patch: Partial<PolicyApprovalItemFormState>) => {
    const key = policyApprovalItemKey(sessionId, itemKey);
    setPolicyApprovalItemForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { approval_status: 'pending', item_note: '' }), ...patch },
    }));
  };
  const submitPolicyApprovalItem = (session: PolicyApprovalSession, itemKey: string) => {
    const form = formForPolicyApprovalItem(session, itemKey);
    updatePolicyApprovalSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        item_key: itemKey,
        approval_status: form.approval_status,
        item_note: form.item_note.trim() || null,
      },
    });
  };
  const restoreDrillItemKey = (sessionId: string, itemKey: string) => `${sessionId}:${itemKey}`;
  const formForRestoreDrillItem = (session: RestoreDrillSession, itemKey: string): RestoreDrillItemFormState => {
    const key = restoreDrillItemKey(session.session_id, itemKey);
    const item = session.items.find((entry) => entry.key === itemKey);
    return restoreDrillItemForms[key] ?? {
      drill_status: item?.drill_status ?? 'pending',
      item_note: item?.note ?? '',
    };
  };
  const updateRestoreDrillItemForm = (sessionId: string, itemKey: string, patch: Partial<RestoreDrillItemFormState>) => {
    const key = restoreDrillItemKey(sessionId, itemKey);
    setRestoreDrillItemForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { drill_status: 'pending', item_note: '' }), ...patch },
    }));
  };
  const submitRestoreDrillItem = (session: RestoreDrillSession, itemKey: string) => {
    const form = formForRestoreDrillItem(session, itemKey);
    updateRestoreDrillSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        item_key: itemKey,
        drill_status: form.drill_status,
        item_note: form.item_note.trim() || null,
      },
    });
  };
  const submitRestoreDrillMetrics = (session: RestoreDrillSession) => {
    updateRestoreDrillSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        rto_minutes: restoreDrillMetricsForm.rto_minutes ? Number(restoreDrillMetricsForm.rto_minutes) : session.rto_minutes,
        rpo_minutes: restoreDrillMetricsForm.rpo_minutes ? Number(restoreDrillMetricsForm.rpo_minutes) : session.rpo_minutes,
        note: restoreDrillMetricsForm.note.trim() || session.note,
      },
    });
  };
  const cutoverStepKey = (sessionId: string, phaseKey: string, stepKey: string) => `${sessionId}:${phaseKey}:${stepKey}`;
  const formForCutoverStep = (session: CutoverRunbookSession, phaseKey: string, stepKey: string): CutoverStepFormState => {
    const key = cutoverStepKey(session.session_id, phaseKey, stepKey);
    const phase = session.phases.find((item) => item.key === phaseKey);
    const step = phase?.steps.find((entry) => entry.key === stepKey);
    return cutoverStepForms[key] ?? {
      step_status: step?.step_status ?? 'pending',
      owner_name: step?.owner_name ?? '',
      step_note: step?.note ?? '',
    };
  };
  const updateCutoverStepForm = (sessionId: string, phaseKey: string, stepKey: string, patch: Partial<CutoverStepFormState>) => {
    const key = cutoverStepKey(sessionId, phaseKey, stepKey);
    setCutoverStepForms((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { step_status: 'pending', owner_name: '', step_note: '' }), ...patch },
    }));
  };
  const submitCutoverStep = (session: CutoverRunbookSession, phaseKey: string, stepKey: string) => {
    const form = formForCutoverStep(session, phaseKey, stepKey);
    updateCutoverSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        phase_key: phaseKey,
        step_key: stepKey,
        step_status: form.step_status,
        owner_name: form.owner_name.trim() || null,
        step_note: form.step_note.trim() || null,
      },
    });
  };
  const submitCutoverRollback = (session: CutoverRunbookSession) => {
    const rollbackStatus = cutoverRollbackForm.rollback_status === 'not_reviewed' && session.rollback_status !== 'not_reviewed'
      ? session.rollback_status
      : cutoverRollbackForm.rollback_status;
    updateCutoverSessionMutation.mutate({
      sessionId: session.session_id,
      data: {
        rollback_status: rollbackStatus,
        rollback_decision: cutoverRollbackForm.rollback_decision.trim() || session.rollback_decision || null,
      },
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-small text-ink-muted">System readiness</p>
          <h1 className="mt-1 font-serif text-display text-ink">Operations</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge ok={ready?.status === 'ok'} label={`Core ${ready?.status ?? 'checking'}`} />
          <StatusBadge ok={ready?.operational_status === 'ok'} label={`Operational ${ready?.operational_status ?? 'checking'}`} />
        </div>
      </header>

      {liveUseRehearsal && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Live-Use Rehearsal Board
              </h2>
              <p className="text-xs text-ink-muted">{new Date(liveUseRehearsal.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${liveUseRehearsal.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : liveUseRehearsal.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                {liveUseRehearsal.status}
              </span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{liveUseRehearsal.score}%</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{liveUseRehearsal.summary.blocking_gates ?? 0} blockers</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{liveUseRehearsal.summary.warning_gates ?? 0} warnings</span>
              <a
                href={ROUTES.OPERATIONS_LIVE_USE_REHEARSAL_EXPORT}
                download="concierge-os-live-use-rehearsal.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="space-y-3">
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  ['Evidence ready', `${liveUseRehearsal.summary.evidence_ready_count ?? 0}/${liveUseRehearsal.summary.evidence_total ?? 0}`],
                  ['Workplan blockers', String(liveUseRehearsal.summary.workplan_blockers ?? 0)],
                  ['Credential blockers', String(liveUseRehearsal.summary.credential_blockers ?? 0)],
                  ['Unassigned work', String(liveUseRehearsal.summary.workplan_unassigned ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-canvas p-3">
                    <div className="text-meta text-ink-muted">{label}</div>
                    <div className="font-serif text-2xl font-medium text-ink">{value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {liveUseRehearsal.gates.map((gate) => (
                  <Link key={gate.key} to={gate.route} className="rounded-md border border-border p-3 hover:bg-canvas-sunk">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">{gate.label}</div>
                        <div className="mt-1 text-xs text-ink-muted">{gate.detail}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${gate.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : gate.status === 'blocking' || gate.status === 'missing' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                        {gate.status}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-ink-faint">{gate.captured_at ? new Date(gate.captured_at).toLocaleString() : 'No capture timestamp'}</div>
                  </Link>
                ))}
              </div>
            </div>
            <aside className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Next actions</div>
              <div className="divide-y divide-border">
                {liveUseRehearsal.next_actions.slice(0, 6).map((action) => (
                  <Link key={action.key} to={action.route} className="block px-3 py-2 hover:bg-canvas-sunk/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{action.label}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${action.severity === 'blocking' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>{action.severity}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{action.detail}</div>
                  </Link>
                ))}
                {liveUseRehearsal.next_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-ink-faint">No rehearsal actions.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {credentialBinder && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ClipboardList className="h-4 w-4 text-accent" />
                Credential Dry-Run Binder
              </h2>
              <p className="text-xs text-ink-muted">{new Date(credentialBinder.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${credentialBinder.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : credentialBinder.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                {credentialBinder.status}
              </span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{credentialBinder.blocking_count} blocking</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{credentialBinder.warning_count} warning</span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{credentialBinder.archive_ready_count}/{credentialBinder.total} archives</span>
              <button
                type="button"
                onClick={() => credentialBinderSnapshotMutation.mutate()}
                disabled={credentialBinderSnapshotMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-1.5 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Save
              </button>
              <a
                href={ROUTES.OPERATIONS_CREDENTIAL_DRY_RUN_BINDER_EXPORT}
                download={credentialBinder.export_filename}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {credentialBinder.items.map((item) => (
              <Link key={item.integration} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-muted">{item.vendor_profile.vendor_name || 'Vendor pending'} · {item.vendor_profile.owner_name || 'Owner pending'}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.binder_status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : item.binder_status === 'blocking' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {item.binder_status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                    <div className="font-semibold text-ink-secondary">{item.status}</div>
                    <div className="text-ink-faint">preflight</div>
                  </div>
                  <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                    <div className="font-semibold text-ink-secondary">{item.handoff_archive.status}</div>
                    <div className="text-ink-faint">archive</div>
                  </div>
                  <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                    <div className="font-semibold text-ink-secondary">{item.sandbox_reference_count}/{item.sandbox_reference_total}</div>
                    <div className="text-ink-faint">refs</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-ink-muted">{item.blockers[0] || item.handoff_archive.detail}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-md border border-border bg-canvas-raised px-1.5 py-0.5 text-[11px] text-ink-muted">{item.readiness_mode}</span>
                  <span className="rounded-md border border-border bg-canvas-raised px-1.5 py-0.5 text-[11px] text-ink-muted">{item.production_ready ? 'production ready' : item.sandbox_ready ? 'sandbox ready' : 'pending'}</span>
                </div>
              </Link>
            ))}
            {(credentialBinderSnapshots?.data ?? []).slice(0, 3).map((snapshot) => (
              <div key={snapshot.id} className="rounded-md border border-border bg-canvas-raised p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-ink">Saved binder snapshot</div>
                    <div className="mt-1 text-xs text-ink-muted">{new Date(snapshot.created_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${snapshot.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : snapshot.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {snapshot.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-muted">{snapshot.blocking_count} blocking, {snapshot.warning_count} warning, {snapshot.archive_ready_count}/{snapshot.total} archives ready</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {adapterPacket && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <PlugZap className="h-4 w-4 text-accent" />
                Adapter Implementation Packet
              </h2>
              <p className="text-xs text-ink-muted">{new Date(adapterPacket.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${adapterPacket.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : adapterPacket.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                {adapterPacket.status}
              </span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{adapterPacket.critical_count} critical</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{adapterPacket.high_count} high</span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{adapterPacket.implemented_count}/{adapterPacket.total} implemented</span>
              <a
                href={ROUTES.OPERATIONS_ADAPTER_IMPLEMENTATION_PACKET_EXPORT}
                download={adapterPacket.export_filename}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {adapterPacket.items.map((item) => (
              <Link key={item.integration} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-muted">{item.adapter_method_ready_count}/{item.adapter_method_total} methods · {item.workflows.length} workflows</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.priority === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : item.priority === 'high' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-border bg-canvas-raised text-ink-secondary'}`}>
                      {item.priority}
                    </span>
                    <span className="rounded-md border border-border bg-canvas-raised px-2 py-0.5 text-[11px] text-ink-muted">{item.implementation_status}</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {item.implementation_phases.slice(0, 3).map((phase) => (
                    <div key={phase.key} className="flex items-start justify-between gap-2 rounded-md border border-border bg-canvas-raised px-2 py-1.5 text-xs">
                      <div>
                        <div className="font-medium text-ink">{phase.label}</div>
                        <div className="mt-0.5 text-ink-muted">{phase.detail}</div>
                      </div>
                      <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${phase.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : phase.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                        {phase.status}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-ink-muted">{item.blockers[0] || item.docs[0] || 'Adapter implementation tracked.'}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {cutoverReadinessPacket && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-accent" />
                Integration Cutover Readiness Packet
              </h2>
              <p className="text-xs text-ink-muted">{new Date(cutoverReadinessPacket.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${cutoverReadinessPacket.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : cutoverReadinessPacket.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                {cutoverReadinessPacket.status}
              </span>
              <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{cutoverReadinessPacket.go_count} go</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{cutoverReadinessPacket.hold_count} hold</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{cutoverReadinessPacket.no_go_count} no-go</span>
              <a
                href={ROUTES.OPERATIONS_INTEGRATION_CUTOVER_READINESS_PACKET_EXPORT}
                download={cutoverReadinessPacket.export_filename}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {cutoverReadinessPacket.items.map((item) => {
              const form = formForCutoverLane(item);
              return (
              <div key={item.integration} className="rounded-md border border-border bg-canvas p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-ink">{item.label}</div>
                    <div className="mt-1 text-xs text-ink-muted">{item.readiness_mode} · {item.adapter.implementation_status} adapter · {item.credential_request.request_status} credential request</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.go_no_go === 'go' ? 'border-accent-soft bg-accent-soft text-accent' : item.go_no_go === 'no_go' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                      {item.go_no_go}
                    </span>
                    <span className="rounded-md border border-border bg-canvas-raised px-2 py-0.5 text-[11px] text-ink-muted">{item.cutover_status}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {item.gates.slice(0, 4).map((gate) => (
                    <div key={gate.key} className="rounded-md border border-border bg-canvas-raised px-2 py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-ink">{gate.label}</span>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${gate.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : gate.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                          {gate.status}
                        </span>
                      </div>
                      <div className="mt-1 text-ink-muted">{gate.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-ink-muted">{item.next_actions[0] || item.blockers[0] || 'Cutover lane is ready for go/no-go review.'}</div>
                <div className="mt-3 rounded-md border border-border bg-canvas-raised p-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-secondary">Lane owner</span>
                    <Link to={item.route} className="text-xs font-medium text-accent hover:text-accent">Open setup</Link>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                    <input
                      value={form.owner_name}
                      onChange={(event) => updateCutoverAssignmentForm(item.integration, { owner_name: event.target.value })}
                      placeholder="Owner"
                      className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <select
                      value={form.status}
                      onChange={(event) => updateCutoverAssignmentForm(item.integration, { status: event.target.value as AssignmentFormState['status'] })}
                      className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(event) => updateCutoverAssignmentForm(item.integration, { due_date: event.target.value })}
                      className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <input
                      value={form.note}
                      onChange={(event) => updateCutoverAssignmentForm(item.integration, { note: event.target.value })}
                      placeholder="Cutover note"
                      className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-ink-faint">
                      {item.assignment ? `Assigned ${new Date(item.assignment.assigned_at).toLocaleDateString()}` : 'No owner assigned'}
                    </span>
                    <button
                      type="button"
                      onClick={() => submitCutoverAssignment(item)}
                      disabled={!form.owner_name.trim() || cutoverAssignmentMutation.isPending}
                      className="rounded-md bg-accent text-accent-on px-2.5 py-1.5 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      {vendorCredentialPacket && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LockKeyhole className="h-4 w-4 text-accent" />
                Vendor Credential Request Packet
              </h2>
              <p className="text-xs text-ink-muted">{new Date(vendorCredentialPacket.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${vendorCredentialPacket.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : vendorCredentialPacket.status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                {vendorCredentialPacket.status}
              </span>
              <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{vendorCredentialPacket.ready_to_request_count} ready</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{vendorCredentialPacket.attention_count} attention</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{vendorCredentialPacket.blocked_count} blocked</span>
              <a
                href={ROUTES.OPERATIONS_VENDOR_CREDENTIAL_REQUEST_PACKET_EXPORT}
                download={vendorCredentialPacket.export_filename}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
            </div>
          </div>
          <div className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-3 lg:grid-cols-2">
              {vendorCredentialPacket.items.map((item) => (
                <Link key={item.integration} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{item.label}</div>
                      <div className="mt-1 text-xs text-ink-muted">{item.vendor_profile.vendor_name || 'Vendor pending'} · {item.vendor_profile.owner_email || item.vendor_profile.support_contact || 'Contact pending'}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.request_status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : item.request_status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                      {item.request_status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                    <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                      <div className="font-semibold text-ink-secondary">{item.missing_fields.length}</div>
                      <div className="text-ink-faint">missing</div>
                    </div>
                    <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                      <div className="font-semibold text-ink-secondary">{item.handoff_archive.status}</div>
                      <div className="text-ink-faint">archive</div>
                    </div>
                    <div className="rounded-md border border-border bg-canvas-raised px-2 py-1">
                      <div className="font-semibold text-ink-secondary">{item.sandbox_reference_count}/{item.sandbox_reference_total}</div>
                      <div className="text-ink-faint">refs</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs font-medium text-ink-secondary">{item.request_subject}</div>
                  <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                    {item.request_checklist.slice(0, 3).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-border bg-canvas-raised">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Request draft</div>
              {vendorCredentialPacket.items.slice(0, 1).map((item) => (
                <div key={item.integration} className="p-3">
                  <div className="text-sm font-medium text-ink">{item.request_subject}</div>
                  <pre className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-canvas p-3 text-xs leading-5 text-ink-secondary">{item.request_body}</pre>
                </div>
              ))}
            </aside>
          </div>
        </section>
      )}

      {operatorHealth && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Activity className="h-4 w-4 text-accent" />
                Operator Health
              </h2>
              <p className="text-xs text-ink-muted">{new Date(operatorHealth.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${operatorHealth.status === 'healthy' ? 'border-accent-soft bg-accent-soft text-accent' : operatorHealth.status === 'attention' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                {operatorHealth.status}
              </span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{operatorHealth.score}%</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{operatorHealth.summary.critical_checks ?? 0} critical</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{operatorHealth.summary.warning_checks ?? 0} warning</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {operatorHealth.checks.map((check) => (
                <Link key={check.key} to={check.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{check.label}</div>
                      <div className="mt-1 text-xs text-ink-muted">{check.detail}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${check.status === 'healthy' ? 'border-accent-soft bg-accent-soft text-accent' : check.status === 'warning' || check.status === 'attention' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                      {check.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
                    <span>{check.score}%</span>
                    <span>{check.last_seen_at ? new Date(check.last_seen_at).toLocaleString() : 'No evidence'}</span>
                  </div>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Operator actions</div>
              <div className="divide-y divide-border">
                {operatorHealth.recommended_actions.slice(0, 5).map((action) => (
                  <Link key={action.key} to={action.route} className="block px-3 py-2 hover:bg-canvas-sunk/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{action.label}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${action.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>{action.severity}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{action.detail}</div>
                  </Link>
                ))}
                {operatorHealth.recommended_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-ink-faint">No operator actions.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {documentStorageReadiness && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Server className="h-4 w-4 text-accent" />
                Document Storage Readiness
              </h2>
              <p className="text-xs text-ink-muted">{new Date(documentStorageReadiness.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${documentStorageReadiness.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : documentStorageReadiness.status === 'attention' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                {documentStorageReadiness.status}
              </span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{documentStorageReadiness.score}%</span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{documentStorageReadiness.summary.stored_documents ?? 0} stored</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{documentStorageReadiness.summary.metadata_only_documents ?? 0} metadata-only</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {documentStorageReadiness.checks.map((check) => (
                <Link key={check.key} to={check.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{check.label}</div>
                      <div className="mt-1 text-xs text-ink-muted">{check.detail}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${check.status === 'clear' ? 'border-accent-soft bg-accent-soft text-accent' : check.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                      {check.status === 'clear' ? 'clear' : check.count}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-ink-faint">{check.recommended_action}</div>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Recent handoffs</div>
              <div className="divide-y divide-border">
                {documentStorageReadiness.recent_handoffs.slice(0, 5).map((handoff) => (
                  <div key={`${handoff.document_id}:${handoff.occurred_at}`} className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-ink">{handoff.document_id}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${handoff.presigned && !handoff.expired ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                        {handoff.presigned ? 'signed' : 'unsigned'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{handoff.storage_status} · {new Date(handoff.occurred_at).toLocaleString()}</div>
                    <div className="mt-1 text-[11px] text-ink-faint">{handoff.expired ? 'Expired' : 'Active'}{handoff.expires_at ? ` · expires ${new Date(handoff.expires_at).toLocaleString()}` : ''}</div>
                  </div>
                ))}
                {documentStorageReadiness.recent_handoffs.length === 0 && (
                  <div className="px-3 py-6 text-sm text-ink-faint">No document handoffs recorded.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {productionConfigAudit && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <LockKeyhole className="h-4 w-4 text-accent" />
                Production Config Audit
              </h2>
              <p className="text-xs text-ink-muted">{productionConfigAudit.environment} · {new Date(productionConfigAudit.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${productionConfigAudit.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : productionConfigAudit.status === 'attention' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                {productionConfigAudit.status}
              </span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{productionConfigAudit.score}%</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{productionConfigAudit.critical_count} critical</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{productionConfigAudit.warning_count} warning</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {productionConfigAudit.checks.map((check) => (
              <div key={check.key} className="rounded-md border border-border bg-canvas p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-ink">{check.label}</div>
                    <div className="mt-1 text-xs text-ink-muted">{check.detail}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${check.ready ? 'border-accent-soft bg-accent-soft text-accent' : check.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {check.ready ? 'ready' : check.severity}
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-secondary">{check.action}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {check.env_vars.map((envVar) => (
                    <span key={envVar} className="rounded-md border border-border bg-canvas-raised px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">{envVar}</span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-ink-faint">{check.docs.join(' · ')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {goLivePacket && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Go-Live Packet</h2>
              <p className="text-xs text-ink-muted">{goLivePacket.environment} · {new Date(goLivePacket.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={goLivePacket.go_live_ready} label={goLivePacket.go_live_ready ? 'Ready' : 'Attention'} />
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{goLivePacket.launch_score}% launch</span>
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{goLivePacket.blocking_count} blocking</span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{goLivePacket.evidence_ready_count}/{goLivePacket.evidence_total} evidence</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {goLivePacket.evidence.map((item) => (
                <Link key={item.key} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{item.label}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${item.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : item.status === 'warning' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-ink-muted">{item.detail}</div>
                  {item.captured_at && <div className="mt-1 text-[11px] text-ink-faint">{new Date(item.captured_at).toLocaleString()}</div>}
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Manager sign-off</div>
              <div className="space-y-2 border-b border-border px-3 py-3">
                <select
                  value={attestationForm.decision}
                  onChange={(event) => setAttestationForm((current) => ({ ...current, decision: event.target.value as GoLiveAttestationCreate['decision'] }))}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                >
                  <option value="needs_changes">Needs changes</option>
                  <option value="approved" disabled={!goLivePacket.go_live_ready}>Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <textarea
                  value={attestationForm.note}
                  onChange={(event) => setAttestationForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Review note"
                  rows={3}
                  className="w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => attestationMutation.mutate({ decision: attestationForm.decision, note: attestationForm.note.trim() || null })}
                  disabled={attestationMutation.isPending || (attestationForm.decision === 'approved' && !goLivePacket.go_live_ready)}
                  className="w-full rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
                >
                  Record sign-off
                </button>
                {goLivePacket.latest_attestation && (
                  <div className="rounded-md border border-border bg-canvas p-2 text-xs text-ink-muted">
                    <div className="font-medium text-ink">{goLivePacket.latest_attestation.decision.replace('_', ' ')}</div>
                    <div className="mt-1">{goLivePacket.latest_attestation.reviewer_name ?? 'Reviewer'} · {new Date(goLivePacket.latest_attestation.created_at).toLocaleString()}</div>
                    {goLivePacket.latest_attestation.note && <div className="mt-1">{goLivePacket.latest_attestation.note}</div>}
                  </div>
                )}
              </div>
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Packet blockers</div>
              <div className="divide-y divide-border">
                {goLivePacket.open_workplan_items.slice(0, 4).map((item) => (
                  <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-canvas-sunk/50">
                    <div className="text-sm font-medium text-ink">{item.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{item.detail}</div>
                    <div className="mt-1 text-[11px] text-ink-faint">{item.assignment?.owner_name ?? 'Unassigned'} · {item.severity}</div>
                  </Link>
                ))}
                {goLivePacket.open_workplan_items.length === 0 && (
                  <div className="px-3 py-6 text-sm text-ink-faint">No packet blockers.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {roleChecklists && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Role Dry-Run Checklists</h2>
              <p className="text-xs text-ink-muted">{roleChecklists.total_roles} role(s) · {new Date(roleChecklists.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{roleChecklists.ready_roles} ready</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{roleChecklists.attention_roles} attention</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 xl:grid-cols-5">
            {roleChecklists.roles.map((role) => (
              <div key={role.key} className="rounded-md border border-border bg-canvas">
                <div className="border-b border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-ink">{role.label}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${role.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>{role.ready_count}/{role.total}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{role.summary}</p>
                </div>
                <div className="divide-y divide-border">
                  {role.items.map((item) => (
                    <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-canvas-sunk/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ink">{item.label}</span>
                        <span className={`h-2 w-2 rounded-full ${item.status === 'ready' ? 'bg-accent' : 'bg-warn'}`} />
                      </div>
                      <div className="mt-1 text-[11px] text-ink-muted">{item.detail}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Dry-Run Session Evidence</h2>
            <p className="text-xs text-ink-muted">{dryRunSessions?.total ?? 0} saved session(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeDryRunSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activeDryRunSession.complete_count} complete</span>
                <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{activeDryRunSession.blocked_count} blocked</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activeDryRunSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start rehearsal</div>
              <input
                value={dryRunSessionForm.session_name ?? ''}
                onChange={(event) => setDryRunSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={dryRunSessionForm.note ?? ''}
                onChange={(event) => setDryRunSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Session note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startDryRunSessionMutation.mutate({
                  session_name: dryRunSessionForm.session_name?.trim() || 'Clinic dry run',
                  note: dryRunSessionForm.note?.trim() || null,
                })}
                disabled={startDryRunSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start session
              </button>
            </div>
            {activeDryRunSession && (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{activeDryRunSession.session_name}</div>
                    <div className="mt-1 text-xs text-ink-muted">{activeDryRunSession.started_by ?? 'Staff'} · {new Date(activeDryRunSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeDryRunSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {activeDryRunSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeDryRunSession.note && <div className="mt-2 text-xs text-ink-muted">{activeDryRunSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateDryRunSessionMutation.mutate({
                    sessionId: activeDryRunSession.session_id,
                    data: { session_status: 'completed', note: activeDryRunSession.note },
                  })}
                  disabled={activeDryRunSession.status === 'completed' || updateDryRunSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Complete session
                </button>
              </div>
            )}
          </div>
          {activeDryRunSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeDryRunSession.roles.map((role) => (
                <div key={role.key} className="rounded-md border border-border">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-semibold text-ink">{role.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {role.items.map((item) => {
                      const itemForm = formForDryRunItem(activeDryRunSession, role.key, item.key);
                      return (
                        <div key={item.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link to={item.route} className="text-xs font-medium text-ink hover:text-accent">{item.label}</Link>
                              <div className="mt-1 text-[11px] text-ink-muted">{item.detail}</div>
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.dry_run_status === 'complete' ? 'border-accent-soft bg-accent-soft text-accent' : item.dry_run_status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas text-ink-secondary'}`}>{item.dry_run_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                            <select
                              value={itemForm.dry_run_status}
                              onChange={(event) => updateDryRunItemForm(activeDryRunSession.session_id, role.key, item.key, { dry_run_status: event.target.value as DryRunItemFormState['dry_run_status'] })}
                              className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="complete">Complete</option>
                              <option value="blocked">Blocked</option>
                            </select>
                            <input
                              value={itemForm.item_note}
                              onChange={(event) => updateDryRunItemForm(activeDryRunSession.session_id, role.key, item.key, { item_note: event.target.value })}
                              placeholder="Evidence note"
                              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitDryRunItem(activeDryRunSession, role.key, item.key)}
                              disabled={updateDryRunSessionMutation.isPending}
                              className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border text-sm text-ink-faint">
              Start a dry-run session to capture role evidence.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Restore Drill Evidence</h2>
            <p className="text-xs text-ink-muted">{restoreDrillSessions?.total ?? 0} saved session(s) · {restoreDrillChecklist?.total ?? 0} evidence item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeRestoreDrillSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activeRestoreDrillSession.complete_count} complete</span>
                <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{activeRestoreDrillSession.blocked_count} blocked</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activeRestoreDrillSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start drill</div>
              <input
                value={restoreDrillSessionForm.session_name ?? ''}
                onChange={(event) => setRestoreDrillSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={restoreDrillSessionForm.owner_name ?? ''}
                onChange={(event) => setRestoreDrillSessionForm((current) => ({ ...current, owner_name: event.target.value }))}
                placeholder="Drill owner"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={restoreDrillSessionForm.backup_reference ?? ''}
                onChange={(event) => setRestoreDrillSessionForm((current) => ({ ...current, backup_reference: event.target.value }))}
                placeholder="Backup reference"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={restoreDrillSessionForm.note ?? ''}
                onChange={(event) => setRestoreDrillSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Drill note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startRestoreDrillSessionMutation.mutate({
                  session_name: restoreDrillSessionForm.session_name?.trim() || 'Restore drill',
                  owner_name: restoreDrillSessionForm.owner_name?.trim() || null,
                  backup_reference: restoreDrillSessionForm.backup_reference?.trim() || null,
                  note: restoreDrillSessionForm.note?.trim() || null,
                })}
                disabled={startRestoreDrillSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start drill
              </button>
            </div>
            {activeRestoreDrillSession && (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{activeRestoreDrillSession.session_name}</div>
                    <div className="mt-1 text-xs text-ink-muted">{activeRestoreDrillSession.owner_name ?? activeRestoreDrillSession.started_by ?? 'Drill owner'} · {new Date(activeRestoreDrillSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeRestoreDrillSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {activeRestoreDrillSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeRestoreDrillSession.backup_reference && <div className="mt-2 text-xs text-ink-muted">Backup {activeRestoreDrillSession.backup_reference}</div>}
                {activeRestoreDrillSession.note && <div className="mt-2 text-xs text-ink-muted">{activeRestoreDrillSession.note}</div>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    value={restoreDrillMetricsForm.rto_minutes || (activeRestoreDrillSession.rto_minutes === null ? '' : String(activeRestoreDrillSession.rto_minutes))}
                    onChange={(event) => setRestoreDrillMetricsForm((current) => ({ ...current, rto_minutes: event.target.value }))}
                    placeholder="RTO minutes"
                    className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                  />
                  <input
                    type="number"
                    min="0"
                    value={restoreDrillMetricsForm.rpo_minutes || (activeRestoreDrillSession.rpo_minutes === null ? '' : String(activeRestoreDrillSession.rpo_minutes))}
                    onChange={(event) => setRestoreDrillMetricsForm((current) => ({ ...current, rpo_minutes: event.target.value }))}
                    placeholder="RPO minutes"
                    className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                  />
                </div>
                <textarea
                  value={restoreDrillMetricsForm.note || activeRestoreDrillSession.note || ''}
                  onChange={(event) => setRestoreDrillMetricsForm((current) => ({ ...current, note: event.target.value }))}
                  rows={3}
                  placeholder="RTO/RPO evidence note"
                  className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <a
                    href={ROUTES.OPERATIONS_RESTORE_DRILL_SESSION_EXPORT(activeRestoreDrillSession.session_id)}
                    download="concierge-os-restore-drill.csv"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </a>
                  <button
                    type="button"
                    onClick={() => submitRestoreDrillMetrics(activeRestoreDrillSession)}
                    disabled={updateRestoreDrillSessionMutation.isPending}
                    className="rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                  >
                    Save metrics
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRestoreDrillSessionMutation.mutate({
                      sessionId: activeRestoreDrillSession.session_id,
                      data: { session_status: 'completed', note: restoreDrillMetricsForm.note.trim() || activeRestoreDrillSession.note },
                    })}
                    disabled={activeRestoreDrillSession.status === 'completed' || updateRestoreDrillSessionMutation.isPending}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Complete
                  </button>
                </div>
              </div>
            )}
          </div>
          {activeRestoreDrillSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeRestoreDrillSession.items.map((item) => {
                const itemForm = formForRestoreDrillItem(activeRestoreDrillSession, item.key);
                return (
                  <div key={item.key} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-ink">{item.label}</div>
                        <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.drill_status === 'complete' ? 'border-accent-soft bg-accent-soft text-accent' : item.drill_status === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas text-ink-secondary'}`}>{item.drill_status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                      <select
                        value={itemForm.drill_status}
                        onChange={(event) => updateRestoreDrillItemForm(activeRestoreDrillSession.session_id, item.key, { drill_status: event.target.value as RestoreDrillItemFormState['drill_status'] })}
                        className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="complete">Complete</option>
                        <option value="blocked">Blocked</option>
                      </select>
                      <input
                        value={itemForm.item_note}
                        onChange={(event) => updateRestoreDrillItemForm(activeRestoreDrillSession.session_id, item.key, { item_note: event.target.value })}
                        placeholder="Evidence note"
                        className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitRestoreDrillItem(activeRestoreDrillSession, item.key)}
                        disabled={updateRestoreDrillSessionMutation.isPending}
                        className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {(restoreDrillChecklist?.items ?? []).map((item) => (
                <Link key={item.key} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Browser QA Evidence</h2>
            <p className="text-xs text-ink-muted">{browserQaSessions?.total ?? 0} saved session(s) · {browserQaChecklist?.total ?? 0} checklist item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeBrowserQaSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activeBrowserQaSession.passed_count} passed</span>
                <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{activeBrowserQaSession.failed_count} failed</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activeBrowserQaSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start QA run</div>
              <input
                value={browserQaSessionForm.session_name ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={browserQaSessionForm.browser ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, browser: event.target.value }))}
                placeholder="Browser"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={browserQaSessionForm.note ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="QA note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startBrowserQaSessionMutation.mutate({
                  session_name: browserQaSessionForm.session_name?.trim() || 'Browser QA run',
                  browser: browserQaSessionForm.browser?.trim() || null,
                  note: browserQaSessionForm.note?.trim() || null,
                })}
                disabled={startBrowserQaSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start QA
              </button>
            </div>
            {activeBrowserQaSession && (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{activeBrowserQaSession.session_name}</div>
                    <div className="mt-1 text-xs text-ink-muted">{activeBrowserQaSession.browser ?? 'Browser'} · {new Date(activeBrowserQaSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeBrowserQaSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {activeBrowserQaSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeBrowserQaSession.note && <div className="mt-2 text-xs text-ink-muted">{activeBrowserQaSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateBrowserQaSessionMutation.mutate({
                    sessionId: activeBrowserQaSession.session_id,
                    data: { session_status: 'completed', note: activeBrowserQaSession.note },
                  })}
                  disabled={activeBrowserQaSession.status === 'completed' || updateBrowserQaSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Complete QA
                </button>
              </div>
            )}
          </div>
          {activeBrowserQaSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeBrowserQaSession.items.map((item) => {
                const itemForm = formForBrowserQaItem(activeBrowserQaSession, item.key);
                return (
                  <div key={item.key} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={item.route} className="text-sm font-medium text-ink hover:text-accent">{item.label}</Link>
                        <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.qa_status === 'passed' ? 'border-accent-soft bg-accent-soft text-accent' : item.qa_status === 'failed' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas text-ink-secondary'}`}>{item.qa_status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                      <select
                        value={itemForm.qa_status}
                        onChange={(event) => updateBrowserQaItemForm(activeBrowserQaSession.session_id, item.key, { qa_status: event.target.value as BrowserQaItemFormState['qa_status'] })}
                        className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <input
                        value={itemForm.item_note}
                        onChange={(event) => updateBrowserQaItemForm(activeBrowserQaSession.session_id, item.key, { item_note: event.target.value })}
                        placeholder="Evidence note"
                        className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitBrowserQaItem(activeBrowserQaSession, item.key)}
                        disabled={updateBrowserQaSessionMutation.isPending}
                        className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(browserQaChecklist?.items ?? []).map((item) => (
                <Link key={item.key} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Staff Training Evidence</h2>
            <p className="text-xs text-ink-muted">{staffTrainingSessions?.total ?? 0} saved session(s) · {staffTrainingChecklist?.total_items ?? 0} training item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeStaffTrainingSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activeStaffTrainingSession.signed_count} signed</span>
                <span className="rounded-md border border-border bg-canvas-sunk px-2 py-1 text-xs font-medium text-ink-secondary">{activeStaffTrainingSession.reviewed_count} reviewed</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activeStaffTrainingSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start training</div>
              <input
                value={staffTrainingSessionForm.session_name ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={staffTrainingSessionForm.trainer_name ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, trainer_name: event.target.value }))}
                placeholder="Trainer"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={staffTrainingSessionForm.note ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Training note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startStaffTrainingSessionMutation.mutate({
                  session_name: staffTrainingSessionForm.session_name?.trim() || 'Staff training',
                  trainer_name: staffTrainingSessionForm.trainer_name?.trim() || null,
                  note: staffTrainingSessionForm.note?.trim() || null,
                })}
                disabled={startStaffTrainingSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start training
              </button>
            </div>
            {activeStaffTrainingSession && (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{activeStaffTrainingSession.session_name}</div>
                    <div className="mt-1 text-xs text-ink-muted">{activeStaffTrainingSession.trainer_name ?? activeStaffTrainingSession.started_by ?? 'Trainer'} · {new Date(activeStaffTrainingSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeStaffTrainingSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {activeStaffTrainingSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeStaffTrainingSession.note && <div className="mt-2 text-xs text-ink-muted">{activeStaffTrainingSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateStaffTrainingSessionMutation.mutate({
                    sessionId: activeStaffTrainingSession.session_id,
                    data: { session_status: 'completed', note: activeStaffTrainingSession.note },
                  })}
                  disabled={activeStaffTrainingSession.status === 'completed' || updateStaffTrainingSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Complete training
                </button>
              </div>
            )}
          </div>
          {activeStaffTrainingSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeStaffTrainingSession.roles.map((role) => (
                <div key={role.key} className="rounded-md border border-border">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-semibold text-ink">{role.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {role.items.map((item) => {
                      const itemForm = formForStaffTrainingItem(activeStaffTrainingSession, role.key, item.key);
                      return (
                        <div key={item.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link to={item.route} className="text-xs font-medium text-ink hover:text-accent">{item.label}</Link>
                              <div className="mt-1 text-[11px] text-ink-muted">{item.detail}</div>
                              <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.training_status === 'signed' ? 'border-accent-soft bg-accent-soft text-accent' : item.training_status === 'reviewed' ? 'border-border bg-canvas-sunk text-ink-secondary' : 'border-border bg-canvas text-ink-secondary'}`}>{item.training_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                            <select
                              value={itemForm.training_status}
                              onChange={(event) => updateStaffTrainingItemForm(activeStaffTrainingSession.session_id, role.key, item.key, { training_status: event.target.value as StaffTrainingItemFormState['training_status'] })}
                              className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="signed">Signed</option>
                            </select>
                            <input
                              value={itemForm.item_note}
                              onChange={(event) => updateStaffTrainingItemForm(activeStaffTrainingSession.session_id, role.key, item.key, { item_note: event.target.value })}
                              placeholder="Training evidence"
                              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitStaffTrainingItem(activeStaffTrainingSession, role.key, item.key)}
                              disabled={updateStaffTrainingSessionMutation.isPending}
                              className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {(staffTrainingChecklist?.roles ?? []).map((role) => (
                <div key={role.key} className="rounded-md border border-border bg-canvas">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-semibold text-ink">{role.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {role.items.map((item) => (
                      <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-canvas-sunk/50">
                        <div className="text-xs font-medium text-ink">{item.label}</div>
                        <div className="mt-1 text-[11px] text-ink-muted">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-ink-faint">{item.category}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Policy Approval Evidence</h2>
            <p className="text-xs text-ink-muted">{policyApprovalSessions?.total ?? 0} saved session(s) · {policyApprovalChecklist?.total ?? 0} policy item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activePolicyApprovalSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activePolicyApprovalSession.approved_count} approved</span>
                <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{activePolicyApprovalSession.needs_changes_count} needs changes</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activePolicyApprovalSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start policy review</div>
              <input
                value={policyApprovalSessionForm.session_name ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={policyApprovalSessionForm.reviewer_name ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, reviewer_name: event.target.value }))}
                placeholder="Reviewer"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={policyApprovalSessionForm.note ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Policy review note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startPolicyApprovalSessionMutation.mutate({
                  session_name: policyApprovalSessionForm.session_name?.trim() || 'Policy approval',
                  reviewer_name: policyApprovalSessionForm.reviewer_name?.trim() || null,
                  note: policyApprovalSessionForm.note?.trim() || null,
                })}
                disabled={startPolicyApprovalSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start review
              </button>
            </div>
            {activePolicyApprovalSession && (
              <div className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-ink">{activePolicyApprovalSession.session_name}</div>
                    <div className="mt-1 text-xs text-ink-muted">{activePolicyApprovalSession.reviewer_name ?? activePolicyApprovalSession.started_by ?? 'Reviewer'} · {new Date(activePolicyApprovalSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activePolicyApprovalSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {activePolicyApprovalSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activePolicyApprovalSession.note && <div className="mt-2 text-xs text-ink-muted">{activePolicyApprovalSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updatePolicyApprovalSessionMutation.mutate({
                    sessionId: activePolicyApprovalSession.session_id,
                    data: { session_status: 'completed', note: activePolicyApprovalSession.note },
                  })}
                  disabled={activePolicyApprovalSession.status === 'completed' || updatePolicyApprovalSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Complete review
                </button>
              </div>
            )}
          </div>
          {activePolicyApprovalSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activePolicyApprovalSession.items.map((item) => {
                const itemForm = formForPolicyApprovalItem(activePolicyApprovalSession, item.key);
                return (
                  <div key={item.key} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={item.route} className="text-sm font-medium text-ink hover:text-accent">{item.label}</Link>
                        <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-ink-faint">{item.category} · {item.docs.join(', ')}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.approval_status === 'approved' ? 'border-accent-soft bg-accent-soft text-accent' : item.approval_status === 'needs_changes' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas text-ink-secondary'}`}>{item.approval_status.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                      <select
                        value={itemForm.approval_status}
                        onChange={(event) => updatePolicyApprovalItemForm(activePolicyApprovalSession.session_id, item.key, { approval_status: event.target.value as PolicyApprovalItemFormState['approval_status'] })}
                        className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="needs_changes">Needs changes</option>
                      </select>
                      <input
                        value={itemForm.item_note}
                        onChange={(event) => updatePolicyApprovalItemForm(activePolicyApprovalSession.session_id, item.key, { item_note: event.target.value })}
                        placeholder="Approval evidence"
                        className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitPolicyApprovalItem(activePolicyApprovalSession, item.key)}
                        disabled={updatePolicyApprovalSessionMutation.isPending}
                        className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(policyApprovalChecklist?.items ?? []).map((item) => (
                <Link key={item.key} to={item.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="text-sm font-medium text-ink">{item.label}</div>
                  <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-ink-faint">{item.category} · {item.docs.join(', ')}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Cutover Runbook</h2>
            <p className="text-xs text-ink-muted">{cutoverSessions?.total ?? 0} saved session(s) · {cutoverRunbook?.total_steps ?? 0} timed step(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCutoverSession && (
              <>
                <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">{activeCutoverSession.complete_count} complete</span>
                <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{activeCutoverSession.blocked_count} blocked</span>
                <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{activeCutoverSession.rollback_count} rollback</span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{activeCutoverSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-canvas p-3">
              <div className="text-meta font-medium text-ink-faint">Start cutover</div>
              <input
                value={cutoverSessionForm.session_name ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                value={cutoverSessionForm.cutover_owner ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, cutover_owner: event.target.value }))}
                placeholder="Cutover owner"
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <input
                type="datetime-local"
                value={cutoverSessionForm.scheduled_for ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, scheduled_for: event.target.value }))}
                className="mt-2 w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <textarea
                value={cutoverSessionForm.note ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Cutover note"
                className="mt-2 w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startCutoverSessionMutation.mutate({
                  session_name: cutoverSessionForm.session_name?.trim() || 'Production cutover rehearsal',
                  cutover_owner: cutoverSessionForm.cutover_owner?.trim() || null,
                  scheduled_for: cutoverSessionForm.scheduled_for || null,
                  note: cutoverSessionForm.note?.trim() || null,
                })}
                disabled={startCutoverSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start cutover
              </button>
            </div>
            {activeCutoverSession && (
              <div className="space-y-3">
                <div className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-ink">{activeCutoverSession.session_name}</div>
                      <div className="mt-1 text-xs text-ink-muted">{activeCutoverSession.cutover_owner ?? activeCutoverSession.started_by ?? 'Cutover owner'} · {new Date(activeCutoverSession.started_at).toLocaleString()}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeCutoverSession.status === 'completed' ? 'border-accent-soft bg-accent-soft text-accent' : activeCutoverSession.status === 'aborted' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                      {activeCutoverSession.status.replace('_', ' ')}
                    </span>
                  </div>
                  {activeCutoverSession.scheduled_for && <div className="mt-2 text-xs text-ink-muted">Scheduled {new Date(activeCutoverSession.scheduled_for).toLocaleString()}</div>}
                  {activeCutoverSession.note && <div className="mt-2 text-xs text-ink-muted">{activeCutoverSession.note}</div>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <a
                      href={ROUTES.OPERATIONS_CUTOVER_RUNBOOK_SESSION_EXPORT(activeCutoverSession.session_id)}
                      download="concierge-os-cutover-runbook.csv"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </a>
                    <button
                      type="button"
                      onClick={() => updateCutoverSessionMutation.mutate({
                        sessionId: activeCutoverSession.session_id,
                        data: { session_status: 'completed', note: activeCutoverSession.note },
                      })}
                      disabled={activeCutoverSession.status === 'completed' || updateCutoverSessionMutation.isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-soft px-3 py-2 text-xs font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCutoverSessionMutation.mutate({
                        sessionId: activeCutoverSession.session_id,
                        data: { session_status: 'aborted', note: activeCutoverSession.note },
                      })}
                      disabled={activeCutoverSession.status === 'aborted' || updateCutoverSessionMutation.isPending}
                      className="inline-flex items-center justify-center rounded-md border border-danger/20 px-3 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      Abort
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <div className="text-meta font-medium text-ink-faint">Rollback decision</div>
                  <div className="mt-2 grid gap-2">
                    <select
                      value={cutoverRollbackForm.rollback_status === 'not_reviewed' && activeCutoverSession.rollback_status !== 'not_reviewed' ? activeCutoverSession.rollback_status : cutoverRollbackForm.rollback_status}
                      onChange={(event) => setCutoverRollbackForm((current) => ({ ...current, rollback_status: event.target.value as NonNullable<CutoverRunbookSessionUpdate['rollback_status']> }))}
                      className="w-full rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    >
                      <option value="not_reviewed">Not reviewed</option>
                      <option value="rollback_ready">Rollback ready</option>
                      <option value="rollback_required">Rollback required</option>
                      <option value="not_needed">Not needed</option>
                    </select>
                    <textarea
                      value={cutoverRollbackForm.rollback_decision || activeCutoverSession.rollback_decision || ''}
                      onChange={(event) => setCutoverRollbackForm((current) => ({ ...current, rollback_decision: event.target.value }))}
                      rows={3}
                      placeholder="Decision note"
                      className="w-full resize-none rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => submitCutoverRollback(activeCutoverSession)}
                      disabled={updateCutoverSessionMutation.isPending}
                      className="rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                    >
                      Save rollback decision
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {activeCutoverSession ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {activeCutoverSession.phases.map((phase) => (
                <div key={phase.key} className="rounded-md border border-border">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-semibold text-ink">{phase.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{phase.objective}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {phase.steps.map((step) => {
                      const stepForm = formForCutoverStep(activeCutoverSession, phase.key, step.key);
                      return (
                        <div key={step.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-medium text-ink">{step.label}</div>
                              <div className="mt-1 text-[11px] text-ink-muted">{step.detail}</div>
                              <div className="mt-1 text-[11px] text-ink-faint">T{step.expected_minute >= 0 ? '+' : ''}{step.expected_minute} · {step.owner_role}</div>
                              {step.rollback_trigger && <div className="mt-1 text-[11px] text-danger">{step.rollback_trigger}</div>}
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${step.step_status === 'complete' ? 'border-accent-soft bg-accent-soft text-accent' : step.step_status === 'blocked' || step.step_status === 'rollback' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas text-ink-secondary'}`}>{step.step_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <select
                              value={stepForm.step_status}
                              onChange={(event) => updateCutoverStepForm(activeCutoverSession.session_id, phase.key, step.key, { step_status: event.target.value as CutoverStepFormState['step_status'] })}
                              className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="complete">Complete</option>
                              <option value="blocked">Blocked</option>
                              <option value="rollback">Rollback</option>
                            </select>
                            <input
                              value={stepForm.owner_name}
                              onChange={(event) => updateCutoverStepForm(activeCutoverSession.session_id, phase.key, step.key, { owner_name: event.target.value })}
                              placeholder="Owner"
                              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem]">
                            <input
                              value={stepForm.step_note}
                              onChange={(event) => updateCutoverStepForm(activeCutoverSession.session_id, phase.key, step.key, { step_note: event.target.value })}
                              placeholder="Step evidence"
                              className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitCutoverStep(activeCutoverSession, phase.key, step.key)}
                              disabled={updateCutoverSessionMutation.isPending}
                              className="rounded-md border border-border-strong px-2 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {(cutoverRunbook?.phases ?? []).map((phase) => (
                <div key={phase.key} className="rounded-md border border-border bg-canvas">
                  <div className="border-b border-border px-3 py-2">
                    <div className="text-sm font-semibold text-ink">{phase.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">{phase.objective}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {phase.steps.map((step) => (
                      <div key={step.key} className="px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-ink">{step.label}</div>
                            <div className="mt-1 text-[11px] text-ink-muted">{step.detail}</div>
                          </div>
                          <span className="rounded-md border border-border bg-canvas-raised px-2 py-0.5 text-[11px] font-medium text-ink-muted">T{step.expected_minute >= 0 ? '+' : ''}{step.expected_minute}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-ink-faint">{step.owner_role}</div>
                        {step.rollback_trigger && <div className="mt-1 text-[11px] text-danger">{step.rollback_trigger}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {workplan && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Launch Workplan</h2>
              <p className="text-xs text-ink-muted">{workplan.total} open item(s) · {new Date(workplan.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={workplan.status === 'clear'} label={workplan.status === 'clear' ? 'Clear' : 'Attention'} />
              <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">{workplan.blocking_count} blocking</span>
              <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">{workplan.warning_count} warning</span>
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{workplan.assigned_count} assigned</span>
              <a
                href={workplanExportHref}
                download="concierge-os-launch-workplan.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
              <button
                onClick={() => workplanSnapshotMutation.mutate()}
                disabled={workplanSnapshotMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
          <div className="divide-y divide-border">
            {workplan.items.slice(0, 8).map((item) => (
              <div key={item.key} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_11rem_8rem]">
                <Link to={item.route} className="min-w-0 hover:text-accent">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{item.label}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.severity === 'blocking' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>{item.severity}</span>
                    <span className="rounded-md border border-border bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">{item.category}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-muted">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-ink-faint">{item.recommended_action}</div>
                </Link>
                <div className="text-xs text-ink-muted">
                  <div className="font-medium text-ink-secondary">{item.assignment?.owner_name ?? item.owner_role}</div>
                  <div className="mt-1">{item.assignment ? item.assignment.status.replace('_', ' ') : 'Unassigned'}</div>
                  {item.assignment?.due_date && <div className="mt-1">Due {item.assignment.due_date}</div>}
                </div>
                <Link to={item.route} className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong px-3 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk">
                  Open
                </Link>
              </div>
            ))}
            {workplan.items.length === 0 && (
              <div className="px-4 py-6 text-sm text-ink-faint">No launch workplan items.</div>
            )}
          </div>
          {(workplanSnapshots?.data ?? []).length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="mb-2 text-meta font-medium text-ink-faint">Saved workplan evidence</div>
              <div className="grid gap-2 md:grid-cols-3">
                {(workplanSnapshots?.data ?? []).slice(0, 3).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-md border border-border bg-canvas p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{snapshot.total} item(s)</span>
                      <StatusBadge ok={snapshot.status === 'clear'} label={snapshot.status} />
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{snapshot.blocking_count} blocking, {snapshot.unassigned_count} unassigned</div>
                    <div className="mt-1 text-[11px] text-ink-faint">{new Date(snapshot.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {rehearsal && (
        <section className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Production Rehearsal</h2>
              <p className="text-xs text-ink-muted">{new Date(rehearsal.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge ok={rehearsal.rehearsal_ready} label={rehearsal.rehearsal_ready ? 'Ready' : 'Attention'} />
              <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs font-medium text-ink-secondary">{rehearsal.score}%</span>
              <a
                href={rehearsalExportHref}
                download="concierge-os-production-rehearsal.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
              <button
                onClick={() => rehearsalSnapshotMutation.mutate()}
                disabled={rehearsalSnapshotMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent text-accent-on px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {rehearsal.gates.map((gate) => (
                <Link key={gate.key} to={gate.route} className="rounded-md border border-border bg-canvas p-3 hover:bg-canvas-sunk">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{gate.label}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${gate.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : gate.status === 'warning' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                      {gate.score}%
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-ink-muted">{gate.detail}</div>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Rehearsal actions</div>
              <div className="divide-y divide-border">
                {rehearsal.recommended_actions.slice(0, 5).map((action) => {
                  const form = formForAction(action);
                  return (
                    <div key={action.key} className="px-3 py-3">
                      <Link to={action.route} className="block hover:text-accent">
                        <div className="text-sm font-medium text-ink">{action.label}</div>
                        <div className="mt-0.5 text-xs text-ink-muted">{action.detail}</div>
                      </Link>
                      <div className="mt-3 grid gap-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                          <input
                            value={form.owner_name}
                            onChange={(event) => updateAssignmentForm(action.key, { owner_name: event.target.value })}
                            placeholder="Owner"
                            className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                          />
                          <select
                            value={form.status}
                            onChange={(event) => updateAssignmentForm(action.key, { status: event.target.value as AssignmentFormState['status'] })}
                            className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-2">
                          <input
                            type="date"
                            value={form.due_date}
                            onChange={(event) => updateAssignmentForm(action.key, { due_date: event.target.value })}
                            className="rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                          />
                          <input
                            value={form.note}
                            onChange={(event) => updateAssignmentForm(action.key, { note: event.target.value })}
                            placeholder="Launch note"
                            className="min-w-0 rounded-md border border-border px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-ink-faint">
                            {action.assignment ? `Assigned ${new Date(action.assignment.assigned_at).toLocaleDateString()}` : 'No owner assigned'}
                          </span>
                          <button
                            type="button"
                            onClick={() => submitAssignment(action)}
                            disabled={!form.owner_name.trim() || assignmentMutation.isPending}
                            className="rounded-md bg-accent text-accent-on px-2.5 py-1.5 text-xs font-medium hover:bg-accent-hover disabled:opacity-60"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {rehearsal.recommended_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-ink-faint">No rehearsal blockers.</div>
                )}
              </div>
            </aside>
          </div>
          {(rehearsalSnapshots?.data ?? []).length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <div className="mb-2 text-meta font-medium text-ink-faint">Saved rehearsal evidence</div>
              <div className="grid gap-2 md:grid-cols-3">
                {(rehearsalSnapshots?.data ?? []).slice(0, 3).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-md border border-border bg-canvas p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{snapshot.score}%</span>
                      <StatusBadge ok={snapshot.rehearsal_ready} label={snapshot.status} />
                    </div>
                    <div className="mt-1 text-xs text-ink-muted">{snapshot.blocking_count} blocker(s), {snapshot.warning_count} warning(s)</div>
                    <div className="mt-1 text-[11px] text-ink-faint">{new Date(snapshot.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Server className="h-4 w-4 text-accent" />
            Core Infrastructure
          </div>
          <div className="mt-4 space-y-2">
            {coreChecks.map(([key, check]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-canvas px-3 py-2 text-sm">
                <span className="capitalize text-ink-secondary">{key.replace('_', ' ')}</span>
                <StatusBadge ok={check.ok} label={check.ok ? 'Ready' : check.error ?? 'Degraded'} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-canvas-raised p-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <PlugZap className="h-4 w-4 text-accent" />
            External Integrations
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {integrations.map(([key, check]) => (
              <div key={key} className="rounded-md border border-border bg-canvas p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-ink">{key.replace('_', ' ')}</span>
                  <StatusBadge ok={check.ok} label={check.configured ? 'Configured' : 'Demo'} />
                </div>
                <div className="mt-2 font-mono text-xs text-ink-muted">{check.env_var}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Incident Register</h2>
            <p className="text-xs text-ink-muted">Readiness blockers, failed vendor events, and launch evidence gaps with owners</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge ok={(incidents?.critical_count ?? 0) === 0} label={`${incidents?.critical_count ?? 0} critical`} />
            <button
              onClick={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
              Snapshot
            </button>
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-border">
          {(incidents?.data ?? []).slice(0, 8).map((incident) => (
            <div key={incident.key} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[12rem_minmax(0,1fr)_10rem]">
              <div>
                <div className="font-medium text-ink">{incident.title}</div>
                <div className="mt-1 text-xs capitalize text-ink-muted">{incident.source.replace('_', ' ')} · {incident.status.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-ink-secondary">{incident.detail}</div>
                <div className="mt-1 text-xs text-ink-muted">{incident.recommended_action}</div>
              </div>
              <div className="flex items-start justify-between gap-2 md:justify-end">
                <span className={`rounded-md border px-2 py-1 text-xs font-medium ${incident.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                  {incident.count} {incident.severity}
                </span>
                <span className="rounded-md border border-border bg-canvas px-2 py-1 text-xs capitalize text-ink-secondary">{incident.owner_role}</span>
              </div>
            </div>
          ))}
          {(incidents?.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-ink-faint">No open operational incidents.</div>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {(snapshots?.data ?? []).slice(0, 4).map((snapshot) => (
          <div key={snapshot.id} className="rounded-md border border-border bg-canvas-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink">Readiness Snapshot</div>
              <StatusBadge ok={snapshot.operational_status === 'ok'} label={snapshot.operational_status} />
            </div>
            <div className="mt-3 font-serif text-2xl font-medium text-ink">{snapshot.launch_score}%</div>
            <div className="mt-1 text-xs text-ink-muted">{snapshot.incident_count} incidents · {snapshot.critical_count} critical</div>
            <div className="mt-2 text-[11px] text-ink-faint">{new Date(snapshot.created_at).toLocaleString()}</div>
          </div>
        ))}
        {(snapshots?.data ?? []).length === 0 && (
          <div className="rounded-md border border-border bg-canvas-raised p-4 text-sm text-ink-faint md:col-span-4">
            No readiness snapshots have been captured yet.
          </div>
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="rounded-md border border-border bg-canvas-raised">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Incident Timeline</h2>
              <p className="text-xs text-ink-muted">{incidentTimeline?.total ?? 0} recent signal(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge ok={(incidentTimeline?.critical_count ?? 0) === 0} label={`${incidentTimeline?.critical_count ?? 0} critical`} />
              <StatusBadge ok={(incidentTimeline?.warning_count ?? 0) === 0} label={`${incidentTimeline?.warning_count ?? 0} warning`} />
            </div>
          </div>
          <div className="divide-y divide-border">
            {(incidentTimeline?.data ?? []).slice(0, 8).map((item) => (
              <Link key={`${item.key}:${item.occurred_at}:${item.entity_id ?? ''}`} to={item.route} className="grid gap-3 px-4 py-3 text-sm hover:bg-canvas-sunk/50 md:grid-cols-[10rem_minmax(0,1fr)_8rem]">
                <div>
                  <div className="font-medium text-ink">{item.title}</div>
                  <div className="mt-1 text-xs capitalize text-ink-muted">{item.category} · {item.source.replace('_', ' ')}</div>
                </div>
                <div className="text-ink-secondary">
                  {item.detail}
                  <div className="mt-1 text-xs text-ink-faint">{new Date(item.occurred_at).toLocaleString()}</div>
                </div>
                <div className="flex items-start justify-end">
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${item.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>{item.severity}</span>
                </div>
              </Link>
            ))}
            {(incidentTimeline?.data ?? []).length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-ink-faint">No incident timeline signals.</div>
            )}
          </div>
        </div>
        <aside className="rounded-md border border-border bg-canvas-raised">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Alert Rules</h2>
            <p className="text-xs text-ink-muted">{alertRules?.triggered_count ?? 0} triggered of {alertRules?.total ?? 0}</p>
          </div>
          <div className="divide-y divide-border">
            {(alertRules?.data ?? []).map((rule) => (
              <Link key={rule.key} to={rule.route} className="block px-4 py-3 hover:bg-canvas-sunk/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{rule.label}</div>
                    <div className="mt-1 text-xs text-ink-muted">{rule.detail}</div>
                    <div className="mt-1 text-[11px] text-ink-faint">{rule.last_triggered_at ? new Date(rule.last_triggered_at).toLocaleString() : 'No trigger timestamp'}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${rule.status === 'clear' ? 'border-accent-soft bg-accent-soft text-accent' : rule.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {rule.status === 'clear' ? 'clear' : `${rule.count} ${rule.severity}`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <Download className="h-4 w-4 text-accent" />
          <div className="mt-3 text-sm font-semibold text-ink">Audit export</div>
          <div className="mt-1 text-xs text-ink-muted">Download scoped audit CSV for compliance review</div>
          <div className="mt-3 grid gap-2">
            <input placeholder="Event type" value={auditExport.event_type} onChange={(event) => setAuditExport({ ...auditExport, event_type: event.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-xs" />
            <input placeholder="Entity type" value={auditExport.entity_type} onChange={(event) => setAuditExport({ ...auditExport, entity_type: event.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-xs" />
            <input placeholder="Entity ID" value={auditExport.entity_id} onChange={(event) => setAuditExport({ ...auditExport, entity_id: event.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-xs" />
            <select value={auditExport.limit} onChange={(event) => setAuditExport({ ...auditExport, limit: event.target.value })} className="rounded-md border border-border-strong px-2 py-1.5 text-xs">
              <option value="1000">1,000 rows</option>
              <option value="10000">10,000 rows</option>
              <option value="50000">50,000 rows</option>
            </select>
            <a href={auditExportHref} className="rounded-md bg-accent text-accent-on px-3 py-2 text-center text-xs font-medium hover:bg-accent-hover">Export CSV</a>
          </div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <ShieldCheck className="h-4 w-4 text-accent" />
          <div className="mt-3 text-sm font-semibold text-ink">PHI access controls</div>
          <div className="mt-1 text-xs text-ink-muted">Patient document access uses expiring viewer metadata</div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <ClipboardList className="h-4 w-4 text-accent" />
          <div className="mt-3 text-sm font-semibold text-ink">Launch checklist</div>
          <div className="mt-1 text-xs text-ink-muted">Production readiness tracked in operations docs</div>
        </div>
      </section>

      {auditReviewSummary && (
        <section className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-ink">Audit Review Control</div>
              <div className="mt-1 text-xs text-ink-muted">{auditReviewSummary.sensitive_event_count} sensitive event{auditReviewSummary.sensitive_event_count === 1 ? '' : 's'} across {auditReviewSummary.total_event_count} total audit rows</div>
            </div>
            <span className={`rounded-md border px-2 py-1 text-xs font-medium ${auditReviewSummary.sensitive_event_count ? 'border-warn/20 bg-warn/10 text-warn' : 'border-accent-soft bg-accent-soft text-accent'}`}>
              {auditReviewSummary.recommended_actions.length} action{auditReviewSummary.recommended_actions.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {auditReviewSummary.categories.map((category) => (
              <div key={category.key} className="rounded-md border border-border bg-canvas px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-serif text-2xl font-medium text-ink">{category.count}</div>
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${category.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : category.severity === 'warning' ? 'border-warn/20 bg-warn/10 text-warn' : 'border-accent-soft bg-accent-soft text-accent'}`}>
                    {category.severity}
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-ink-secondary">{category.label}</div>
                <div className="mt-1 text-[11px] text-ink-faint">{category.last_event_at ? new Date(category.last_event_at).toLocaleString() : 'No events'}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {auditReviewSummary.recommended_actions.slice(0, 4).map((action) => (
              <div key={action.key} className="rounded-md border border-border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-ink">{action.label}</div>
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${action.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    {action.severity}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-muted">{action.detail}</div>
              </div>
            ))}
            {auditReviewSummary.recommended_actions.length === 0 && (
              <div className="rounded-md border border-accent-soft bg-accent-soft px-3 py-2 text-sm text-accent">No sensitive audit review actions are currently open.</div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-md border border-border bg-canvas-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Communications Governance</div>
            <div className="mt-1 text-xs text-ink-muted">Patient outreach requires channel consent and available contact details before delivery is queued</div>
          </div>
          <StatusBadge ok={(outreachSummary?.blocked_count ?? 0) === 0} label={`${outreachSummary?.blocked_count ?? 0} blocked`} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {[
            ['Queued', outreachSummary?.queued_count ?? 0],
            ['Delivered', outreachSummary?.delivered_count ?? 0],
            ['Failed', outreachSummary?.failed_count ?? 0],
            ['Consent blocked', outreachSummary?.consent_blocked_count ?? 0],
            ['No contact', outreachSummary?.no_contact_blocked_count ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-canvas px-3 py-2">
              <div className="font-serif text-2xl font-medium text-ink">{value}</div>
              <div className="text-xs text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="text-sm font-semibold text-ink">Patient Intake</div>
          <div className="mt-3 font-serif text-2xl font-medium text-ink">{analytics?.front_office.intake_needing_review ?? 0}</div>
          <div className="text-xs text-ink-muted">portal submissions needing review</div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="text-sm font-semibold text-ink">Billing Work</div>
          <div className="mt-3 font-serif text-2xl font-medium text-ink">{analytics?.billing.draft_cases ?? 0}</div>
          <div className="text-xs text-ink-muted">{analytics?.billing.denied_cases ?? 0} denied cases</div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="text-sm font-semibold text-ink">Security Policy</div>
          <div className="mt-3 font-serif text-2xl font-medium text-ink">{sessionPolicy?.access_token_expire_minutes ?? '—'}m</div>
          <div className="text-xs text-ink-muted">{sessionPolicy?.mfa_required ? 'MFA required' : 'MFA staged for production'}</div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="text-sm font-semibold text-ink">Assistant Governance</div>
          <div className="mt-3 font-serif text-2xl font-medium text-ink">{assistantEvents?.total ?? 0}</div>
          <div className="text-xs text-ink-muted">confirmed task actions audited</div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">Billing Claim Governance</div>
            <div className="mt-1 text-xs text-ink-muted">Claim submission is gated by payer, coding, eligibility, and denial rework status</div>
          </div>
          <StatusBadge ok={(billingWorkQueue?.eligibility_needed_count ?? 0) === 0 && (billingWorkQueue?.missing_coding_count ?? 0) === 0} label={`${billingWorkQueue?.total ?? 0} cases`} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          {[
            ['Ready', billingWorkQueue?.ready_count ?? 0],
            ['Submitted', billingWorkQueue?.submitted_count ?? 0],
            ['Denial rework', billingWorkQueue?.denial_rework_count ?? 0],
            ['Eligibility needed', billingWorkQueue?.eligibility_needed_count ?? 0],
            ['Remit pending', billingWorkQueue?.remittance_pending_count ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-canvas px-3 py-2">
              <div className="font-serif text-2xl font-medium text-ink">{value}</div>
              <div className="text-xs text-ink-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised p-4">
        <div className="text-sm font-semibold text-ink">Integration Capability Map</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          {Object.entries(capabilities ?? {}).map(([key, capability]) => (
            <div key={key} className="rounded-md border border-border bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize text-ink">{key.replace('_', ' ')}</span>
                <StatusBadge ok={capability.configured} label={capability.configured ? 'Live' : 'Staged'} />
              </div>
              <div className="mt-2 text-xs text-ink-muted">{capability.supports.join(', ')}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-md border border-border bg-canvas-raised p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ClipboardList className="h-4 w-4 text-accent" />
            Deployment Readiness
          </div>
          <div className="mt-4 space-y-2">
            {deployment.map(([key, check]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2 text-sm">
                <div>
                  <div className="capitalize text-ink-secondary">{key.replaceAll('_', ' ')}</div>
                  {check.path && <div className="font-mono text-[11px] text-ink-faint">{check.path}</div>}
                </div>
                <StatusBadge ok={check.ok} label={check.ok ? 'Found' : 'Missing'} />
              </div>
            ))}
            {deployment.length === 0 && <div className="text-sm text-ink-faint">Deployment checks are not available.</div>}
          </div>
        </div>
        <div className="rounded-md border border-border bg-canvas-raised">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Recent PHI Access</h2>
              <p className="text-xs text-ink-muted">Document viewer access reasons and timestamps</p>
            </div>
            <ShieldCheck className="h-4 w-4 text-ink-faint" />
          </div>
          <div className="divide-y divide-border">
            {(auditEvents?.data ?? []).map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_12rem]">
                <div>
                  <div className="font-medium text-ink">{String(event.payload?.document_title ?? event.entity_id)}</div>
                  {typeof event.payload?.reason === 'string' && <div className="mt-1 text-xs text-ink-secondary">{event.payload.reason}</div>}
                </div>
                <div className="text-xs text-ink-muted md:text-right">{new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(auditEvents?.data ?? []).length === 0 && <div className="px-4 py-8 text-center text-sm text-ink-faint">No PHI access events recorded yet.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border bg-canvas-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Integration Events</h2>
            <p className="text-xs text-ink-muted">{failedEvents.length} failed event{failedEvents.length === 1 ? '' : 's'} ready for review</p>
          </div>
          <ShieldCheck className="h-4 w-4 text-ink-faint" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas-sunk border-b border-border text-left text-meta font-medium text-ink-muted uppercase">
              <tr>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase">Integration</th>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase">Action</th>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase">Status</th>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase">Attempts</th>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase">Created</th>
                <th className="px-4 py-3 text-meta font-medium text-ink-muted uppercase" />
              </tr>
            </thead>
            <tbody>
              {(events?.data ?? []).map((event) => (
                <tr key={event.id} className="border-b border-border-subtle hover:bg-canvas-sunk/50">
                  <td className="px-4 py-3 font-medium text-ink">{event.integration.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-ink-secondary">{event.action}</td>
                  <td className="px-4 py-3"><StatusBadge ok={event.status === 'succeeded'} label={event.status} /></td>
                  <td className="px-4 py-3 text-ink-secondary">{event.attempts}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(event.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {event.status === 'failed' && (
                      <button
                        onClick={() => retryMutation.mutate(event.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-canvas-raised px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(events?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-faint">
                    No integration events yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <button
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
        }}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh operations status
      </button>
    </div>
  );
}

function csvCell(value: string) {
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
