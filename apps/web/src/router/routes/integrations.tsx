import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, PlugZap, TriangleAlert } from 'lucide-react';
import { ROUTES, type IntegrationCapabilities } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/integrations')({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'integrations-page'],
    queryFn: () => api.get<IntegrationCapabilities>(ROUTES.INTEGRATION_CAPABILITIES),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Vendor readiness</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Integrations</h1>
      </header>
      {isLoading ? <LoadingState label="Loading integrations" /> : (
        <section className="grid gap-3 lg:grid-cols-2">
          {Object.entries(data ?? {}).map(([name, capability]) => (
            <div key={name} className="rounded-md border border-clinic-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold capitalize text-clinic-900">
                  <PlugZap className="h-4 w-4 text-accent-700" />
                  {capability.label ?? name.replace('_', ' ')}
                </div>
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${capability.configured ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {capability.configured ? <CheckCircle2 className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
                  {capability.configured ? 'configured' : 'needs credentials'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md bg-clinic-50 px-2 py-1 font-medium text-clinic-600">mode: {capability.mode ?? 'unknown'}</span>
                <span className={`rounded-md px-2 py-1 font-medium ${capability.healthy ? 'bg-accent-50 text-accent-800' : 'bg-clinic-50 text-clinic-600'}`}>
                  {capability.healthy ? 'health ok' : capability.error ?? 'health pending'}
                </span>
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-clinic-400">Workflows</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(capability.workflows ?? []).map((item) => <span key={item} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs text-clinic-700">{item}</span>)}
              </div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-clinic-400">Capabilities</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {capability.supports.map((item) => <span key={item} className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs text-clinic-600">{item.replace('_', ' ')}</span>)}
              </div>
              <div className="mt-3 rounded-md bg-clinic-50 px-3 py-2 font-mono text-xs text-clinic-500">
                {(capability.env_vars ?? []).join(' · ') || 'No env var required'}
              </div>
              {capability.action && (
                <div className="mt-3 rounded-md border border-clinic-200 px-3 py-2 text-sm text-clinic-700">
                  {capability.action}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
