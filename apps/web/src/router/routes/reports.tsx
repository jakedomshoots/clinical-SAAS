import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { ROUTES, type AnalyticsSummary } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

function ReportsPage() {
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'reports'],
    queryFn: () => api.get<AnalyticsSummary>(ROUTES.ANALYTICS_SUMMARY),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Operational intelligence</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Reports</h1>
      </header>
      {isLoading ? <LoadingState label="Loading reports" /> : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data ?? {}).map(([group, metrics]) => (
            <div key={group} className="rounded-md border border-clinic-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold capitalize text-clinic-800">
                <BarChart3 className="h-4 w-4 text-accent-700" />
                {group.replace('_', ' ')}
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(metrics).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-md bg-clinic-50 px-3 py-2 text-sm">
                    <span className="capitalize text-clinic-600">{label.replace('_', ' ')}</span>
                    <span className="font-semibold text-clinic-900">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
