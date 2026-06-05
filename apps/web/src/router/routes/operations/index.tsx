import { createFileRoute } from '@tanstack/react-router';
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
} from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ROUTES, type AnalyticsSummary, type AuditEvent, type IntegrationCapabilities, type SessionPolicy } from '@concierge-os/shared';

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
  const retryMutation = useMutation({
    mutationFn: (eventId: string) => api.post(`/integrations/events/${eventId}/retry`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
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
