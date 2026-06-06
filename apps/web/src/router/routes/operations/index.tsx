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
import { ROUTES, type AnalyticsSummary, type AuditEvent, type BillingWorkQueue, type BrowserQaChecklist, type BrowserQaSession, type BrowserQaSessionList, type BrowserQaSessionStart, type BrowserQaSessionUpdate, type CutoverRunbook, type CutoverRunbookSession, type CutoverRunbookSessionList, type CutoverRunbookSessionStart, type CutoverRunbookSessionUpdate, type GoLiveAttestation, type GoLiveAttestationCreate, type GoLivePacket, type IntegrationCapabilities, type LaunchWorkplan, type LaunchWorkplanSnapshot, type LaunchWorkplanSnapshotList, type LiveUseRehearsal, type OperatorHealth, type OperationsIncidentList, type PolicyApprovalChecklist, type PolicyApprovalSession, type PolicyApprovalSessionList, type PolicyApprovalSessionStart, type PolicyApprovalSessionUpdate, type ProductionConfigAudit, type ProductionRehearsalReport, type ProductionRehearsalSnapshot, type ProductionRehearsalSnapshotList, type ReadinessSnapshot, type ReadinessSnapshotList, type RehearsalAction, type RehearsalActionAssignmentUpdate, type RoleDryRunChecklistList, type RoleDryRunSession, type RoleDryRunSessionList, type RoleDryRunSessionStart, type RoleDryRunSessionUpdate, type SessionPolicy, type StaffTrainingChecklist, type StaffTrainingSession, type StaffTrainingSessionList, type StaffTrainingSessionStart, type StaffTrainingSessionUpdate, type TaskOutreachSummary } from '@concierge-os/shared';

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

