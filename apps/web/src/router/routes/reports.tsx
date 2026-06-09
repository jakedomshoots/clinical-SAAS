import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, ClipboardCheck, Download, FileClock, Gauge, ListChecks } from 'lucide-react';
import { ROUTES, type AnalyticsSummary, type DailyCloseout } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

function ReportsPage() {
  const api = useApi();
  const [range, setRange] = useState('7');
  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.READINESS, 'reports', range],
    queryFn: () => api.get<AnalyticsSummary>(ROUTES.ANALYTICS_SUMMARY),
  });
  const { data: closeout, isLoading: isCloseoutLoading } = useQuery({
    queryKey: QUERY_KEYS.DAILY_CLOSEOUT,
    queryFn: () => api.get<DailyCloseout>(ROUTES.ANALYTICS_DAILY_CLOSEOUT),
  });
  const summaryCsv = useMemo(() => {
    const rows = [['group', 'metric', 'value']];
    for (const [group, metrics] of Object.entries(data ?? {})) {
      for (const [metric, value] of Object.entries(metrics)) rows.push([group, metric, String(value)]);
    }
    return rows.map((row) => row.join(',')).join('\n');
  }, [data]);
  const closeoutCsv = useMemo(() => {
    if (!closeout) return 'section,metric,value\n';
    const rows = [['section', 'metric', 'value']];
    for (const [metric, value] of Object.entries(closeout.totals)) rows.push(['totals', metric, String(value)]);
    for (const [metric, value] of Object.entries(closeout.aging)) rows.push(['aging', metric, String(value)]);
    for (const [metric, value] of Object.entries(closeout.billing)) rows.push(['billing', metric, String(value)]);
    for (const risk of closeout.risk_register) rows.push(['risk', risk.label, String(risk.count)]);
    for (const action of closeout.recommended_actions) rows.push(['action', action.label, action.detail]);
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }, [closeout]);
  const closeoutMetrics = closeout ? [
    ['Open tasks', closeout.totals.open_tasks ?? 0, `${closeout.totals.urgent_tasks ?? 0} urgent`],
    ['Documents', closeout.totals.documents_needing_review ?? 0, `${closeout.aging.documents_over_72h ?? 0} over 72h`],
    ['Clinical review', (closeout.totals.medications_needing_review ?? 0) + (closeout.totals.labs_needing_review ?? 0) + (closeout.totals.care_plan_blockers ?? 0), `${closeout.totals.labs_needing_review ?? 0} labs`],
    ['Unsigned encounters', closeout.totals.unsigned_encounters ?? 0, 'provider closeout'],
    ['Billing gaps', closeout.billing.missing_coding_count ?? 0, `${closeout.billing.remittance_pending_count ?? 0} remittance pending`],
    ['Integration failures', closeout.totals.failed_integrations ?? 0, 'retry queue'],
  ] : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-display text-ink">Reports</h1>
          <p className="text-small text-ink-muted mt-1">Operational intelligence</p>
        </div>
        {closeout && (
          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium ${closeout.status === 'clear' ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
            {closeout.status === 'clear' ? <ClipboardCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            Daily closeout {closeout.status}
          </span>
        )}
      </header>
      <section className="flex flex-wrap items-center gap-2 bg-canvas-raised border border-border rounded-md p-3">
        <select value={range} onChange={(event) => setRange(event.target.value)} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(summaryCsv)}`} download={`concierge-os-report-${range}d.csv`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75">
          <Download className="h-4 w-4" />
          Export summary
        </a>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(closeoutCsv)}`} download="concierge-os-daily-closeout.csv" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75">
          <Download className="h-4 w-4" />
          Export closeout
        </a>
      </section>

      {isCloseoutLoading ? <LoadingState label="Loading daily closeout" /> : closeout && (
        <>
          <section className="grid gap-3 md:grid-cols-5">
            {closeoutMetrics.map(([label, value, note]) => (
              <div key={label} className="bg-canvas-raised border border-border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <span className="text-meta text-ink-muted">{label}</span>
                  <Gauge className="h-4 w-4 text-accent" />
                </div>
                <div className="font-serif text-2xl font-medium text-ink mt-3">{value}</div>
                <div className="text-meta text-ink-muted mt-1">{note}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="bg-canvas-raised border border-border rounded-md">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <FileClock className="h-4 w-4 text-accent" />
                <div>
                  <h2 className="text-subhead font-medium text-ink">Daily Closeout Risk</h2>
                  <p className="text-small text-ink-muted mt-1">Manager view of unresolved blockers before the clinic day is closed</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-canvas-sunk border-b border-border text-left text-meta font-medium text-ink-muted uppercase">
                    <tr>
                      <th className="px-4 py-3">Risk</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Count</th>
                      <th className="px-4 py-3">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closeout.risk_register.map((risk) => (
                      <tr key={risk.label} className="border-b border-border-subtle last:border-b-0 hover:bg-canvas-sunk/50 transition-colors duration-150">
                        <td className="px-4 py-3 text-small font-medium text-ink">{risk.label}</td>
                        <td className="px-4 py-3 capitalize text-small text-ink-secondary">{risk.category}</td>
                        <td className="px-4 py-3 text-small font-medium text-ink">{risk.count}</td>
                        <td className="px-4 py-3 text-small text-ink-secondary">{risk.detail}</td>
                      </tr>
                    ))}
                    {closeout.risk_register.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-small text-ink-faint">No closeout risks are currently open</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="bg-canvas-raised border border-border rounded-md">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <ListChecks className="h-4 w-4 text-accent" />
                <div>
                  <h2 className="text-subhead font-medium text-ink">Recommended Actions</h2>
                  <p className="text-small text-ink-muted mt-1">{new Date(closeout.generated_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="divide-y divide-border">
                {closeout.recommended_actions.map((action) => (
                  <Link key={action.key} to={action.route} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas-sunk/50 transition-colors duration-150">
                    <div>
                      <div className="text-small font-medium text-ink">{action.label}</div>
                      <div className="text-meta text-ink-muted mt-0.5">{action.detail}</div>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                  </Link>
                ))}
                {closeout.recommended_actions.length === 0 && (
                  <div className="px-4 py-8 text-small text-ink-faint">No recommended actions.</div>
                )}
              </div>
            </aside>
          </section>
        </>
      )}

      {isLoading ? <LoadingState label="Loading reports" /> : (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data ?? {}).map(([group, metrics]) => (
            <div key={group} className="bg-canvas-raised border border-border rounded-md p-4">
              <div className="flex items-center gap-2 text-subhead font-medium capitalize text-ink">
                <BarChart3 className="h-4 w-4 text-accent" />
                {group.replace('_', ' ')}
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(metrics).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-sm bg-canvas-sunk px-3 py-2 text-small">
                    <span className="capitalize text-ink-secondary">{label.replace('_', ' ')}</span>
                    <span className="font-medium text-ink">{String(value)}</span>
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

function csvCell(value: string) {
  if (!/["",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
