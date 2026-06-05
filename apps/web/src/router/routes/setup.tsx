import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { ROUTES, type IntegrationCapabilities, type SessionPolicy, type UserListResponse } from '@concierge-os/shared';
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

  const checklist = [
    { label: 'Core services online', ready: Object.values(ready?.checks ?? {}).every((check) => check.ok) },
    { label: 'Production env template present', ready: Boolean(ready?.deployment?.production_env_template?.ok) },
    { label: 'At least one admin user', ready: (users?.data ?? []).some((user) => user.role === 'admin' && user.is_active) },
    { label: 'At least one provider user', ready: (users?.data ?? []).some((user) => user.role === 'provider' && user.is_active) },
    { label: 'PHI re-auth policy configured', ready: Boolean(sessionPolicy?.phi_reauth_required) },
    { label: 'External integrations configured', ready: Object.values(capabilities ?? {}).some((capability) => capability.configured) },
  ];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Launch readiness</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Setup Checklist</h1>
      </header>
      <section className="grid gap-3 md:grid-cols-2">
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
    </div>
  );
}
