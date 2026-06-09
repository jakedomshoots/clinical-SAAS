import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bot, ShieldCheck } from 'lucide-react';
import type { AuditEvent } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';

interface ListResponse<T> {
  data: T[];
  total: number;
}

export const Route = createFileRoute('/assistant-review')({
  component: AssistantReviewPage,
});

function AssistantReviewPage() {
  const api = useApi();
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'assistant-review'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=50'),
  });
  const rows = (data?.data ?? [])
    .filter((event) => event.event_type.startsWith('assistant.'))
    .filter((event) => actionFilter === 'all' || event.event_type === actionFilter)
    .filter((event) => `${event.event_type} ${JSON.stringify(event.payload)}`.toLowerCase().includes(search.toLowerCase()));
  const riskFor = (eventType: string) => {
    if (eventType.includes('fax')) return 'Medium';
    if (eventType.includes('message')) return 'High';
    if (eventType.includes('task')) return 'Low';
    return 'Review';
  };
  const statusFor = (event: AuditEvent) => (event.payload as { status?: string })?.status ?? 'Confirmed';

  return (
    <div className="space-y-5">
      <header>
        <p className="text-small text-ink-muted">Assistant governance</p>
        <h1 className="mt-1 font-serif text-display text-ink">Assistant Review</h1>
        <p className="mt-2 max-w-3xl text-small text-ink-muted">Every Assistant-assisted action should show status, risk, confirmation history, and audit payload before staff trusts it.</p>
      </header>
      <section className="grid gap-3 md:grid-cols-3">
        {[
          ['Pending review', rows.filter((row) => statusFor(row).toLowerCase().includes('pending')).length],
          ['Confirmed actions', rows.filter((row) => statusFor(row).toLowerCase().includes('confirmed')).length],
          ['High-risk drafts', rows.filter((row) => riskFor(row.event_type) === 'High').length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-canvas-raised p-4">
            <div className="flex items-center gap-2 text-meta text-ink-muted"><ShieldCheck className="h-4 w-4 text-accent" />{label}</div>
            <div className="mt-1 font-serif text-2xl font-medium text-ink">{value}</div>
          </div>
        ))}
      </section>
      <section className="flex flex-wrap gap-2 rounded-md border border-border bg-canvas-raised p-3">
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink">
          <option value="all">All actions</option>
          <option value="assistant.task_created">Tasks</option>
          <option value="assistant.message_drafted">Portal drafts</option>
          <option value="assistant.fax_match_staged">Fax matches</option>
        </select>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, action, payload" className="min-w-64 bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink" />
      </section>
      {isLoading ? <LoadingState label="Loading assistant actions" /> : (
        <section className="overflow-hidden rounded-md border border-border bg-canvas-raised">
          <div className="divide-y divide-border">
            {rows.map((event) => (
              <div key={event.id} className="grid gap-3 px-4 py-3 md:grid-cols-[12rem_1fr_14rem] hover:bg-canvas-sunk/50">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Bot className="h-4 w-4 text-accent" />
                  {humanizeWorkflowLabel(event.event_type.replace('assistant.', ''))}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-pill bg-canvas-sunk text-ink-muted px-2 py-0.5 text-micro font-medium">Status: {humanizeWorkflowLabel(statusFor(event))}</span>
                    <span className="rounded-pill bg-warn/10 text-warn px-2 py-0.5 text-micro font-medium">Risk: {riskFor(event.event_type)}</span>
                  </div>
                  <details className="text-xs text-ink-secondary">
                    <summary className="cursor-pointer font-medium text-ink-secondary">Audit payload</summary>
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-canvas p-2 text-[11px]">{JSON.stringify(event.payload, null, 2)}</pre>
                  </details>
                </div>
                <div className="text-xs text-ink-muted md:text-right">{new Date(event.created_at).toLocaleString()}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-ink-faint">No assistant-confirmed actions yet</div>}
          </div>
        </section>
      )}
    </div>
  );
}
