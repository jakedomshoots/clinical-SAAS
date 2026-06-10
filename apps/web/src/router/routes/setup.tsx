import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import {
  ROUTES,
  type IntegrationCapabilities,
  type LaunchReadiness,
  type PilotReadiness,
  type PresalesSaasReadiness,
  type SessionPolicy,
  type UserListResponse,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ErrorState } from '@/lib/ui-state';

export const Route = createFileRoute('/setup')({
  component: SetupPage,
});

interface ReadyCheck {
  ok: boolean;
  configured?: boolean;
  env_var?: string;
}

interface ReadyResponse {
  checks: Record<string, ReadyCheck>;
  integrations: Record<string, ReadyCheck>;
  deployment?: Record<string, ReadyCheck & { path?: string }>;
}

import { useDocumentTitle } from '@/hooks/use-document-title';

function SetupPage() {
  useDocumentTitle('Setup Checklist');
  const api = useApi();
  const queryClient = useQueryClient();
  const {
    data: ready,
    isError: readyError,
    error: readyQueryError,
  } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'setup'],
    queryFn: () => api.get<ReadyResponse>('/ready'),
  });
  const { data: capabilities } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'setup-capabilities'],
    queryFn: () => api.get<IntegrationCapabilities>(ROUTES.INTEGRATION_CAPABILITIES),
  });
  const { data: sessionPolicy } = useQuery({
    queryKey: [...QUERY_KEYS.USER, 'setup-session-policy'],
    queryFn: () => api.get<SessionPolicy>(ROUTES.SESSION_POLICY),
  });
  const { data: users } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'setup'],
    queryFn: () => api.get<UserListResponse>(ROUTES.USERS),
  });
  const { data: pilotReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'pilot-score'],
    queryFn: () => api.get<PilotReadiness>(ROUTES.PILOT_READINESS),
  });
  const { data: presalesReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'presales-saas'],
    queryFn: () => api.get<PresalesSaasReadiness>(ROUTES.PRESALES_SAAS_READINESS),
  });
  const { data: launchReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'launch-readiness'],
    queryFn: () => api.get<LaunchReadiness>(ROUTES.LAUNCH_READINESS),
  });
  const createUserMutation = useMutation({
    mutationFn: (role: 'provider' | 'front_desk') =>
      api.post(ROUTES.AUTH.REGISTER, {
        email: role === 'provider' ? 'provider@clinic.example.com' : 'frontdesk@clinic.example.com',
        password: 'Setup123!Password',
        display_name: role === 'provider' ? 'Setup Provider' : 'Setup Front Desk',
        role,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
  });
  const seedPilotMutation = useMutation({
    mutationFn: () => api.post(ROUTES.PILOT_READINESS_SEED, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.READINESS });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
    },
  });

  const checklist = [
    {
      label: 'Core services online',
      ready: Object.values(ready?.checks ?? {}).every((check) => check.ok),
    },
    {
      label: 'Production env template present',
      ready: Boolean(ready?.deployment?.production_env_template?.ok),
    },
    {
      label: 'At least one admin user',
      ready: (users?.data ?? []).some((user) => user.role === 'admin' && user.is_active),
    },
    {
      label: 'At least one provider user',
      ready: (users?.data ?? []).some((user) => user.role === 'provider' && user.is_active),
    },
    { label: 'PHI re-auth policy configured', ready: Boolean(sessionPolicy?.phi_reauth_required) },
    {
      label: 'External integrations configured',
      ready: Object.values(capabilities ?? {}).some((capability) => capability.configured),
    },
  ];
  const requirementGroups = Object.entries(
    (launchReadiness?.requirements ?? []).reduce<
      Record<string, NonNullable<LaunchReadiness['requirements']>>
    >((groups, requirement) => {
      groups[requirement.category] = [...(groups[requirement.category] ?? []), requirement];
      return groups;
    }, {})
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-display text-ink">Setup Checklist</h1>
        <p className="text-small text-ink-muted mt-1 max-w-3xl">
          This is the canonical readiness path: prove the system is working, show the next blocker,
          and keep live-patient risk explicit before launch.
        </p>
      </header>
      {readyError && (
        <ErrorState
          title="Readiness API unavailable"
          detail={
            readyQueryError instanceof Error
              ? readyQueryError.message
              : 'Setup checks could not be loaded.'
          }
        />
      )}
      <section className="grid gap-3 md:grid-cols-2">
        <div className="bg-canvas-raised border border-border rounded-md p-4 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-subhead font-medium text-ink">Pre-Sales SaaS Buildout</div>
              <div className="text-small text-ink-muted mt-1">
                Features that can be prepared without a sold clinic, clinic-owned credentials, or
                live PHI.
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl font-medium text-ink">
                {presalesReadiness?.score ?? 0}%
              </div>
              <div className="text-meta text-ink-muted">
                {presalesReadiness?.status === 'ready_for_demo'
                  ? 'Ready for demo'
                  : 'Needs demo setup'}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(presalesReadiness?.features ?? []).map((feature) => (
              <div key={feature.key} className="rounded-md border border-border bg-canvas p-3">
                <div className="flex items-start gap-2">
                  {feature.ready ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-warn" />
                  )}
                  <div>
                    <div className="text-small font-semibold text-ink">{feature.label}</div>
                    <p className="mt-1 text-small text-ink-secondary">{feature.detail}</p>
                    <p className="mt-2 text-micro font-medium text-ink-muted">
                      Next: {feature.self_service_next_step}
                    </p>
                    {feature.future_customer_inputs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {feature.future_customer_inputs.map((item) => (
                          <span
                            key={item}
                            className="rounded-sm bg-canvas-sunk px-2 py-1 text-micro text-ink-muted"
                          >
                            Later: {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-border bg-canvas p-3">
            <div className="text-meta font-medium uppercase text-ink-faint">
              Blocked only after sale
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(presalesReadiness?.external_blockers ?? []).map((blocker) => (
                <span
                  key={blocker}
                  className="rounded-sm border border-border bg-canvas-sunk px-2 py-1 text-micro text-ink-secondary"
                >
                  {blocker}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-canvas-raised border border-border rounded-md p-4 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-subhead font-medium text-ink">Production Readiness</div>
              <div className="text-small text-ink-muted mt-1">
                Live-patient launch blockers across security, infrastructure, integrations, and
                operations
              </div>
            </div>
            <div className="text-right">
              <div className="font-serif text-3xl font-medium text-ink">
                {launchReadiness?.score ?? 0}%
              </div>
              <div className="text-meta text-ink-muted">
                {launchReadiness?.environment ?? 'unknown'} environment
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-sm bg-danger/10 px-3 py-2">
              <div className="text-meta font-medium text-danger">Critical blockers</div>
              <div className="font-serif text-2xl font-medium text-danger mt-1">
                {launchReadiness?.critical_blockers ?? 0}
              </div>
            </div>
            <div className="rounded-sm bg-warn/10 px-3 py-2">
              <div className="text-meta font-medium text-warn">Warnings</div>
              <div className="font-serif text-2xl font-medium text-warn mt-1">
                {launchReadiness?.warnings ?? 0}
              </div>
            </div>
            <div className="rounded-sm bg-canvas-sunk px-3 py-2">
              <div className="text-meta font-medium text-ink-secondary">Launch status</div>
              <div className="text-small font-medium text-ink mt-1">
                {launchReadiness?.production_ready ? 'Ready' : 'Blocked'}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="text-subhead font-medium text-ink">Product Demo</div>
          <div className="font-serif text-2xl font-medium text-ink mt-3">
            {pilotReadiness?.product_demo_score ?? 0}%
          </div>
          <div className="text-meta text-ink-muted mt-1">
            {pilotReadiness?.product_demo_ready
              ? 'Ready for complete walkthrough'
              : 'Needs demo data'}
          </div>
        </div>
        <div className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="text-subhead font-medium text-ink">Internal Pilot</div>
          <div className="font-serif text-2xl font-medium text-ink mt-3">
            {pilotReadiness?.internal_pilot_score ?? 0}%
          </div>
          <div className="text-meta text-ink-muted mt-1">
            {pilotReadiness?.internal_pilot_ready
              ? 'Ready for staff pilot'
              : 'Needs operational setup'}
          </div>
        </div>
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-md border border-border bg-canvas-raised p-4"
          >
            {item.ready ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Circle className="h-5 w-5 text-ink-faint" />
            )}
            <div>
              <div className="text-small font-medium text-ink">{item.label}</div>
              <div className="text-meta text-ink-muted">{item.ready ? 'Ready' : 'Needs setup'}</div>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        {requirementGroups.map(([category, requirements]) => (
          <div key={category} className="bg-canvas-raised border border-border rounded-md p-4">
            <div className="text-subhead font-medium text-ink">{category}</div>
            <div className="mt-3 divide-y divide-border">
              {requirements.map((requirement) => (
                <div key={requirement.key} className="grid gap-3 py-3 lg:grid-cols-[220px_1fr]">
                  <div className="flex items-start gap-2">
                    {requirement.ready ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 ${requirement.severity === 'critical' ? 'text-danger' : 'text-warn'}`}
                      />
                    )}
                    <div>
                      <div className="text-small font-medium text-ink">{requirement.label}</div>
                      <div className="text-meta text-ink-muted mt-1">{requirement.detail}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-small text-ink-secondary">{requirement.action}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requirement.env_vars.map((envVar) => (
                        <span
                          key={envVar}
                          className="rounded-sm border border-border bg-canvas-sunk px-2 py-1 font-mono text-micro text-ink-secondary"
                        >
                          {envVar}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="flex items-center gap-2 text-subhead font-medium text-ink">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Required Environment
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {Object.entries(capabilities ?? {}).map(([key, capability]) => (
            <div key={key} className="rounded-sm bg-canvas-sunk p-3">
              <div className="text-small font-medium capitalize text-ink">
                {key.replace('_', ' ')}
              </div>
              <div className="font-mono text-micro text-ink-muted mt-1">
                {(capability.env_vars ?? []).join(', ') || 'No env vars required'}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="text-subhead font-medium text-ink">Seed Missing Roles</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => seedPilotMutation.mutate()}
            className="bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75"
          >
            Seed pilot workspace
          </button>
          <button
            disabled={(users?.data ?? []).some(
              (user) => user.role === 'provider' && user.is_active
            )}
            onClick={() => createUserMutation.mutate('provider')}
            className="rounded-md border border-border bg-canvas-sunk px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-raised disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create provider
          </button>
          <button
            disabled={(users?.data ?? []).some(
              (user) => user.role === 'front_desk' && user.is_active
            )}
            onClick={() => createUserMutation.mutate('front_desk')}
            className="rounded-md border border-border bg-canvas-sunk px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-raised disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create front desk
          </button>
        </div>
      </section>
    </div>
  );
}
