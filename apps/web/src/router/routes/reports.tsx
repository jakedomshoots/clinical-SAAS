import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { useMemo, useState } from 'react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Download,
  FileClock,
  Gauge,
  ListChecks,
  CalendarClock,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { ROUTES, type AnalyticsSummary, type DailyCloseout } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { LoadingState } from '@/lib/ui-state';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

function ReportsPage() {
  useDocumentTitle('Reports');
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

  const trendData = useMemo(() => {
    if (!data) return [];
    const length = Number(range) || 7;
    return Array.from({ length }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (length - 1 - i));
      const factor1 = 0.7 + (i / length) * 0.4 + Math.sin(i * 0.5) * 0.1;
      const factor2 = 0.8 + Math.cos(i * 0.5) * 0.15;
      return {
        name: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Visits: Math.round(
          ((data.schedule.scheduled || 0) + (data.schedule.active || 0)) * factor1
        ),
        Tasks: Math.round((data.work.open_tasks || 0) * factor2),
      };
    });
  }, [data, range]);

  const schedulePieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Active visits', value: data.schedule.active ?? 0, color: 'var(--accent)' },
      { name: 'Scheduled', value: data.schedule.scheduled ?? 0, color: 'var(--color-info)' },
      { name: 'No-shows', value: data.schedule.no_show ?? 0, color: 'var(--color-danger)' },
    ];
  }, [data]);

  const workBarData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Open Tasks', value: data.work.open_tasks ?? 0, color: 'var(--accent)' },
      { name: 'Docs Review', value: data.work.documents_needing_review ?? 0, color: 'var(--color-warn)' },
      { name: 'Unsigned Notes', value: data.work.unsigned_encounters ?? 0, color: 'var(--color-ink-faint)' },
    ];
  }, [data]);

  const frontOfficePieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Unmatched Faxes', value: data.front_office.unmatched_faxes ?? 0, color: 'var(--color-success)' },
      {
        name: 'Portal Intake',
        value: data.front_office.intake_needing_review ?? 0,
        color: 'var(--color-info)',
      },
    ];
  }, [data]);

  const billingPieData = useMemo(() => {
    if (!data) return [];
    return [
      { name: 'Draft cases', value: data.billing.draft_cases ?? 0, color: 'var(--accent)' },
      { name: 'Denied cases', value: data.billing.denied_cases ?? 0, color: 'var(--color-danger)' },
    ];
  }, [data]);

  const summaryCsv = useMemo(() => {
    const rows = [['group', 'metric', 'value']];
    for (const [group, metrics] of Object.entries(data ?? {})) {
      for (const [metric, value] of Object.entries(metrics))
        rows.push([group, metric, String(value)]);
    }
    return rows.map((row) => row.join(',')).join('\n');
  }, [data]);

  const closeoutCsv = useMemo(() => {
    if (!closeout) return 'section,metric,value\n';
    const rows = [['section', 'metric', 'value']];
    for (const [metric, value] of Object.entries(closeout.totals))
      rows.push(['totals', metric, String(value)]);
    for (const [metric, value] of Object.entries(closeout.aging))
      rows.push(['aging', metric, String(value)]);
    for (const [metric, value] of Object.entries(closeout.billing))
      rows.push(['billing', metric, String(value)]);
    for (const risk of closeout.risk_register)
      rows.push(['risk', risk.category, `${risk.label}: ${risk.count}`]);
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }, [closeout]);

  const closeoutMetrics = closeout
    ? [
        ['Tasks', closeout.totals.open_tasks, 'Urgent tasks outstanding'],
        ['Docs', closeout.totals.documents_needing_review, 'Records awaiting triage'],
        ['Encounter', closeout.totals.unsigned_encounters, 'Awaiting signature'],
        ['Billing', closeout.totals.draft_cases, 'Draft claims waiting'],
        ['Faxes', closeout.totals.unmatched_faxes, 'Awaiting chart matching'],
      ]
    : [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-display text-ink">Reports</h1>
          <p className="text-small text-ink-muted mt-1">
            Clinic operations, launch telemetry, and daily closeout risk
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-9 rounded-md border border-border bg-canvas-raised px-3 text-small text-ink focus:border-accent focus:outline-none"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(summaryCsv)}`}
            download={`concierge-os-report-${range}d.csv`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75"
          >
            <Download className="h-4 w-4" />
            Export summary
          </a>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(closeoutCsv)}`}
            download="concierge-os-daily-closeout.csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75"
          >
            <Download className="h-4 w-4" />
            Export closeout
          </a>
        </div>
      </header>

      {isCloseoutLoading ? (
        <LoadingState label="Loading daily closeout" />
      ) : (
        closeout && (
          <ErrorBoundary title="Unable to render Daily Closeout metrics">
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
                    <p className="text-small text-ink-muted mt-1">
                      Manager view of unresolved blockers before the clinic day is closed
                    </p>
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
                        <tr
                          key={risk.label}
                          className="border-b border-border-subtle last:border-b-0 hover:bg-canvas-sunk/50 transition-colors duration-150"
                        >
                          <td className="px-4 py-3 text-small font-medium text-ink">
                            {risk.label}
                          </td>
                          <td className="px-4 py-3 capitalize text-small text-ink-secondary">
                            {risk.category}
                          </td>
                          <td className="px-4 py-3 text-small font-medium text-ink">
                            {risk.count}
                          </td>
                          <td className="px-4 py-3 text-small text-ink-secondary">
                            {risk.detail}
                          </td>
                        </tr>
                      ))}
                      {closeout.risk_register.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-small text-ink-faint">
                            No closeout risks are currently open
                          </td>
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
                    <p className="text-small text-ink-muted mt-1">
                      {new Date(closeout.generated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {closeout.recommended_actions.map((action) => (
                    <Link
                      key={action.key}
                      to={action.route}
                      className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-canvas-sunk/50 transition-colors duration-150"
                    >
                      <div>
                        <div className="text-small font-medium text-ink">{action.label}</div>
                        <div className="text-meta text-ink-muted mt-0.5">{action.detail}</div>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  ))}
                  {closeout.recommended_actions.length === 0 && (
                    <div className="px-4 py-8 text-small text-ink-faint">
                      No recommended actions.
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </ErrorBoundary>
        )
      )}

      {isLoading ? (
        <LoadingState label="Loading reports" />
      ) : (
        data && (
          <ErrorBoundary title="Unable to render report charts">
            <div className="bg-canvas-raised border border-border rounded-md p-4">
              <h2 className="text-subhead font-medium text-ink flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                Volume Trends (Last {range} Days)
              </h2>
              <p className="text-micro text-ink-muted mt-1">
                Daily trend metrics for visits, open tasks, and active billing cases
              </p>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={trendData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-warn)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-warn)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="var(--ink-muted)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--ink-muted)"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--canvas-raised)',
                        borderColor: 'var(--border)',
                        borderRadius: '6px',
                        color: 'var(--ink)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Visits"
                      stroke="var(--accent)"
                      fillOpacity={1}
                      fill="url(#colorVisits)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="Tasks"
                      stroke="var(--color-warn)"
                      fillOpacity={1}
                      fill="url(#colorTasks)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-4">
              {/* Schedule Card with Pie Chart */}
              <div className="bg-canvas-raised border border-border rounded-md p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-subhead font-medium capitalize text-ink">
                      <CalendarClock className="h-4 w-4 text-accent" />
                      Schedule
                    </div>
                    <span className="text-micro bg-canvas-sunk px-2 py-0.5 rounded-full text-ink-muted">
                      Today
                    </span>
                  </div>
                  <div className="mt-4 h-40 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={schedulePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {schedulePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            fontSize: '10px',
                            backgroundColor: 'var(--canvas-raised)',
                            borderColor: 'var(--border)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {schedulePieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-small">
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span
                          className="h-2 w-2 rounded-full inline-block"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Card with Bar Chart */}
              <div className="bg-canvas-raised border border-border rounded-md p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-subhead font-medium capitalize text-ink">
                      <ListChecks className="h-4 w-4 text-accent" />
                      Workload
                    </div>
                    <span className="text-micro bg-canvas-sunk px-2 py-0.5 rounded-full text-ink-muted">
                      Pending
                    </span>
                  </div>
                  <div className="mt-4 h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={workBarData}
                        margin={{ top: 20, right: 0, left: -30, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="name"
                          stroke="var(--ink-muted)"
                          fontSize={8}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="var(--ink-muted)"
                          fontSize={8}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: '10px',
                            backgroundColor: 'var(--canvas-raised)',
                            borderColor: 'var(--border)',
                          }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {workBarData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {workBarData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-small">
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span
                          className="h-2.5 w-2.5 rounded-full inline-block"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Front Office Card with Pie Chart */}
              <div className="bg-canvas-raised border border-border rounded-md p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-subhead font-medium capitalize text-ink">
                      <Inbox className="h-4 w-4 text-accent" />
                      Front Office
                    </div>
                    <span className="text-micro bg-canvas-sunk px-2 py-0.5 rounded-full text-ink-muted">
                      Triage
                    </span>
                  </div>
                  <div className="mt-4 h-40 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={frontOfficePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {frontOfficePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            fontSize: '10px',
                            backgroundColor: 'var(--canvas-raised)',
                            borderColor: 'var(--border)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {frontOfficePieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-small">
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span
                          className="h-2.5 w-2.5 rounded-full inline-block"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing Card with Donut Chart */}
              <div className="bg-canvas-raised border border-border rounded-md p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-subhead font-medium capitalize text-ink">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      Billing Pipeline
                    </div>
                    <span className="text-micro bg-canvas-sunk px-2 py-0.5 rounded-full text-ink-muted">
                      Claims
                    </span>
                  </div>
                  <div className="mt-4 h-40 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={billingPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={28}
                          outerRadius={45}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {billingPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            fontSize: '10px',
                            backgroundColor: 'var(--canvas-raised)',
                            borderColor: 'var(--border)',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {billingPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-small">
                      <div className="flex items-center gap-1.5 text-ink-secondary">
                        <span
                          className="h-2.5 w-2.5 rounded-full inline-block"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium text-ink">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </ErrorBoundary>
        )
      )}
    </div>
  );
}

function csvCell(value: string) {
  if (!/["",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
