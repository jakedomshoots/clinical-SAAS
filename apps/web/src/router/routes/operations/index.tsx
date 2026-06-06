import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  PlugZap,
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
import { ROUTES, type AnalyticsSummary, type AuditEvent, type BillingWorkQueue, type GoLiveAttestation, type GoLiveAttestationCreate, type GoLivePacket, type IntegrationCapabilities, type LaunchWorkplan, type LaunchWorkplanSnapshot, type LaunchWorkplanSnapshotList, type OperationsIncidentList, type ProductionRehearsalReport, type ProductionRehearsalSnapshot, type ProductionRehearsalSnapshotList, type ReadinessSnapshot, type ReadinessSnapshotList, type RehearsalAction, type RehearsalActionAssignmentUpdate, type RoleDryRunChecklistList, type SessionPolicy, type TaskOutreachSummary } from '@concierge-os/shared';

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
  const { data: goLivePacket } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'go-live-packet'],
    queryFn: () => api.get<GoLivePacket>(ROUTES.OPERATIONS_GO_LIVE_PACKET),
  });
  const { data: roleChecklists } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'role-dry-run-checklists'],
    queryFn: () => api.get<RoleDryRunChecklistList>(ROUTES.OPERATIONS_ROLE_DRY_RUN_CHECKLISTS),
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

  const coreChecks = ready ? Object.entries(ready.checks) : [];
  const integrations = ready ? Object.entries(ready.integrations) : [];
  const deployment = ready?.deployment ? Object.entries(ready.deployment) : [];
  const failedEvents = events?.data.filter((event) => event.status === 'failed') ?? [];
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
