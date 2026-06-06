import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, PlugZap, Save, TestTube2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import {
  ROUTES,
  type CredentialPreflight,
  type CredentialPreflightItem,
  type IntegrationConfig,
  type IntegrationConfigListResponse,
  type IntegrationConnectionTestResult,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/integrations')({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'integration-config'],
    queryFn: () => api.get<IntegrationConfigListResponse>(ROUTES.INTEGRATION_CONFIG),
  });
  const { data: preflight } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'credential-preflight'],
    queryFn: () => api.get<CredentialPreflight>(ROUTES.INTEGRATION_CREDENTIAL_PREFLIGHT),
  });
  const saveMutation = useMutation({
    mutationFn: ({ integration, values }: { integration: string; values: Record<string, string> }) =>
      api.patch<IntegrationConfig>(ROUTES.INTEGRATION_CONFIG_ITEM(integration), { values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
    },
  });
  const testMutation = useMutation({
    mutationFn: (integration: string) =>
      api.post<IntegrationConnectionTestResult>(ROUTES.INTEGRATION_CONFIG_TEST(integration), {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
    },
  });
  const configs = data?.data ?? [];
  const preflightByKey = new Map((preflight?.data ?? []).map((item) => [item.key, item]));

  function updateDraft(integration: string, field: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [integration]: { ...(current[integration] ?? {}), [field]: value },
    }));
  }

  function fieldValue(config: IntegrationConfig, field: string) {
    return drafts[config.key]?.[field] ?? '';
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Vendor readiness</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Integration Setup</h1>
      </header>
      {preflight && (
        <section className="grid gap-3 md:grid-cols-4">
          <PreflightStat label="Ready" value={preflight.ready_count} tone="ready" />
          <PreflightStat label="Staged" value={preflight.staged_count} tone="staged" />
          <PreflightStat label="Blocking" value={preflight.blocking_count} tone="blocked" />
          <PreflightStat label="Total" value={preflight.total} tone="neutral" />
        </section>
      )}
      {isLoading ? <LoadingState label="Loading integrations" /> : (
        <section className="grid gap-3 xl:grid-cols-2">
          {configs.map((config) => {
            const changedValues = drafts[config.key] ?? {};
            const hasDraftEdits = Object.values(changedValues).some((value) => value.trim());
            const preflightItem = preflightByKey.get(config.key);
            return (
              <div key={config.key} className="rounded-md border border-clinic-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
                      <PlugZap className="h-4 w-4 text-accent-700" />
                      {config.label}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <StatusBadge config={config} />
                      <span className="rounded-md bg-clinic-50 px-2 py-1 font-medium text-clinic-600">mode: {config.mode}</span>
                      {config.last_test_status && (
                        <span className="rounded-md bg-clinic-50 px-2 py-1 font-medium text-clinic-600">
                          last test: {config.last_test_status}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => testMutation.mutate(config.key)}
                    className="inline-flex items-center gap-2 rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-white disabled:opacity-50"
                    disabled={testMutation.isPending}
                  >
                    <TestTube2 className="h-3.5 w-3.5" />
                    Test
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {config.fields.map((field) => (
                    <label key={field.key} className="grid gap-1">
                      <span className="flex items-center justify-between gap-2 text-xs font-medium text-clinic-600">
                        {field.label}
                        <span className="font-mono text-[11px] text-clinic-400">{field.key}</span>
                      </span>
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={fieldValue(config, field.key)}
                        onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                        placeholder={field.value_preview ?? (field.secret ? 'Paste secret value' : 'Enter value')}
                        className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                      />
                      <span className="text-xs text-clinic-400">
                        {field.configured ? `Configured from ${field.source}` : 'Missing'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {config.workflows.map((workflow) => (
                    <span key={workflow} className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs text-clinic-600">
                      {workflow}
                    </span>
                  ))}
                </div>
                <div className="mt-3 rounded-md border border-clinic-200 px-3 py-2 text-sm text-clinic-700">
                  {config.action}
                </div>
                {preflightItem && <CredentialPreflightPanel item={preflightItem} />}
                <button
                  type="button"
                  onClick={() => saveMutation.mutate({ integration: config.key, values: changedValues })}
                  disabled={!hasDraftEdits || saveMutation.isPending}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save setup draft
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function PreflightStat({ label, value, tone }: { label: string; value: number; tone: 'ready' | 'staged' | 'blocked' | 'neutral' }) {
  const toneClass = {
    ready: 'border-accent-200 bg-accent-50 text-accent-800',
    staged: 'border-amber-200 bg-amber-50 text-amber-800',
    blocked: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-clinic-200 bg-white text-clinic-700',
  }[tone];
  return (
    <div className={`rounded-md border px-4 py-3 ${toneClass}`}>
      <div className="text-xs font-medium uppercase">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function CredentialPreflightPanel({ item }: { item: CredentialPreflightItem }) {
  return (
    <div className="mt-4 rounded-md border border-clinic-200 bg-clinic-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-clinic-600">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Credential preflight
        </div>
        <span className={`rounded-md border px-2 py-1 text-xs font-medium ${preflightStatusClass(item.status)}`}>
          {item.status}
        </span>
      </div>
      {item.blockers.length > 0 && (
        <div className="mt-3 space-y-1">
          {item.blockers.map((blocker) => (
            <div key={blocker} className="text-xs text-clinic-700">{blocker}</div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {item.steps.map((step) => (
          <div key={step.key} className="flex items-start gap-2 rounded-md bg-white px-3 py-2">
            {step.status === 'ready' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-accent-700" />
            ) : (
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-amber-700" />
            )}
            <div>
              <div className="text-xs font-medium text-clinic-800">{step.label}</div>
              <div className="mt-0.5 text-xs text-clinic-500">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.sandbox_tests.map((test) => (
          <span key={test} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs text-clinic-600">
            {test}
          </span>
        ))}
      </div>
    </div>
  );
}

function preflightStatusClass(status: CredentialPreflightItem['status']) {
  if (status === 'ready') return 'border-accent-200 bg-accent-50 text-accent-800';
  if (status === 'staged') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-red-200 bg-red-50 text-red-700';
}

function StatusBadge({ config }: { config: IntegrationConfig }) {
  if (config.healthy) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 font-medium text-accent-800">
        <CheckCircle2 className="h-3 w-3" />
        healthy
      </span>
    );
  }
  if (config.configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-medium text-amber-800">
        <TriangleAlert className="h-3 w-3" />
        staged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-700">
      <TriangleAlert className="h-3 w-3" />
      missing
    </span>
  );
}
