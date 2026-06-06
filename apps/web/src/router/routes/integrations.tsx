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
  type SandboxEvidence,
  type SandboxEvidenceCreate,
  type SandboxWorkflowRunAllResult,
  type SandboxWorkflowRunCreate,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/integrations')({
  component: IntegrationsPage,
});

const VENDOR_PROFILE_FIELDS = [
  { key: 'VENDOR_NAME', label: 'Vendor name', profileKey: 'vendor_name' },
  { key: 'VENDOR_ENVIRONMENT', label: 'Environment', profileKey: 'environment' },
  { key: 'OWNER_NAME', label: 'Owner', profileKey: 'owner_name' },
  { key: 'OWNER_EMAIL', label: 'Owner email', profileKey: 'owner_email' },
  { key: 'SUPPORT_CONTACT', label: 'Support contact', profileKey: 'support_contact' },
  { key: 'CONTRACT_REFERENCE_URL', label: 'Contract/reference URL', profileKey: 'contract_reference_url' },
  { key: 'ESCALATION_NOTES', label: 'Escalation notes', profileKey: 'escalation_notes' },
] as const;

const CUTOVER_EVIDENCE_FIELDS = [
  { key: 'CUTOVER_PLANNED_AT', label: 'Planned cutover', evidenceKey: 'planned_cutover_at', type: 'datetime-local' },
  { key: 'LAST_VENDOR_TEST_AT', label: 'Last vendor test', evidenceKey: 'last_vendor_test_at', type: 'datetime-local' },
  { key: 'ROLLBACK_OWNER', label: 'Rollback owner', evidenceKey: 'rollback_owner', type: 'text' },
  { key: 'GO_NO_GO_NOTES', label: 'Go/no-go notes', evidenceKey: 'go_no_go_notes', type: 'text' },
] as const;

function IntegrationsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, SandboxEvidenceCreate>>({});
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
  const evidenceMutation = useMutation({
    mutationFn: ({ integration, data }: { integration: string; data: SandboxEvidenceCreate }) =>
      api.post<SandboxEvidence>(ROUTES.INTEGRATION_SANDBOX_EVIDENCE(integration), data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const runSandboxMutation = useMutation({
    mutationFn: ({ integration, data }: { integration: string; data: SandboxWorkflowRunCreate }) =>
      api.post<SandboxEvidence>(ROUTES.INTEGRATION_SANDBOX_WORKFLOW_RUN(integration), data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const runAllSandboxMutation = useMutation({
    mutationFn: (integration: string) =>
      api.post<SandboxWorkflowRunAllResult>(ROUTES.INTEGRATION_SANDBOX_WORKFLOW_RUN_ALL(integration), {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
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

  function profileFieldValue(config: IntegrationConfig, field: (typeof VENDOR_PROFILE_FIELDS)[number]) {
    return drafts[config.key]?.[field.key] ?? config.vendor_profile[field.profileKey] ?? '';
  }

  function cutoverFieldValue(config: IntegrationConfig, field: (typeof CUTOVER_EVIDENCE_FIELDS)[number]) {
    return drafts[config.key]?.[field.key] ?? toDateTimeLocal(config.cutover_evidence[field.evidenceKey]) ?? '';
  }

  function evidenceKey(integration: string, testLabel: string) {
    return `${integration}:${testLabel}`;
  }

  function evidenceDraft(integration: string, testLabel: string): SandboxEvidenceCreate {
    return evidenceDrafts[evidenceKey(integration, testLabel)] ?? {
      test_label: testLabel,
      status: 'passed',
      notes: '',
      reference_url: '',
    };
  }

  function updateEvidenceDraft(integration: string, testLabel: string, update: Partial<SandboxEvidenceCreate>) {
    setEvidenceDrafts((current) => {
      const key = evidenceKey(integration, testLabel);
      const existing = current[key] ?? {
        test_label: testLabel,
        status: 'passed' as const,
        notes: '',
        reference_url: '',
      };
      return {
        ...current,
        [key]: { ...existing, ...update, test_label: testLabel },
      };
    });
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
                      <ReadinessModeBadge
                        readinessMode={config.readiness_mode}
                        sandboxReady={config.sandbox_ready}
                        productionReady={config.production_ready}
                      />
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
                  <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase text-clinic-600">Vendor profile</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.vendor_profile.profile_complete ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {config.vendor_profile.profile_complete ? 'complete' : `${config.vendor_profile.missing_fields.length} missing`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {VENDOR_PROFILE_FIELDS.map((field) => (
                        <label key={field.key} className={field.key === 'ESCALATION_NOTES' ? 'grid gap-1 md:col-span-2' : 'grid gap-1'}>
                          <span className="text-xs font-medium text-clinic-600">{field.label}</span>
                          <input
                            type={field.key === 'OWNER_EMAIL' ? 'email' : 'text'}
                            value={profileFieldValue(config, field)}
                            onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                            className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase text-clinic-600">Cutover rehearsal</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.cutover_evidence.evidence_complete ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {config.cutover_evidence.evidence_complete ? 'approved' : `${config.cutover_evidence.missing_fields.length} missing`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {CUTOVER_EVIDENCE_FIELDS.map((field) => (
                        <label key={field.key} className={field.key === 'GO_NO_GO_NOTES' ? 'grid gap-1 md:col-span-2' : 'grid gap-1'}>
                          <span className="text-xs font-medium text-clinic-600">{field.label}</span>
                          <input
                            type={field.type}
                            value={cutoverFieldValue(config, field)}
                            onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                            className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-2 rounded-md border border-clinic-200 bg-white px-3 py-2 text-sm text-clinic-700 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={(drafts[config.key]?.LIVE_REHEARSAL_APPROVED ?? (config.cutover_evidence.live_rehearsal_approved ? 'true' : '')) === 'true'}
                          onChange={(event) => updateDraft(config.key, 'LIVE_REHEARSAL_APPROVED', event.target.checked ? 'true' : '')}
                          className="h-4 w-4 rounded border-clinic-300 text-accent-600 focus:ring-accent-500"
                        />
                        Approved for live-use rehearsal
                      </label>
                    </div>
                  </div>
                  <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold uppercase text-clinic-600">Vendor risk register</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.risk_register.blocking_count ? 'border-red-200 bg-red-50 text-red-700' : 'border-accent-200 bg-accent-50 text-accent-800'}`}>
                        {config.risk_register.blocking_count ? `${config.risk_register.blocking_count} blocking` : `${config.risk_register.risk_count} tracked`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1 md:col-span-2">
                        <span className="text-xs font-medium text-clinic-600">Risk</span>
                        <input
                          type="text"
                          value={drafts[config.key]?.RISK_TITLE ?? config.risk_register.risks[0]?.title ?? ''}
                          onChange={(event) => updateDraft(config.key, 'RISK_TITLE', event.target.value)}
                          className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-medium text-clinic-600">Severity</span>
                        <select
                          value={drafts[config.key]?.RISK_SEVERITY ?? config.risk_register.risks[0]?.severity ?? 'warning'}
                          onChange={(event) => updateDraft(config.key, 'RISK_SEVERITY', event.target.value)}
                          className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                        >
                          <option value="critical">Critical</option>
                          <option value="warning">Warning</option>
                          <option value="normal">Normal</option>
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-medium text-clinic-600">Status</span>
                        <select
                          value={drafts[config.key]?.RISK_MITIGATION_STATUS ?? config.risk_register.risks[0]?.mitigation_status ?? 'open'}
                          onChange={(event) => updateDraft(config.key, 'RISK_MITIGATION_STATUS', event.target.value)}
                          className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="mitigated">Mitigated</option>
                          <option value="accepted">Accepted</option>
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs font-medium text-clinic-600">Mitigation owner</span>
                        <input
                          type="text"
                          value={drafts[config.key]?.RISK_MITIGATION_OWNER ?? config.risk_register.risks[0]?.mitigation_owner ?? ''}
                          onChange={(event) => updateDraft(config.key, 'RISK_MITIGATION_OWNER', event.target.value)}
                          className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-clinic-200 bg-white px-3 py-2 text-sm text-clinic-700">
                        <input
                          type="checkbox"
                          checked={(drafts[config.key]?.RISK_BLOCKS_REHEARSAL ?? (config.risk_register.risks[0]?.blocks_live_rehearsal ? 'true' : '')) === 'true'}
                          onChange={(event) => updateDraft(config.key, 'RISK_BLOCKS_REHEARSAL', event.target.checked ? 'true' : '')}
                          className="h-4 w-4 rounded border-clinic-300 text-accent-600 focus:ring-accent-500"
                        />
                        Blocks live-use rehearsal
                      </label>
                    </div>
                  </div>
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
                {preflightItem && (
                  <CredentialPreflightPanel
                    item={preflightItem}
                    evidenceDraft={(testLabel) => evidenceDraft(config.key, testLabel)}
                    onDraftChange={(testLabel, update) => updateEvidenceDraft(config.key, testLabel, update)}
                    onRecord={(testLabel) => evidenceMutation.mutate({
                      integration: config.key,
                      data: evidenceDraft(config.key, testLabel),
                    })}
                    onRunSandbox={(testLabel) => runSandboxMutation.mutate({
                      integration: config.key,
                      data: { test_label: testLabel },
                    })}
                    onRunAllSandbox={() => runAllSandboxMutation.mutate(config.key)}
                    recording={evidenceMutation.isPending}
                    running={runSandboxMutation.isPending}
                    runningAll={runAllSandboxMutation.isPending}
                  />
                )}
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

function CredentialPreflightPanel({
  item,
  evidenceDraft,
  onDraftChange,
  onRecord,
  onRunSandbox,
  onRunAllSandbox,
  recording,
  running,
  runningAll,
}: {
  item: CredentialPreflightItem;
  evidenceDraft: (testLabel: string) => SandboxEvidenceCreate;
  onDraftChange: (testLabel: string, update: Partial<SandboxEvidenceCreate>) => void;
  onRecord: (testLabel: string) => void;
  onRunSandbox: (testLabel: string) => void;
  onRunAllSandbox: () => void;
  recording: boolean;
  running: boolean;
  runningAll: boolean;
}) {
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
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <ReadinessModeBadge
          readinessMode={item.readiness_mode}
          sandboxReady={item.sandbox_ready}
          productionReady={item.production_ready}
        />
        {item.readiness_mode === 'local_sandbox' && (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-medium text-amber-800">
            production vendor pending
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-clinic-200 bg-white px-3 py-2">
        <div className="text-xs text-clinic-600">
          {item.sandbox_evidence.filter((evidence) => evidence.status === 'passed').length} / {item.sandbox_evidence.length} sandbox checks passed
        </div>
        <button
          type="button"
          onClick={onRunAllSandbox}
          disabled={runningAll || item.adapter_method_ready_count < item.adapter_method_total}
          className="rounded-md border border-clinic-300 bg-clinic-50 px-3 py-1.5 text-xs font-medium text-clinic-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run all sandbox
        </button>
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
      {item.adapter_methods.length > 0 && (
        <div className="mt-3 rounded-md border border-clinic-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-clinic-600">Adapter contract</div>
            <div className="text-xs text-clinic-500">{item.adapter_method_ready_count} / {item.adapter_method_total} ready</div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {item.adapter_methods.map((method) => (
              <div key={method.key} className="rounded-md border border-clinic-100 bg-clinic-50 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-clinic-800">{method.label}</div>
                  <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${method.status === 'ready' ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    {method.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] leading-4 text-clinic-500">{method.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {item.sandbox_evidence.map((evidence) => (
          <div key={evidence.test_key} className="rounded-md border border-clinic-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-medium text-clinic-800">{evidence.test_label}</div>
                <div className="mt-1 text-[11px] text-clinic-500">
                  {evidence.status === 'missing'
                    ? 'No evidence recorded'
                    : `${evidence.status} by ${evidence.recorded_by ?? 'staff'}${evidence.recorded_at ? ` on ${new Date(evidence.recorded_at).toLocaleDateString()}` : ''}`}
                </div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${evidence.status === 'passed' ? 'border-accent-200 bg-accent-50 text-accent-800' : evidence.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>
                {evidence.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)]">
              <select
                value={evidenceDraft(evidence.test_label).status}
                onChange={(event) => onDraftChange(evidence.test_label, { status: event.target.value as SandboxEvidenceCreate['status'] })}
                className="rounded-md border border-clinic-300 px-2 py-2 text-xs text-clinic-800"
              >
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
              <input
                value={evidenceDraft(evidence.test_label).notes}
                onChange={(event) => onDraftChange(evidence.test_label, { notes: event.target.value })}
                placeholder="Sandbox evidence note"
                className="rounded-md border border-clinic-300 px-3 py-2 text-xs text-clinic-800 placeholder:text-clinic-400"
              />
              <input
                value={evidenceDraft(evidence.test_label).reference_url ?? ''}
                onChange={(event) => onDraftChange(evidence.test_label, { reference_url: event.target.value })}
                placeholder={item.readiness_mode === 'production_vendor' ? 'Vendor sandbox reference URL' : 'Reference URL'}
                className="rounded-md border border-clinic-300 px-3 py-2 text-xs text-clinic-800 placeholder:text-clinic-400 md:col-span-2"
              />
              <button
                type="button"
                onClick={() => onRecord(evidence.test_label)}
                disabled={recording || evidenceDraft(evidence.test_label).notes.trim().length < 3}
                className="rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Record evidence
              </button>
              <button
                type="button"
                onClick={() => onRunSandbox(evidence.test_label)}
                disabled={running || item.adapter_method_ready_count < item.adapter_method_total}
                className="rounded-md border border-clinic-300 bg-white px-3 py-2 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run sandbox
              </button>
            </div>
          </div>
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

function toDateTimeLocal(value: string) {
  if (!value) return '';
  return value.replace(/Z$/, '').slice(0, 16);
}

function ReadinessModeBadge({
  readinessMode,
  sandboxReady,
  productionReady,
}: {
  readinessMode: IntegrationConfig['readiness_mode'];
  sandboxReady: boolean;
  productionReady: boolean;
}) {
  if (productionReady) {
    return (
      <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 font-medium text-accent-800">
        production vendor ready
      </span>
    );
  }
  if (readinessMode === 'local_sandbox') {
    return (
      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-medium text-amber-800">
        {sandboxReady ? 'local sandbox ready' : 'local sandbox mode'}
      </span>
    );
  }
  return (
    <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 font-medium text-clinic-600">
      production vendor mode
    </span>
  );
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
  if (config.configured && !config.adapter_implemented) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-700">
        <TriangleAlert className="h-3 w-3" />
        adapter needed
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