type CutoverStepFormState = {
  step_status: NonNullable<CutoverRunbookSessionUpdate['step_status']>;
  owner_name: string;
  step_note: string;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
      ok
        ? 'border-accent-200 bg-accent-50 text-accent-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
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
  const [dryRunSessionForm, setDryRunSessionForm] = useState<RoleDryRunSessionStart>({ session_name: 'Clinic dry run', note: '' });
  const [dryRunItemForms, setDryRunItemForms] = useState<Record<string, DryRunItemFormState>>({});
  const [browserQaSessionForm, setBrowserQaSessionForm] = useState<BrowserQaSessionStart>({ session_name: 'Browser QA run', browser: 'Chrome', note: '' });
  const [browserQaItemForms, setBrowserQaItemForms] = useState<Record<string, BrowserQaItemFormState>>({});
  const [staffTrainingSessionForm, setStaffTrainingSessionForm] = useState<StaffTrainingSessionStart>({ session_name: 'Staff training', trainer_name: '', note: '' });
  const [staffTrainingItemForms, setStaffTrainingItemForms] = useState<Record<string, StaffTrainingItemFormState>>({});
  const [policyApprovalSessionForm, setPolicyApprovalSessionForm] = useState<PolicyApprovalSessionStart>({ session_name: 'Policy approval', reviewer_name: '', note: '' });
  const [policyApprovalItemForms, setPolicyApprovalItemForms] = useState<Record<string, PolicyApprovalItemFormState>>({});
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
          <p className="text-sm font-medium text-clinic-500">System readiness</p>
          <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Operations</h1>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge ok={ready?.status === 'ok'} label={`Core ${ready?.status ?? 'checking'}`} />
          <StatusBadge ok={ready?.operational_status === 'ok'} label={`Operational ${ready?.operational_status ?? 'checking'}`} />
        </div>
      </header>

      {liveUseRehearsal && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
                <ShieldCheck className="h-4 w-4 text-accent-600" />
                Live-Use Rehearsal Board
              </h2>
              <p className="text-xs text-clinic-500">{new Date(liveUseRehearsal.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${liveUseRehearsal.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : liveUseRehearsal.status === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {liveUseRehearsal.status}
              </span>
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{liveUseRehearsal.score}%</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{liveUseRehearsal.summary.blocking_gates ?? 0} blockers</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{liveUseRehearsal.summary.warning_gates ?? 0} warnings</span>
              <a
                href={ROUTES.OPERATIONS_LIVE_USE_REHEARSAL_EXPORT}
                download="concierge-os-live-use-rehearsal.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-clinic-300 px-3 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
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
                  <div key={label} className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="text-[11px] font-semibold uppercase text-clinic-400">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-clinic-900">{value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {liveUseRehearsal.gates.map((gate) => (
                  <Link key={gate.key} to={gate.route} className="rounded-md border border-clinic-200 p-3 hover:bg-clinic-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-clinic-900">{gate.label}</div>
                        <div className="mt-1 text-xs text-clinic-500">{gate.detail}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${gate.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : gate.status === 'blocking' || gate.status === 'missing' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {gate.status}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-clinic-400">{gate.captured_at ? new Date(gate.captured_at).toLocaleString() : 'No capture timestamp'}</div>
                  </Link>
                ))}
              </div>
            </div>
            <aside className="rounded-md border border-clinic-200">
              <div className="border-b border-clinic-200 px-3 py-2 text-xs font-semibold uppercase text-clinic-500">Next actions</div>
              <div className="divide-y divide-clinic-100">
                {liveUseRehearsal.next_actions.slice(0, 6).map((action) => (
                  <Link key={action.key} to={action.route} className="block px-3 py-2 hover:bg-clinic-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-clinic-900">{action.label}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${action.severity === 'blocking' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{action.severity}</span>
                    </div>
                    <div className="mt-1 text-xs text-clinic-500">{action.detail}</div>
                  </Link>
                ))}
                {liveUseRehearsal.next_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-clinic-400">No rehearsal actions.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {operatorHealth && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
                <Activity className="h-4 w-4 text-accent-600" />
                Operator Health
              </h2>
              <p className="text-xs text-clinic-500">{new Date(operatorHealth.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${operatorHealth.status === 'healthy' ? 'border-accent-200 bg-accent-50 text-accent-800' : operatorHealth.status === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {operatorHealth.status}
              </span>
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{operatorHealth.score}%</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{operatorHealth.summary.critical_checks ?? 0} critical</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{operatorHealth.summary.warning_checks ?? 0} warning</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {operatorHealth.checks.map((check) => (
                <Link key={check.key} to={check.route} className="rounded-md border border-clinic-200 bg-clinic-50 p-3 hover:bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-clinic-900">{check.label}</div>
                      <div className="mt-1 text-xs text-clinic-500">{check.detail}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${check.status === 'healthy' ? 'border-accent-200 bg-accent-50 text-accent-800' : check.status === 'warning' || check.status === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      {check.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-clinic-400">
                    <span>{check.score}%</span>
                    <span>{check.last_seen_at ? new Date(check.last_seen_at).toLocaleString() : 'No evidence'}</span>
                  </div>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-clinic-200">
              <div className="border-b border-clinic-200 px-3 py-2 text-xs font-semibold uppercase text-clinic-500">Operator actions</div>
              <div className="divide-y divide-clinic-100">
                {operatorHealth.recommended_actions.slice(0, 5).map((action) => (
                  <Link key={action.key} to={action.route} className="block px-3 py-2 hover:bg-clinic-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-clinic-900">{action.label}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${action.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{action.severity}</span>
                    </div>
                    <div className="mt-1 text-xs text-clinic-500">{action.detail}</div>
                  </Link>
                ))}
                {operatorHealth.recommended_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-clinic-400">No operator actions.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {productionConfigAudit && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
                <LockKeyhole className="h-4 w-4 text-accent-600" />
                Production Config Audit
              </h2>
              <p className="text-xs text-clinic-500">{productionConfigAudit.environment} · {new Date(productionConfigAudit.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${productionConfigAudit.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : productionConfigAudit.status === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                {productionConfigAudit.status}
              </span>
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{productionConfigAudit.score}%</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{productionConfigAudit.critical_count} critical</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{productionConfigAudit.warning_count} warning</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {productionConfigAudit.checks.map((check) => (
              <div key={check.key} className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-clinic-900">{check.label}</div>
                    <div className="mt-1 text-xs text-clinic-500">{check.detail}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${check.ready ? 'border-accent-200 bg-accent-50 text-accent-800' : check.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {check.ready ? 'ready' : check.severity}
                  </span>
                </div>
                <div className="mt-2 text-xs text-clinic-600">{check.action}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {check.env_vars.map((envVar) => (
                    <span key={envVar} className="rounded-md border border-clinic-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-clinic-500">{envVar}</span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-clinic-400">{check.docs.join(' · ')}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {goLivePacket && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-900">Go-Live Packet</h2>
              <p className="text-xs text-clinic-500">{goLivePacket.environment} · {new Date(goLivePacket.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={goLivePacket.go_live_ready} label={goLivePacket.go_live_ready ? 'Ready' : 'Attention'} />
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{goLivePacket.launch_score}% launch</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{goLivePacket.blocking_count} blocking</span>
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{goLivePacket.evidence_ready_count}/{goLivePacket.evidence_total} evidence</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {goLivePacket.evidence.map((item) => (
                <Link key={item.key} to={item.route} className="rounded-md border border-clinic-100 bg-clinic-50 p-3 hover:bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-clinic-900">{item.label}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${item.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : item.status === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-clinic-500">{item.detail}</div>
                  {item.captured_at && <div className="mt-1 text-[11px] text-clinic-400">{new Date(item.captured_at).toLocaleString()}</div>}
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-clinic-200">
              <div className="border-b border-clinic-200 px-3 py-2 text-xs font-semibold uppercase text-clinic-500">Manager sign-off</div>
              <div className="space-y-2 border-b border-clinic-100 px-3 py-3">
                <select
                  value={attestationForm.decision}
                  onChange={(event) => setAttestationForm((current) => ({ ...current, decision: event.target.value as GoLiveAttestationCreate['decision'] }))}
                  className="w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                >
                  <option value="needs_changes">Needs changes</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <textarea
                  value={attestationForm.note}
                  onChange={(event) => setAttestationForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Review note"
                  rows={3}
                  className="w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => attestationMutation.mutate({ decision: attestationForm.decision, note: attestationForm.note.trim() || null })}
                  disabled={attestationMutation.isPending}
                  className="w-full rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
                >
                  Record sign-off
                </button>
                {goLivePacket.latest_attestation && (
                  <div className="rounded-md border border-clinic-200 bg-clinic-50 p-2 text-xs text-clinic-500">
                    <div className="font-medium text-clinic-800">{goLivePacket.latest_attestation.decision.replace('_', ' ')}</div>
                    <div className="mt-1">{goLivePacket.latest_attestation.reviewer_name ?? 'Reviewer'} · {new Date(goLivePacket.latest_attestation.created_at).toLocaleString()}</div>
                    {goLivePacket.latest_attestation.note && <div className="mt-1">{goLivePacket.latest_attestation.note}</div>}
                  </div>
                )}
              </div>
              <div className="border-b border-clinic-200 px-3 py-2 text-xs font-semibold uppercase text-clinic-500">Packet blockers</div>
              <div className="divide-y divide-clinic-100">
                {goLivePacket.open_workplan_items.slice(0, 4).map((item) => (
                  <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-clinic-50">
                    <div className="text-sm font-medium text-clinic-900">{item.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{item.detail}</div>
                    <div className="mt-1 text-[11px] text-clinic-400">{item.assignment?.owner_name ?? 'Unassigned'} · {item.severity}</div>
                  </Link>
                ))}
                {goLivePacket.open_workplan_items.length === 0 && (
                  <div className="px-3 py-6 text-sm text-clinic-400">No packet blockers.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {roleChecklists && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-900">Role Dry-Run Checklists</h2>
              <p className="text-xs text-clinic-500">{roleChecklists.total_roles} role(s) · {new Date(roleChecklists.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{roleChecklists.ready_roles} ready</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{roleChecklists.attention_roles} attention</span>
            </div>
          </div>
          <div className="grid gap-3 p-4 xl:grid-cols-5">
            {roleChecklists.roles.map((role) => (
              <div key={role.key} className="rounded-md border border-clinic-200 bg-clinic-50">
                <div className="border-b border-clinic-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-clinic-900">{role.label}</h3>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${role.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{role.ready_count}/{role.total}</span>
                  </div>
                  <p className="mt-1 text-xs text-clinic-500">{role.summary}</p>
                </div>
                <div className="divide-y divide-clinic-100">
                  {role.items.map((item) => (
                    <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-clinic-800">{item.label}</span>
                        <span className={`h-2 w-2 rounded-full ${item.status === 'ready' ? 'bg-accent-500' : 'bg-amber-500'}`} />
                      </div>
                      <div className="mt-1 text-[11px] text-clinic-500">{item.detail}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Dry-Run Session Evidence</h2>
            <p className="text-xs text-clinic-500">{dryRunSessions?.total ?? 0} saved session(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeDryRunSession && (
              <>
                <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{activeDryRunSession.complete_count} complete</span>
                <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{activeDryRunSession.blocked_count} blocked</span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{activeDryRunSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <div className="text-xs font-semibold uppercase text-clinic-500">Start rehearsal</div>
              <input
                value={dryRunSessionForm.session_name ?? ''}
                onChange={(event) => setDryRunSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <textarea
                value={dryRunSessionForm.note ?? ''}
                onChange={(event) => setDryRunSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Session note"
                className="mt-2 w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startDryRunSessionMutation.mutate({
                  session_name: dryRunSessionForm.session_name?.trim() || 'Clinic dry run',
                  note: dryRunSessionForm.note?.trim() || null,
                })}
                disabled={startDryRunSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start session
              </button>
            </div>
            {activeDryRunSession && (
              <div className="rounded-md border border-clinic-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-clinic-900">{activeDryRunSession.session_name}</div>
                    <div className="mt-1 text-xs text-clinic-500">{activeDryRunSession.started_by ?? 'Staff'} · {new Date(activeDryRunSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeDryRunSession.status === 'completed' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {activeDryRunSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeDryRunSession.note && <div className="mt-2 text-xs text-clinic-500">{activeDryRunSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateDryRunSessionMutation.mutate({
                    sessionId: activeDryRunSession.session_id,
                    data: { session_status: 'completed', note: activeDryRunSession.note },
                  })}
                  disabled={activeDryRunSession.status === 'completed' || updateDryRunSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-300 px-3 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 disabled:opacity-50"
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
                <div key={role.key} className="rounded-md border border-clinic-200">
                  <div className="border-b border-clinic-200 px-3 py-2">
                    <div className="text-sm font-semibold text-clinic-900">{role.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-clinic-100">
                    {role.items.map((item) => {
                      const itemForm = formForDryRunItem(activeDryRunSession, role.key, item.key);
                      return (
                        <div key={item.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link to={item.route} className="text-xs font-medium text-clinic-900 hover:text-accent-700">{item.label}</Link>
                              <div className="mt-1 text-[11px] text-clinic-500">{item.detail}</div>
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.dry_run_status === 'complete' ? 'border-accent-200 bg-accent-50 text-accent-800' : item.dry_run_status === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>{item.dry_run_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                            <select
                              value={itemForm.dry_run_status}
                              onChange={(event) => updateDryRunItemForm(activeDryRunSession.session_id, role.key, item.key, { dry_run_status: event.target.value as DryRunItemFormState['dry_run_status'] })}
                              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="complete">Complete</option>
                              <option value="blocked">Blocked</option>
                            </select>
                            <input
                              value={itemForm.item_note}
                              onChange={(event) => updateDryRunItemForm(activeDryRunSession.session_id, role.key, item.key, { item_note: event.target.value })}
                              placeholder="Evidence note"
                              className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitDryRunItem(activeDryRunSession, role.key, item.key)}
                              disabled={updateDryRunSessionMutation.isPending}
                              className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-clinic-200 text-sm text-clinic-400">
              Start a dry-run session to capture role evidence.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Browser QA Evidence</h2>
            <p className="text-xs text-clinic-500">{browserQaSessions?.total ?? 0} saved session(s) · {browserQaChecklist?.total ?? 0} checklist item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeBrowserQaSession && (
              <>
                <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{activeBrowserQaSession.passed_count} passed</span>
                <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{activeBrowserQaSession.failed_count} failed</span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{activeBrowserQaSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <div className="text-xs font-semibold uppercase text-clinic-500">Start QA run</div>
              <input
                value={browserQaSessionForm.session_name ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <input
                value={browserQaSessionForm.browser ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, browser: event.target.value }))}
                placeholder="Browser"
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <textarea
                value={browserQaSessionForm.note ?? ''}
                onChange={(event) => setBrowserQaSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="QA note"
                className="mt-2 w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startBrowserQaSessionMutation.mutate({
                  session_name: browserQaSessionForm.session_name?.trim() || 'Browser QA run',
                  browser: browserQaSessionForm.browser?.trim() || null,
                  note: browserQaSessionForm.note?.trim() || null,
                })}
                disabled={startBrowserQaSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start QA
              </button>
            </div>
            {activeBrowserQaSession && (
              <div className="rounded-md border border-clinic-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-clinic-900">{activeBrowserQaSession.session_name}</div>
                    <div className="mt-1 text-xs text-clinic-500">{activeBrowserQaSession.browser ?? 'Browser'} · {new Date(activeBrowserQaSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeBrowserQaSession.status === 'completed' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {activeBrowserQaSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeBrowserQaSession.note && <div className="mt-2 text-xs text-clinic-500">{activeBrowserQaSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateBrowserQaSessionMutation.mutate({
                    sessionId: activeBrowserQaSession.session_id,
                    data: { session_status: 'completed', note: activeBrowserQaSession.note },
                  })}
                  disabled={activeBrowserQaSession.status === 'completed' || updateBrowserQaSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-300 px-3 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 disabled:opacity-50"
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
                  <div key={item.key} className="rounded-md border border-clinic-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={item.route} className="text-sm font-medium text-clinic-900 hover:text-accent-700">{item.label}</Link>
                        <div className="mt-1 text-xs text-clinic-500">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-clinic-400">{item.category}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.qa_status === 'passed' ? 'border-accent-200 bg-accent-50 text-accent-800' : item.qa_status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>{item.qa_status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                      <select
                        value={itemForm.qa_status}
                        onChange={(event) => updateBrowserQaItemForm(activeBrowserQaSession.session_id, item.key, { qa_status: event.target.value as BrowserQaItemFormState['qa_status'] })}
                        className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                      </select>
                      <input
                        value={itemForm.item_note}
                        onChange={(event) => updateBrowserQaItemForm(activeBrowserQaSession.session_id, item.key, { item_note: event.target.value })}
                        placeholder="Evidence note"
                        className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitBrowserQaItem(activeBrowserQaSession, item.key)}
                        disabled={updateBrowserQaSessionMutation.isPending}
                        className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
                <Link key={item.key} to={item.route} className="rounded-md border border-clinic-200 bg-clinic-50 p-3 hover:bg-white">
                  <div className="text-sm font-medium text-clinic-900">{item.label}</div>
                  <div className="mt-1 text-xs text-clinic-500">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-clinic-400">{item.category}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Staff Training Evidence</h2>
            <p className="text-xs text-clinic-500">{staffTrainingSessions?.total ?? 0} saved session(s) · {staffTrainingChecklist?.total_items ?? 0} training item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeStaffTrainingSession && (
              <>
                <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{activeStaffTrainingSession.signed_count} signed</span>
                <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">{activeStaffTrainingSession.reviewed_count} reviewed</span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{activeStaffTrainingSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <div className="text-xs font-semibold uppercase text-clinic-500">Start training</div>
              <input
                value={staffTrainingSessionForm.session_name ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <input
                value={staffTrainingSessionForm.trainer_name ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, trainer_name: event.target.value }))}
                placeholder="Trainer"
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <textarea
                value={staffTrainingSessionForm.note ?? ''}
                onChange={(event) => setStaffTrainingSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Training note"
                className="mt-2 w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startStaffTrainingSessionMutation.mutate({
                  session_name: staffTrainingSessionForm.session_name?.trim() || 'Staff training',
                  trainer_name: staffTrainingSessionForm.trainer_name?.trim() || null,
                  note: staffTrainingSessionForm.note?.trim() || null,
                })}
                disabled={startStaffTrainingSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start training
              </button>
            </div>
            {activeStaffTrainingSession && (
              <div className="rounded-md border border-clinic-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-clinic-900">{activeStaffTrainingSession.session_name}</div>
                    <div className="mt-1 text-xs text-clinic-500">{activeStaffTrainingSession.trainer_name ?? activeStaffTrainingSession.started_by ?? 'Trainer'} · {new Date(activeStaffTrainingSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeStaffTrainingSession.status === 'completed' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {activeStaffTrainingSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activeStaffTrainingSession.note && <div className="mt-2 text-xs text-clinic-500">{activeStaffTrainingSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updateStaffTrainingSessionMutation.mutate({
                    sessionId: activeStaffTrainingSession.session_id,
                    data: { session_status: 'completed', note: activeStaffTrainingSession.note },
                  })}
                  disabled={activeStaffTrainingSession.status === 'completed' || updateStaffTrainingSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-300 px-3 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 disabled:opacity-50"
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
                <div key={role.key} className="rounded-md border border-clinic-200">
                  <div className="border-b border-clinic-200 px-3 py-2">
                    <div className="text-sm font-semibold text-clinic-900">{role.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-clinic-100">
                    {role.items.map((item) => {
                      const itemForm = formForStaffTrainingItem(activeStaffTrainingSession, role.key, item.key);
                      return (
                        <div key={item.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <Link to={item.route} className="text-xs font-medium text-clinic-900 hover:text-accent-700">{item.label}</Link>
                              <div className="mt-1 text-[11px] text-clinic-500">{item.detail}</div>
                              <div className="mt-1 text-[11px] text-clinic-400">{item.category}</div>
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.training_status === 'signed' ? 'border-accent-200 bg-accent-50 text-accent-800' : item.training_status === 'reviewed' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>{item.training_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                            <select
                              value={itemForm.training_status}
                              onChange={(event) => updateStaffTrainingItemForm(activeStaffTrainingSession.session_id, role.key, item.key, { training_status: event.target.value as StaffTrainingItemFormState['training_status'] })}
                              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="signed">Signed</option>
                            </select>
                            <input
                              value={itemForm.item_note}
                              onChange={(event) => updateStaffTrainingItemForm(activeStaffTrainingSession.session_id, role.key, item.key, { item_note: event.target.value })}
                              placeholder="Training evidence"
                              className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitStaffTrainingItem(activeStaffTrainingSession, role.key, item.key)}
                              disabled={updateStaffTrainingSessionMutation.isPending}
                              className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
                <div key={role.key} className="rounded-md border border-clinic-200 bg-clinic-50">
                  <div className="border-b border-clinic-200 px-3 py-2">
                    <div className="text-sm font-semibold text-clinic-900">{role.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{role.summary}</div>
                  </div>
                  <div className="divide-y divide-clinic-100">
                    {role.items.map((item) => (
                      <Link key={item.key} to={item.route} className="block px-3 py-2 hover:bg-white">
                        <div className="text-xs font-medium text-clinic-900">{item.label}</div>
                        <div className="mt-1 text-[11px] text-clinic-500">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-clinic-400">{item.category}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Policy Approval Evidence</h2>
            <p className="text-xs text-clinic-500">{policyApprovalSessions?.total ?? 0} saved session(s) · {policyApprovalChecklist?.total ?? 0} policy item(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activePolicyApprovalSession && (
              <>
                <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{activePolicyApprovalSession.approved_count} approved</span>
                <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{activePolicyApprovalSession.needs_changes_count} needs changes</span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{activePolicyApprovalSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <div className="text-xs font-semibold uppercase text-clinic-500">Start policy review</div>
              <input
                value={policyApprovalSessionForm.session_name ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <input
                value={policyApprovalSessionForm.reviewer_name ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, reviewer_name: event.target.value }))}
                placeholder="Reviewer"
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <textarea
                value={policyApprovalSessionForm.note ?? ''}
                onChange={(event) => setPolicyApprovalSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Policy review note"
                className="mt-2 w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => startPolicyApprovalSessionMutation.mutate({
                  session_name: policyApprovalSessionForm.session_name?.trim() || 'Policy approval',
                  reviewer_name: policyApprovalSessionForm.reviewer_name?.trim() || null,
                  note: policyApprovalSessionForm.note?.trim() || null,
                })}
                disabled={startPolicyApprovalSessionMutation.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start review
              </button>
            </div>
            {activePolicyApprovalSession && (
              <div className="rounded-md border border-clinic-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-clinic-900">{activePolicyApprovalSession.session_name}</div>
                    <div className="mt-1 text-xs text-clinic-500">{activePolicyApprovalSession.reviewer_name ?? activePolicyApprovalSession.started_by ?? 'Reviewer'} · {new Date(activePolicyApprovalSession.started_at).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activePolicyApprovalSession.status === 'completed' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {activePolicyApprovalSession.status.replace('_', ' ')}
                  </span>
                </div>
                {activePolicyApprovalSession.note && <div className="mt-2 text-xs text-clinic-500">{activePolicyApprovalSession.note}</div>}
                <button
                  type="button"
                  onClick={() => updatePolicyApprovalSessionMutation.mutate({
                    sessionId: activePolicyApprovalSession.session_id,
                    data: { session_status: 'completed', note: activePolicyApprovalSession.note },
                  })}
                  disabled={activePolicyApprovalSession.status === 'completed' || updatePolicyApprovalSessionMutation.isPending}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-300 px-3 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 disabled:opacity-50"
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
                  <div key={item.key} className="rounded-md border border-clinic-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link to={item.route} className="text-sm font-medium text-clinic-900 hover:text-accent-700">{item.label}</Link>
                        <div className="mt-1 text-xs text-clinic-500">{item.detail}</div>
                        <div className="mt-1 text-[11px] text-clinic-400">{item.category} · {item.docs.join(', ')}</div>
                      </div>
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.approval_status === 'approved' ? 'border-accent-200 bg-accent-50 text-accent-800' : item.approval_status === 'needs_changes' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>{item.approval_status.replace('_', ' ')}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_4.5rem]">
                      <select
                        value={itemForm.approval_status}
                        onChange={(event) => updatePolicyApprovalItemForm(activePolicyApprovalSession.session_id, item.key, { approval_status: event.target.value as PolicyApprovalItemFormState['approval_status'] })}
                        className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="needs_changes">Needs changes</option>
                      </select>
                      <input
                        value={itemForm.item_note}
                        onChange={(event) => updatePolicyApprovalItemForm(activePolicyApprovalSession.session_id, item.key, { item_note: event.target.value })}
                        placeholder="Approval evidence"
                        className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitPolicyApprovalItem(activePolicyApprovalSession, item.key)}
                        disabled={updatePolicyApprovalSessionMutation.isPending}
                        className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
                <Link key={item.key} to={item.route} className="rounded-md border border-clinic-200 bg-clinic-50 p-3 hover:bg-white">
                  <div className="text-sm font-medium text-clinic-900">{item.label}</div>
                  <div className="mt-1 text-xs text-clinic-500">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-clinic-400">{item.category} · {item.docs.join(', ')}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Cutover Runbook</h2>
            <p className="text-xs text-clinic-500">{cutoverSessions?.total ?? 0} saved session(s) · {cutoverRunbook?.total_steps ?? 0} timed step(s)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCutoverSession && (
              <>
                <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-800">{activeCutoverSession.complete_count} complete</span>
                <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{activeCutoverSession.blocked_count} blocked</span>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{activeCutoverSession.rollback_count} rollback</span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{activeCutoverSession.pending_count} pending</span>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <div className="text-xs font-semibold uppercase text-clinic-500">Start cutover</div>
              <input
                value={cutoverSessionForm.session_name ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, session_name: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <input
                value={cutoverSessionForm.cutover_owner ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, cutover_owner: event.target.value }))}
                placeholder="Cutover owner"
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <input
                type="datetime-local"
                value={cutoverSessionForm.scheduled_for ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, scheduled_for: event.target.value }))}
                className="mt-2 w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
              />
              <textarea
                value={cutoverSessionForm.note ?? ''}
                onChange={(event) => setCutoverSessionForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                placeholder="Cutover note"
                className="mt-2 w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
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
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Play className="h-3.5 w-3.5" />
                Start cutover
              </button>
            </div>
            {activeCutoverSession && (
              <div className="space-y-3">
                <div className="rounded-md border border-clinic-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-clinic-900">{activeCutoverSession.session_name}</div>
                      <div className="mt-1 text-xs text-clinic-500">{activeCutoverSession.cutover_owner ?? activeCutoverSession.started_by ?? 'Cutover owner'} · {new Date(activeCutoverSession.started_at).toLocaleString()}</div>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${activeCutoverSession.status === 'completed' ? 'border-accent-200 bg-accent-50 text-accent-800' : activeCutoverSession.status === 'aborted' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      {activeCutoverSession.status.replace('_', ' ')}
                    </span>
                  </div>
                  {activeCutoverSession.scheduled_for && <div className="mt-2 text-xs text-clinic-500">Scheduled {new Date(activeCutoverSession.scheduled_for).toLocaleString()}</div>}
                  {activeCutoverSession.note && <div className="mt-2 text-xs text-clinic-500">{activeCutoverSession.note}</div>}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <a
                      href={ROUTES.OPERATIONS_CUTOVER_RUNBOOK_SESSION_EXPORT(activeCutoverSession.session_id)}
                      download="concierge-os-cutover-runbook.csv"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-clinic-300 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
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
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-300 px-3 py-2 text-xs font-medium text-accent-800 hover:bg-accent-50 disabled:opacity-50"
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
                      className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Abort
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-clinic-200 p-3">
                  <div className="text-xs font-semibold uppercase text-clinic-500">Rollback decision</div>
                  <div className="mt-2 grid gap-2">
                    <select
                      value={cutoverRollbackForm.rollback_status === 'not_reviewed' && activeCutoverSession.rollback_status !== 'not_reviewed' ? activeCutoverSession.rollback_status : cutoverRollbackForm.rollback_status}
                      onChange={(event) => setCutoverRollbackForm((current) => ({ ...current, rollback_status: event.target.value as NonNullable<CutoverRunbookSessionUpdate['rollback_status']> }))}
                      className="w-full rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
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
                      className="w-full resize-none rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => submitCutoverRollback(activeCutoverSession)}
                      disabled={updateCutoverSessionMutation.isPending}
                      className="rounded-md border border-clinic-300 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
                <div key={phase.key} className="rounded-md border border-clinic-200">
                  <div className="border-b border-clinic-200 px-3 py-2">
                    <div className="text-sm font-semibold text-clinic-900">{phase.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{phase.objective}</div>
                  </div>
                  <div className="divide-y divide-clinic-100">
                    {phase.steps.map((step) => {
                      const stepForm = formForCutoverStep(activeCutoverSession, phase.key, step.key);
                      return (
                        <div key={step.key} className="space-y-2 px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-medium text-clinic-900">{step.label}</div>
                              <div className="mt-1 text-[11px] text-clinic-500">{step.detail}</div>
                              <div className="mt-1 text-[11px] text-clinic-400">T{step.expected_minute >= 0 ? '+' : ''}{step.expected_minute} · {step.owner_role}</div>
                              {step.rollback_trigger && <div className="mt-1 text-[11px] text-red-600">{step.rollback_trigger}</div>}
                            </div>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${step.step_status === 'complete' ? 'border-accent-200 bg-accent-50 text-accent-800' : step.step_status === 'blocked' || step.step_status === 'rollback' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>{step.step_status}</span>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <select
                              value={stepForm.step_status}
                              onChange={(event) => updateCutoverStepForm(activeCutoverSession.session_id, phase.key, step.key, { step_status: event.target.value as CutoverStepFormState['step_status'] })}
                              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
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
                              className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem]">
                            <input
                              value={stepForm.step_note}
                              onChange={(event) => updateCutoverStepForm(activeCutoverSession.session_id, phase.key, step.key, { step_note: event.target.value })}
                              placeholder="Step evidence"
                              className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => submitCutoverStep(activeCutoverSession, phase.key, step.key)}
                              disabled={updateCutoverSessionMutation.isPending}
                              className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
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
                <div key={phase.key} className="rounded-md border border-clinic-200 bg-clinic-50">
                  <div className="border-b border-clinic-200 px-3 py-2">
                    <div className="text-sm font-semibold text-clinic-900">{phase.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{phase.objective}</div>
                  </div>
                  <div className="divide-y divide-clinic-100">
                    {phase.steps.map((step) => (
                      <div key={step.key} className="px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-clinic-900">{step.label}</div>
                            <div className="mt-1 text-[11px] text-clinic-500">{step.detail}</div>
                          </div>
                          <span className="rounded-md border border-clinic-200 bg-white px-2 py-0.5 text-[11px] font-medium text-clinic-500">T{step.expected_minute >= 0 ? '+' : ''}{step.expected_minute}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-clinic-400">{step.owner_role}</div>
                        {step.rollback_trigger && <div className="mt-1 text-[11px] text-red-600">{step.rollback_trigger}</div>}
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
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-900">Launch Workplan</h2>
              <p className="text-xs text-clinic-500">{workplan.total} open item(s) · {new Date(workplan.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge ok={workplan.status === 'clear'} label={workplan.status === 'clear' ? 'Clear' : 'Attention'} />
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{workplan.blocking_count} blocking</span>
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">{workplan.warning_count} warning</span>
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{workplan.assigned_count} assigned</span>
              <a
                href={workplanExportHref}
                download="concierge-os-launch-workplan.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-clinic-300 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
              <button
                onClick={() => workplanSnapshotMutation.mutate()}
                disabled={workplanSnapshotMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-clinic-900 px-3 py-2 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
          <div className="divide-y divide-clinic-100">
            {workplan.items.slice(0, 8).map((item) => (
              <div key={item.key} className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_11rem_8rem]">
                <Link to={item.route} className="min-w-0 hover:text-accent-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-clinic-900">{item.label}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${item.severity === 'blocking' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{item.severity}</span>
                    <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-0.5 text-[11px] font-medium text-clinic-500">{item.category}</span>
                  </div>
                  <div className="mt-1 text-xs text-clinic-500">{item.detail}</div>
                  <div className="mt-1 text-[11px] text-clinic-400">{item.recommended_action}</div>
                </Link>
                <div className="text-xs text-clinic-500">
                  <div className="font-medium text-clinic-700">{item.assignment?.owner_name ?? item.owner_role}</div>
                  <div className="mt-1">{item.assignment ? item.assignment.status.replace('_', ' ') : 'Unassigned'}</div>
                  {item.assignment?.due_date && <div className="mt-1">Due {item.assignment.due_date}</div>}
                </div>
                <Link to={item.route} className="inline-flex h-9 items-center justify-center rounded-md border border-clinic-300 px-3 text-xs font-medium text-clinic-700 hover:bg-clinic-50">
                  Open
                </Link>
              </div>
            ))}
            {workplan.items.length === 0 && (
              <div className="px-4 py-6 text-sm text-clinic-400">No launch workplan items.</div>
            )}
          </div>
          {(workplanSnapshots?.data ?? []).length > 0 && (
            <div className="border-t border-clinic-200 px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase text-clinic-500">Saved workplan evidence</div>
              <div className="grid gap-2 md:grid-cols-3">
                {(workplanSnapshots?.data ?? []).slice(0, 3).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-clinic-900">{snapshot.total} item(s)</span>
                      <StatusBadge ok={snapshot.status === 'clear'} label={snapshot.status} />
                    </div>
                    <div className="mt-1 text-xs text-clinic-500">{snapshot.blocking_count} blocking, {snapshot.unassigned_count} unassigned</div>
                    <div className="mt-1 text-[11px] text-clinic-400">{new Date(snapshot.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {rehearsal && (
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-900">Production Rehearsal</h2>
              <p className="text-xs text-clinic-500">{new Date(rehearsal.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge ok={rehearsal.rehearsal_ready} label={rehearsal.rehearsal_ready ? 'Ready' : 'Attention'} />
              <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">{rehearsal.score}%</span>
              <a
                href={rehearsalExportHref}
                download="concierge-os-production-rehearsal.csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-clinic-300 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </a>
              <button
                onClick={() => rehearsalSnapshotMutation.mutate()}
                disabled={rehearsalSnapshotMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Save
              </button>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {rehearsal.gates.map((gate) => (
                <Link key={gate.key} to={gate.route} className="rounded-md border border-clinic-100 bg-clinic-50 p-3 hover:bg-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-clinic-900">{gate.label}</span>
                    <span className={`rounded-md border px-2 py-1 text-xs font-medium ${gate.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : gate.status === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      {gate.score}%
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-clinic-500">{gate.detail}</div>
                </Link>
              ))}
            </div>
            <aside className="rounded-md border border-clinic-200">
              <div className="border-b border-clinic-200 px-3 py-2 text-xs font-semibold uppercase text-clinic-500">Rehearsal actions</div>
              <div className="divide-y divide-clinic-100">
                {rehearsal.recommended_actions.slice(0, 5).map((action) => {
                  const form = formForAction(action);
                  return (
                    <div key={action.key} className="px-3 py-3">
                      <Link to={action.route} className="block hover:text-accent-700">
                        <div className="text-sm font-medium text-clinic-900">{action.label}</div>
                        <div className="mt-0.5 text-xs text-clinic-500">{action.detail}</div>
                      </Link>
                      <div className="mt-3 grid gap-2">
                        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
                          <input
                            value={form.owner_name}
                            onChange={(event) => updateAssignmentForm(action.key, { owner_name: event.target.value })}
                            placeholder="Owner"
                            className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                          />
                          <select
                            value={form.status}
                            onChange={(event) => updateAssignmentForm(action.key, { status: event.target.value as AssignmentFormState['status'] })}
                            className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
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
                            className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                          />
                          <input
                            value={form.note}
                            onChange={(event) => updateAssignmentForm(action.key, { note: event.target.value })}
                            placeholder="Launch note"
                            className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-clinic-400">
                            {action.assignment ? `Assigned ${new Date(action.assignment.assigned_at).toLocaleDateString()}` : 'No owner assigned'}
                          </span>
                          <button
                            type="button"
                            onClick={() => submitAssignment(action)}
                            disabled={!form.owner_name.trim() || assignmentMutation.isPending}
                            className="rounded-md bg-clinic-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-clinic-800 disabled:opacity-60"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {rehearsal.recommended_actions.length === 0 && (
                  <div className="px-3 py-6 text-sm text-clinic-400">No rehearsal blockers.</div>
                )}
              </div>
            </aside>
          </div>
          {(rehearsalSnapshots?.data ?? []).length > 0 && (
            <div className="border-t border-clinic-200 px-4 py-3">
              <div className="mb-2 text-xs font-semibold uppercase text-clinic-500">Saved rehearsal evidence</div>
              <div className="grid gap-2 md:grid-cols-3">
                {(rehearsalSnapshots?.data ?? []).slice(0, 3).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-clinic-900">{snapshot.score}%</span>
                      <StatusBadge ok={snapshot.rehearsal_ready} label={snapshot.status} />
                    </div>
                    <div className="mt-1 text-xs text-clinic-500">{snapshot.blocking_count} blocker(s), {snapshot.warning_count} warning(s)</div>
                    <div className="mt-1 text-[11px] text-clinic-400">{new Date(snapshot.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <Server className="h-4 w-4 text-accent-700" />
            Core Infrastructure
          </div>
          <div className="mt-4 space-y-2">
            {coreChecks.map(([key, check]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-clinic-50 px-3 py-2 text-sm">
                <span className="capitalize text-clinic-700">{key.replace('_', ' ')}</span>
                <StatusBadge ok={check.ok} label={check.ok ? 'Ready' : check.error ?? 'Degraded'} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-clinic-200 bg-white p-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <PlugZap className="h-4 w-4 text-accent-700" />
            External Integrations
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {integrations.map(([key, check]) => (
              <div key={key} className="rounded-md border border-clinic-100 bg-clinic-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium capitalize text-clinic-800">{key.replace('_', ' ')}</span>
                  <StatusBadge ok={check.ok} label={check.configured ? 'Configured' : 'Demo'} />
                </div>
                <div className="mt-2 font-mono text-xs text-clinic-500">{check.env_var}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Incident Register</h2>
            <p className="text-xs text-clinic-500">Readiness blockers, failed vendor events, and launch evidence gaps with owners</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge ok={(incidents?.critical_count ?? 0) === 0} label={`${incidents?.critical_count ?? 0} critical`} />
            <button
              onClick={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-clinic-300 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
              Snapshot
            </button>
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-clinic-100">
          {(incidents?.data ?? []).slice(0, 8).map((incident) => (
            <div key={incident.key} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[12rem_minmax(0,1fr)_10rem]">
              <div>
                <div className="font-medium text-clinic-900">{incident.title}</div>
                <div className="mt-1 text-xs capitalize text-clinic-500">{incident.source.replace('_', ' ')} · {incident.status.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-clinic-700">{incident.detail}</div>
                <div className="mt-1 text-xs text-clinic-500">{incident.recommended_action}</div>
              </div>
              <div className="flex items-start justify-between gap-2 md:justify-end">
                <span className={`rounded-md border px-2 py-1 text-xs font-medium ${incident.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {incident.count} {incident.severity}
                </span>
                <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs capitalize text-clinic-600">{incident.owner_role}</span>
              </div>
            </div>
          ))}
          {(incidents?.data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-clinic-400">No open operational incidents.</div>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {(snapshots?.data ?? []).slice(0, 4).map((snapshot) => (
          <div key={snapshot.id} className="rounded-md border border-clinic-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-clinic-900">Readiness Snapshot</div>
              <StatusBadge ok={snapshot.operational_status === 'ok'} label={snapshot.operational_status} />
            </div>
            <div className="mt-3 text-2xl font-semibold text-clinic-900">{snapshot.launch_score}%</div>
            <div className="mt-1 text-xs text-clinic-500">{snapshot.incident_count} incidents · {snapshot.critical_count} critical</div>
            <div className="mt-2 text-[11px] text-clinic-400">{new Date(snapshot.created_at).toLocaleString()}</div>
          </div>
        ))}
        {(snapshots?.data ?? []).length === 0 && (
          <div className="rounded-md border border-clinic-200 bg-white p-4 text-sm text-clinic-400 md:col-span-4">
            No readiness snapshots have been captured yet.
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <Download className="h-4 w-4 text-accent-700" />
          <div className="mt-3 text-sm font-semibold text-clinic-900">Audit export</div>
          <div className="mt-1 text-xs text-clinic-500">Download scoped audit CSV for compliance review</div>
          <div className="mt-3 grid gap-2">
            <input placeholder="Event type" value={auditExport.event_type} onChange={(event) => setAuditExport({ ...auditExport, event_type: event.target.value })} className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs" />
            <input placeholder="Entity type" value={auditExport.entity_type} onChange={(event) => setAuditExport({ ...auditExport, entity_type: event.target.value })} className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs" />
            <input placeholder="Entity ID" value={auditExport.entity_id} onChange={(event) => setAuditExport({ ...auditExport, entity_id: event.target.value })} className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs" />
            <select value={auditExport.limit} onChange={(event) => setAuditExport({ ...auditExport, limit: event.target.value })} className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs">
              <option value="1000">1,000 rows</option>
              <option value="10000">10,000 rows</option>
              <option value="50000">50,000 rows</option>
            </select>
            <a href={auditExportHref} className="rounded-md bg-accent-600 px-3 py-2 text-center text-xs font-medium text-white hover:bg-accent-700">Export CSV</a>
          </div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <ShieldCheck className="h-4 w-4 text-accent-700" />
          <div className="mt-3 text-sm font-semibold text-clinic-900">PHI access controls</div>
          <div className="mt-1 text-xs text-clinic-500">Patient document access uses expiring viewer metadata</div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <ClipboardList className="h-4 w-4 text-accent-700" />
          <div className="mt-3 text-sm font-semibold text-clinic-900">Launch checklist</div>
          <div className="mt-1 text-xs text-clinic-500">Production readiness tracked in operations docs</div>
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-clinic-900">Communications Governance</div>
            <div className="mt-1 text-xs text-clinic-500">Patient outreach requires channel consent and available contact details before delivery is queued</div>
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
            <div key={label} className="rounded-md bg-clinic-50 px-3 py-2">
              <div className="text-xl font-semibold text-clinic-900">{value}</div>
              <div className="text-xs text-clinic-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Patient Intake</div>
          <div className="mt-3 text-2xl font-semibold text-clinic-900">{analytics?.front_office.intake_needing_review ?? 0}</div>
          <div className="text-xs text-clinic-500">portal submissions needing review</div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Billing Work</div>
          <div className="mt-3 text-2xl font-semibold text-clinic-900">{analytics?.billing.draft_cases ?? 0}</div>
          <div className="text-xs text-clinic-500">{analytics?.billing.denied_cases ?? 0} denied cases</div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Security Policy</div>
          <div className="mt-3 text-2xl font-semibold text-clinic-900">{sessionPolicy?.access_token_expire_minutes ?? '—'}m</div>
          <div className="text-xs text-clinic-500">{sessionPolicy?.mfa_required ? 'MFA required' : 'MFA staged for production'}</div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Assistant Governance</div>
          <div className="mt-3 text-2xl font-semibold text-clinic-900">{assistantEvents?.total ?? 0}</div>
          <div className="text-xs text-clinic-500">confirmed task actions audited</div>
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-clinic-900">Billing Claim Governance</div>
            <div className="mt-1 text-xs text-clinic-500">Claim submission is gated by payer, coding, eligibility, and denial rework status</div>
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
            <div key={label} className="rounded-md bg-clinic-50 px-3 py-2">
              <div className="text-xl font-semibold text-clinic-900">{value}</div>
              <div className="text-xs text-clinic-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="text-sm font-semibold text-clinic-900">Integration Capability Map</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          {Object.entries(capabilities ?? {}).map(([key, capability]) => (
            <div key={key} className="rounded-md border border-clinic-100 bg-clinic-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium capitalize text-clinic-800">{key.replace('_', ' ')}</span>
                <StatusBadge ok={capability.configured} label={capability.configured ? 'Live' : 'Staged'} />
              </div>
              <div className="mt-2 text-xs text-clinic-500">{capability.supports.join(', ')}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <ClipboardList className="h-4 w-4 text-accent-700" />
            Deployment Readiness
          </div>
          <div className="mt-4 space-y-2">
            {deployment.map(([key, check]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md bg-clinic-50 px-3 py-2 text-sm">
                <div>
                  <div className="capitalize text-clinic-700">{key.replaceAll('_', ' ')}</div>
                  {check.path && <div className="font-mono text-[11px] text-clinic-400">{check.path}</div>}
                </div>
                <StatusBadge ok={check.ok} label={check.ok ? 'Found' : 'Missing'} />
              </div>
            ))}
            {deployment.length === 0 && <div className="text-sm text-clinic-400">Deployment checks are not available.</div>}
          </div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white">
          <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-800">Recent PHI Access</h2>
              <p className="text-xs text-clinic-500">Document viewer access reasons and timestamps</p>
            </div>
            <ShieldCheck className="h-4 w-4 text-clinic-400" />
          </div>
          <div className="divide-y divide-clinic-100">
            {(auditEvents?.data ?? []).map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_12rem]">
                <div>
                  <div className="font-medium text-clinic-900">{String(event.payload?.document_title ?? event.entity_id)}</div>
                  {typeof event.payload?.reason === 'string' && <div className="mt-1 text-xs text-clinic-600">{event.payload.reason}</div>}
                </div>
                <div className="text-xs text-clinic-500 md:text-right">{new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(auditEvents?.data ?? []).length === 0 && <div className="px-4 py-8 text-center text-sm text-clinic-400">No PHI access events recorded yet.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-800">Integration Events</h2>
            <p className="text-xs text-clinic-500">{failedEvents.length} failed event{failedEvents.length === 1 ? '' : 's'} ready for review</p>
          </div>
          <ShieldCheck className="h-4 w-4 text-clinic-400" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-clinic-100 bg-clinic-50 text-left text-xs font-medium text-clinic-500">
              <tr>
                <th className="px-4 py-2.5">Integration</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Attempts</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(events?.data ?? []).map((event) => (
                <tr key={event.id} className="border-b border-clinic-100 last:border-b-0">
                  <td className="px-4 py-3 font-medium text-clinic-900">{event.integration.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-clinic-600">{event.action}</td>
                  <td className="px-4 py-3"><StatusBadge ok={event.status === 'succeeded'} label={event.status} /></td>
                  <td className="px-4 py-3 text-clinic-600">{event.attempts}</td>
                  <td className="px-4 py-3 text-clinic-500">{new Date(event.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {event.status === 'failed' && (
                      <button
                        onClick={() => retryMutation.mutate(event.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
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
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-clinic-400">
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
        className="inline-flex items-center gap-2 rounded-md border border-clinic-200 bg-white px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh operations status
      </button>
    </div>
  );
}

function csvCell(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
