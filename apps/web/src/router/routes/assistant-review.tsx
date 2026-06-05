import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import type { AuditEvent } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

interface ListResponse<T> {
  data: T[];
  total: number;
}

export const Route = createFileRoute('/assistant-review')({
  component: AssistantReviewPage,
});

function AssistantReviewPage() {
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'assistant-review'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=50'),
  });
  const rows = (data?.data ?? []).filter((event) => event.event_type.startsWith('assistant.'));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">AI governance</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Assistant Review</h1>
      </header>
      {isLoading ? <LoadingState label="Loading assistant actions" /> : (
        <section className="overflow-hidden rounded-md border border-clinic-200 bg-white">
          <div className="divide-y divide-clinic-100">
            {rows.map((event) => (
              <div key={event.id} className="grid gap-3 px-4 py-3 md:grid-cols-[12rem_1fr_12rem]">
                <div className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
                  <Bot className="h-4 w-4 text-accent-700" />
                  {event.event_type.replace('assistant.', '')}
                </div>
                <div className="text-xs text-clinic-600">{JSON.stringify(event.payload)}</div>
                <div className="text-xs text-clinic-500 md:text-right">{new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-clinic-400">No assistant-confirmed actions yet</div>}
          </div>
        </section>
      )}
    </div>
  );
}
