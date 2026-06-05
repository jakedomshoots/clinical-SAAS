import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { ROUTES, type IntegrationCapabilities, type LaunchReadiness, type PilotReadiness, type SessionPolicy, type UserListResponse } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';

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

function SetupPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: ready } = useQuery({
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
  const { data: launchReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'launch-readiness'],
    queryFn: () => api.get<LaunchReadiness>(ROUTES.LAUNCH_READINESS),
  });
  const createUserMutation = useMutation({
    mutationFn: (role: 'provider' | 'front_desk') => api.post(ROUTES.AUTH.REGISTER, {
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
    { label: 'Core services online', ready: Object.values(ready?.checks ?? {}).every((check) => check.ok) },
    { label: 'Production env template present', ready: Boolean(ready?.deployment?.production_env_template?.ok) },
    { label: 'At least one admin user', ready: (users?.data ?? []).some((user) => user.role === 'admin' && user.is_active) },
    { label: 'At least one provider user', ready: (users?.data ?? []).some((user) => user.role === 'provider' && user.is_active) },
    { label: 'PHI re-auth policy configured', ready: Boolean(sessionPolicy?.phi_reauth_required) },
    { label: 'External integrations configured', ready: Object.values(capabilities ?? {}).some((capability) => capability.configured) },
  ];
  const requirementGroups = Object.entries(
    (launchReadiness?.requirements ?? []).reduce<Record<string, NonNullable<LaunchReadiness['requirements']>>>((groups, requirement) => {
      groups[requirement.category] = [...(groups[requirement.category] ?? []), requirement];
      return groups;
    }, {}),
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Launch readiness</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Setup Checklist</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-clinic-200 bg-white p-4 md:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-clinic-900">Production Readiness</div>
              <div className="mt-1 text-xs text-clinic-500">Live-patient launch blockers across security, infrastructure, integrations, and operations</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold text-clinic-900">{launchReadiness?.score ?? 0}%</div>
              <div className="text-xs text-clinic-500">{launchReadiness?.environment ?? 'unknown'} environment</div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div className="rounded-md bg-red-50 px-3 py-2">
              <div className="text-xs font-medium text-red-700">Critical blockers</div>
              <div className="mt-1 text-xl font-semibold text-red-800">{launchReadiness?.critical_blockers ?? 0}</div>
            </div>
            <div className="rounded-md bg-amber-50 px-3 py-2">
              <div className="text-xs font-medium text-amber-700">Warnings</div>
              <div className="mt-1 text-xl font-semibold text-amber-800">{launchReadiness?.warnings ?? 0}</div>
            </div>
            <div className="rounded-md bg-clinic-50 px-3 py-2">
              <div className="text-xs font-medium text-clinic-600">Launch status</div>
              <div className="mt-1 text-sm font-semibold text-clinic-900">{launchReadiness?.production_ready ? 'Ready' : 'Blocked'}</div>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Product Demo</div>
          <div className="mt-3 text-3xl font-semibold text-clinic-900">{pilotReadiness?.product_demo_score ?? 0}%</div>
          <div className="text-xs text-clinic-500">{pilotReadiness?.product_demo_ready ? 'Ready for complete walkthrough' : 'Needs demo data'}</div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="text-sm font-semibold text-clinic-900">Internal Pilot</div>
          <div className="mt-3 text-3xl font-semibold text-clinic-900">{pilotReadiness?.internal_pilot_score ?? 0}%</div>
          <div className="text-xs text-clinic-500">{pilotReadiness?.internal_pilot_ready ? 'Ready for staff pilot' : 'Needs operational setup'}</div>
        </div>
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-md border border-clinic-200 bg-white p-4">
            {item.ready ? <CheckCircle2 className="h-5 w-5 text-accent-700" /> : <Circle className="h-5 w-5 text-clinic-300" />}
            <div>
              <div className="text-sm font-semibold text-clinic-900">{item.label}</div>
              <div className="text-xs text-clinic-500">{item.ready ? 'Ready' : 'Needs setup'}</div>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        {requirementGroups.map(([category, requirements]) => (
          <div key={category} className="rounded-md border border-clinic-200 bg-white p-4">
            <div className="text-sm font-semibold text-clinic-900">{category}</div>
            <div className="mt-3 divide-y divide-clinic-100">
              {requirements.map((requirement) => (
                <div key={requirement.key} className="grid gap-3 py-3 lg:grid-cols-[220px_1fr]">
                  <div className="flex items-start gap-2">
                    {requirement.ready ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent-700" />
                    ) : (
                      <AlertTriangle className={`mt-0.5 h-4 w-4 ${requirement.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                    )}
                    <div>
                      <div className="text-sm font-medium text-clinic-900">{requirement.label}</div>
                      <div className="mt-1 text-xs text-clinic-500">{requirement.detail}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-clinic-700">{requirement.action}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {requirement.env_vars.map((envVar) => (
                        <span key={envVar} className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 font-mono text-xs text-clinic-600">{envVar}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
          <ShieldCheck className="h-4 w-4 text-accent-700" />
          Required Environment
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {Object.entries(capabilities ?? {}).map(([key, capability]) => (
            <div key={key} className="rounded-md bg-clinic-50 p-3">
              <div className="text-sm font-medium capitalize text-clinic-800">{key.replace('_', ' ')}</div>
              <div className="mt-1 font-mono text-xs text-clinic-500">{(capability.env_vars ?? []).join(', ') || 'No env vars required'}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="text-sm font-semibold text-clinic-800">Seed Missing Roles</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => seedPilotMutation.mutate()}
            className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700"
          >
            Seed pilot workspace
          </button>
          <button
            disabled={(users?.data ?? []).some((user) => user.role === 'provider' && user.is_active)}
            onClick={() => createUserMutation.mutate('provider')}
            className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create provider
          </button>
          <button
            disabled={(users?.data ?? []).some((user) => user.role === 'front_desk' && user.is_active)}
            onClick={() => createUserMutation.mutate('front_desk')}
            className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create front desk
          </button>
        </div>
      </section>
    </div>
  );
}
