import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, PlugZap, Save, TestTube2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import {
  ROUTES,
  type CredentialPreflight,
  type CredentialPreflightItem,
  type HandoffPacketArchive,
  type IntegrationConfig,
  type IntegrationConfigListResponse,
  type IntegrationConnectionTestResult,
  type SandboxEvidence,
  type SandboxEvidenceCreate,
  type SandboxWorkflowRunAllResult,
  type SandboxWorkflowRunCreate,
  type VendorHandoffPacket,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ErrorState, LoadingState, OperationalEmptyState, humanizeWorkflowLabel } from '@/lib/ui-state';

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
  const { data, isLoading, isError, error } = useQuery({
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
  const handoffPacketMutation = useMutation({
    mutationFn: (integration: string) =>
      api.get<VendorHandoffPacket>(ROUTES.INTEGRATION_HANDOFF_PACKET(integration)),
    onSuccess: (packet) => {
      downloadJson(packet.export_filename, packet);
    },
  });
  const archivePacketMutation = useMutation({
    mutationFn: async (integration: string) => {
      const packet = await api.get<VendorHandoffPacket>(ROUTES.INTEGRATION_HANDOFF_PACKET(integration));
      return api.post<HandoffPacketArchive>(ROUTES.INTEGRATION_HANDOFF_PACKET_ARCHIVE(integration), {
        archive_note: 'Archived from Integration Setup for launch review.',
        archive_reference_url: `local://${packet.export_filename}`,
      });
    },
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
        <h1 className="font-serif text-display text-ink">Integration Setup</h1>
        <p className="text-small text-ink-muted mt-1 max-w-3xl">Preflight every credential, sandbox run, cutover owner, and rollback path before any live clinic workflow depends on it.</p>
      </header>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-meta font-medium text-ink-faint uppercase">Confidence</div>
            <p className="text-small text-ink-secondary mt-1">Run tests and collect sandbox evidence before go-live.</p>
          </div>
          <div>
            <div className="text-meta font-medium text-ink-faint uppercase">Direction</div>
            <p className="text-small text-ink-secondary mt-1">Use blocking/staged counts to decide which vendor to fix next.</p>
          </div>
          <div>
            <div className="text-meta font-medium text-ink-faint uppercase">Protection</div>
            <p className="text-small text-ink-secondary mt-1">Archive handoff packets and keep rollback owners attached to cutover.</p>
          </div>
        </div>
      </section>
      {preflight && (
        <section className="grid gap-3 md:grid-cols-4">
          <PreflightStat label="Ready" value={preflight.ready_count} tone="ready" />
          <PreflightStat label="Staged" value={preflight.staged_count} tone="staged" />
          <PreflightStat label="Blocking" value={preflight.blocking_count} tone="blocked" />
          <PreflightStat label="Total" value={preflight.total} tone="neutral" />
        </section>
      )}
      {isLoading ? <LoadingState label="Loading integrations" /> : isError ? (
        <ErrorState title="Unable to load integration readiness" detail={error instanceof Error ? error.message : 'Integration preflight could not be loaded.'} />
      ) : configs.length === 0 ? (
        <OperationalEmptyState
          title="No integrations configured"
          detail="Add the first vendor connector or open Setup to confirm which launch dependency is blocking the clinic day."
          primaryAction={<Link to="/setup" className="bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-semibold hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">Open setup checklist</Link>}
        />
      ) : (
        <section className="grid gap-3 xl:grid-cols-2">
          {configs.map((config) => {
            const changedValues = drafts[config.key] ?? {};
            const hasDraftEdits = Object.values(changedValues).some((value) => value.trim());
            const preflightItem = preflightByKey.get(config.key);
            return (
              <div key={config.key} className="bg-canvas-raised border border-border rounded-md p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-subhead font-medium text-ink">
                      <PlugZap className="h-4 w-4 text-accent" />
                      {config.label}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <StatusBadge config={config} />
                      <ReadinessModeBadge
                        readinessMode={config.readiness_mode}
                        sandboxReady={config.sandbox_ready}
                        productionReady={config.production_ready}
                      />
                      <span className="rounded-sm bg-canvas-sunk px-2 py-1 font-medium text-micro text-ink-muted">mode: {config.mode}</span>
                      {config.last_test_status && (
                        <span className="rounded-sm bg-canvas-sunk px-2 py-1 font-medium text-micro text-ink-muted">
                          last test: {config.last_test_status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handoffPacketMutation.mutate(config.key)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas-sunk px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-raised disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
                      disabled={handoffPacketMutation.isPending}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Export packet
                    </button>
                    <button
                      type="button"
                      onClick={() => archivePacketMutation.mutate(config.key)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas-sunk px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-raised disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
                      disabled={archivePacketMutation.isPending}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => testMutation.mutate(config.key)}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas-sunk px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-raised disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
                      disabled={testMutation.isPending}
                    >
                      <TestTube2 className="h-3.5 w-3.5" />
                      Test
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-md border border-border bg-canvas-sunk p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-meta font-medium text-ink-muted uppercase">Vendor profile</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.vendor_profile.profile_complete ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                        {config.vendor_profile.profile_complete ? 'complete' : `${config.vendor_profile.missing_fields.length} missing`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {VENDOR_PROFILE_FIELDS.map((field) => (
                        <label key={field.key} className={field.key === 'ESCALATION_NOTES' ? 'grid gap-1 md:col-span-2' : 'grid gap-1'}>
                          <span className="text-small font-medium text-ink-secondary">{field.label}</span>
                          <input
                            type={field.key === 'OWNER_EMAIL' ? 'email' : 'text'}
                            value={profileFieldValue(config, field)}
                            onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                            className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-canvas-sunk p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-meta font-medium text-ink-muted uppercase">Cutover rehearsal</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.cutover_evidence.evidence_complete ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                        {config.cutover_evidence.evidence_complete ? 'approved' : `${config.cutover_evidence.missing_fields.length} missing`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {CUTOVER_EVIDENCE_FIELDS.map((field) => (
                        <label key={field.key} className={field.key === 'GO_NO_GO_NOTES' ? 'grid gap-1 md:col-span-2' : 'grid gap-1'}>
                          <span className="text-small font-medium text-ink-secondary">{field.label}</span>
                          <input
                            type={field.type}
                            value={cutoverFieldValue(config, field)}
                            onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                            className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                          />
                        </label>
                      ))}
                      <label className="flex items-center gap-2 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm text-ink-secondary md:col-span-2">
                        <input
                          type="checkbox"
                          checked={(drafts[config.key]?.LIVE_REHEARSAL_APPROVED ?? (config.cutover_evidence.live_rehearsal_approved ? 'true' : '')) === 'true'}
                          onChange={(event) => updateDraft(config.key, 'LIVE_REHEARSAL_APPROVED', event.target.checked ? 'true' : '')}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent-soft"
                        />
                        Approved for live-use rehearsal
                      </label>
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-canvas-sunk p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-meta font-medium text-ink-muted uppercase">Vendor risk register</div>
                      <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.risk_register.blocking_count ? 'border-danger/20 bg-danger/10 text-danger' : 'border-accent-soft bg-accent-soft text-accent'}`}>
                        {config.risk_register.blocking_count ? `${config.risk_register.blocking_count} blocking` : `${config.risk_register.risk_count} tracked`}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1 md:col-span-2">
                        <span className="text-small font-medium text-ink-secondary">Risk</span>
                        <input
                          type="text"
                          value={drafts[config.key]?.RISK_TITLE ?? config.risk_register.risks[0]?.title ?? ''}
                          onChange={(event) => updateDraft(config.key, 'RISK_TITLE', event.target.value)}
                          className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="text-small font-medium text-ink-secondary">Severity</span>
                        <select
                          value={drafts[config.key]?.RISK_SEVERITY ?? config.risk_register.risks[0]?.severity ?? 'warning'}
                          onChange={(event) => updateDraft(config.key, 'RISK_SEVERITY', event.target.value)}
                          className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                        >
                          <option value="critical">Critical</option>
                          <option value="warning">Warning</option>
                          <option value="normal">Normal</option>
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-small font-medium text-ink-secondary">Status</span>
                        <select
                          value={drafts[config.key]?.RISK_MITIGATION_STATUS ?? config.risk_register.risks[0]?.mitigation_status ?? 'open'}
                          onChange={(event) => updateDraft(config.key, 'RISK_MITIGATION_STATUS', event.target.value)}
                          className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="mitigated">Mitigated</option>
                          <option value="accepted">Accepted</option>
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-small font-medium text-ink-secondary">Mitigation owner</span>
                        <input
                          type="text"
                          value={drafts[config.key]?.RISK_MITIGATION_OWNER ?? config.risk_register.risks[0]?.mitigation_owner ?? ''}
                          onChange={(event) => updateDraft(config.key, 'RISK_MITIGATION_OWNER', event.target.value)}
                          className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm text-ink-secondary">
                        <input
                          type="checkbox"
                          checked={(drafts[config.key]?.RISK_BLOCKS_REHEARSAL ?? (config.risk_register.risks[0]?.blocks_live_rehearsal ? 'true' : '')) === 'true'}
                          onChange={(event) => updateDraft(config.key, 'RISK_BLOCKS_REHEARSAL', event.target.checked ? 'true' : '')}
                          className="h-4 w-4 rounded border-border text-accent focus:ring-accent-soft"
                        />
                        Blocks live-use rehearsal
                      </label>
                    </div>
                  </div>
                  {config.fields.map((field) => (
                    <label key={field.key} className="grid gap-1">
                      <span className="flex items-center justify-between gap-2 text-small font-medium text-ink-secondary">
                        {field.label}
                        <span className="font-mono text-micro text-ink-faint">{field.key}</span>
                      </span>
                      <input
                        type={field.secret ? 'password' : 'text'}
                        value={fieldValue(config, field.key)}
                        onChange={(event) => updateDraft(config.key, field.key, event.target.value)}
                        placeholder={field.value_preview ?? (field.secret ? 'Paste secret value' : 'Enter value')}
                        className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      />
                      <span className="text-micro text-ink-faint">
                        {field.configured ? `Configured from ${field.source}` : 'Missing'}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {config.workflows.map((workflow) => (
                    <span key={workflow} className="rounded-sm border border-border bg-canvas-sunk px-2 py-1 text-micro text-ink-muted">
                      {humanizeWorkflowLabel(workflow)}
                    </span>
                  ))}
                </div>
                <div className="mt-3 rounded-sm border border-border bg-canvas-sunk px-3 py-2 text-small text-ink-secondary">
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
                  className="mt-4 inline-flex items-center gap-2 bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-medium hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
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
    ready: 'border-accent-soft bg-accent-soft text-accent',
    staged: 'border-warn/20 bg-warn/10 text-warn',
    blocked: 'border-danger/20 bg-danger/10 text-danger',
    neutral: 'border-border bg-canvas-raised text-ink-secondary',
  }[tone];
  return (
    <div className={`rounded-md border px-4 py-3 ${toneClass}`}>
      <div className="text-meta font-medium text-ink-muted uppercase">{label}</div>
      <div className="font-serif text-2xl font-medium text-ink mt-1">{value}</div>
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
    <div className="mt-4 rounded-md border border-border bg-canvas-sunk p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-meta font-medium text-ink-muted uppercase">
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
          <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 font-medium text-warn">
            production vendor pending
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-canvas-raised px-3 py-2">
        <div className="text-small text-ink-secondary">
          {item.sandbox_evidence.filter((evidence) => evidence.status === 'passed').length} / {item.sandbox_evidence.length} sandbox checks passed
        </div>
        <button
          type="button"
          onClick={onRunAllSandbox}
          disabled={runningAll || item.adapter_method_ready_count < item.adapter_method_total}
          className="rounded-md border border-border bg-canvas-sunk px-3 py-1.5 text-xs font-medium text-ink-secondary hover:bg-canvas-raised disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
        >
          Run all sandbox
        </button>
      </div>
      {item.blockers.length > 0 && (
        <div className="mt-3 space-y-1">
          {item.blockers.map((blocker) => (
            <div className="text-small text-ink-secondary" key={blocker}>{blocker}</div>
          ))}
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {item.steps.map((step) => (
          <div key={step.key} className="flex items-start gap-2 rounded-sm bg-canvas-raised px-3 py-2">
            {step.status === 'ready' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-accent" />
            ) : (
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-warn" />
            )}
            <div>
              <div className="text-small font-medium text-ink">{step.label}</div>
              <div className="text-meta text-ink-muted mt-0.5">{step.detail}</div>
            </div>
          </div>
        ))}
      </div>
      {item.adapter_methods.length > 0 && (
        <div className="mt-3 rounded-md border border-border bg-canvas-raised p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-meta font-medium text-ink-muted uppercase">Adapter contract</div>
            <div className="text-meta text-ink-muted">{item.adapter_method_ready_count} / {item.adapter_method_total} ready</div>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {item.adapter_methods.map((method) => (
              <div key={method.key} className="rounded-sm border border-border-subtle bg-canvas-sunk px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-small font-medium text-ink">{method.label}</div>
                  <span className={`rounded-md border px-2 py-0.5 text-micro font-medium ${method.status === 'ready' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-danger/20 bg-danger/10 text-danger'}`}>
                    {method.status}
                  </span>
                </div>
                <div className="text-micro text-ink-muted mt-1">{method.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-2">
        {item.sandbox_evidence.map((evidence) => (
          <div key={evidence.test_key} className="rounded-sm border border-border bg-canvas-raised p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-small font-medium text-ink">{evidence.test_label}</div>
                <div className="text-micro text-ink-muted mt-1">
                  {evidence.status === 'missing'
                    ? 'No evidence recorded'
                    : `${evidence.status} by ${evidence.recorded_by ?? 'staff'}${evidence.recorded_at ? ` on ${new Date(evidence.recorded_at).toLocaleDateString()}` : ''}`}
                </div>
              </div>
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${evidence.status === 'passed' ? 'border-accent-soft bg-accent-soft text-accent' : evidence.status === 'failed' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-canvas-sunk text-ink-muted'}`}>
                {evidence.status}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[7rem_minmax(0,1fr)]">
              <select
                value={evidenceDraft(evidence.test_label).status}
                onChange={(event) => onDraftChange(evidence.test_label, { status: event.target.value as SandboxEvidenceCreate['status'] })}
                className="bg-canvas border border-border rounded-sm px-2 py-2 text-xs text-ink"
              >
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
              <input
                value={evidenceDraft(evidence.test_label).notes}
                onChange={(event) => onDraftChange(evidence.test_label, { notes: event.target.value })}
                placeholder="Sandbox evidence note"
                className="bg-canvas border border-border rounded-sm px-3 py-2 text-xs text-ink placeholder:text-ink-faint"
              />
              <input
                value={evidenceDraft(evidence.test_label).reference_url ?? ''}
                onChange={(event) => onDraftChange(evidence.test_label, { reference_url: event.target.value })}
                placeholder={item.readiness_mode === 'production_vendor' ? 'Vendor sandbox reference URL' : 'Reference URL'}
                className="bg-canvas border border-border rounded-sm px-3 py-2 text-xs text-ink placeholder:text-ink-faint md:col-span-2"
              />
              <button
                type="button"
                onClick={() => onRecord(evidence.test_label)}
                disabled={recording || evidenceDraft(evidence.test_label).notes.trim().length < 3}
                className="bg-accent text-accent-on rounded-md px-3 py-2 text-xs font-medium hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
              >
                Record evidence
              </button>
              <button
                type="button"
                onClick={() => onRunSandbox(evidence.test_label)}
                disabled={running || item.adapter_method_ready_count < item.adapter_method_total}
                className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] transition-transform duration-75"
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
  if (status === 'ready') return 'border-accent-soft bg-accent-soft text-accent';
  if (status === 'staged') return 'border-warn/20 bg-warn/10 text-warn';
  return 'border-danger/20 bg-danger/10 text-danger';
}

function toDateTimeLocal(value: string) {
  if (!value) return '';
  return value.replace(/Z$/, '').slice(0, 16);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
      <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 font-medium text-accent">
        production vendor ready
      </span>
    );
  }
  if (readinessMode === 'local_sandbox') {
    return (
      <span className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 font-medium text-warn">
        {sandboxReady ? 'local sandbox ready' : 'local sandbox mode'}
      </span>
    );
  }
  return (
    <span className="rounded-md border border-border bg-canvas-sunk px-2 py-1 font-medium text-ink-muted">
      production vendor mode
    </span>
  );
}

function StatusBadge({ config }: { config: IntegrationConfig }) {
  if (config.healthy) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-accent-soft bg-accent-soft px-2 py-1 font-medium text-accent">
        <CheckCircle2 className="h-3 w-3" />
        healthy
      </span>
    );
  }
  if (config.configured && !config.adapter_implemented) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-danger/20 bg-danger/10 px-2 py-1 font-medium text-danger">
        <TriangleAlert className="h-3 w-3" />
        adapter needed
      </span>
    );
  }
  if (config.configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-warn/20 bg-warn/10 px-2 py-1 font-medium text-warn">
        <TriangleAlert className="h-3 w-3" />
        staged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-danger/20 bg-danger/10 px-2 py-1 font-medium text-danger">
      <TriangleAlert className="h-3 w-3" />
      missing
    </span>
  );
}
