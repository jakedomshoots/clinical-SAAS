import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import type { AuditEvent, Fax, MessageThread, Task, TodayQueue } from '@concierge-os/shared';

export const Route = createFileRoute('/')({
  component: CommandCenterPage,
});

interface ListResponse<T> {
  data: T[];
  total: number;
}

function dateOnly(date: Date) {
  return date.toISOString().split('T')[0];
}

function CommandCenterPage() {
  const api = useApi();
  const today = new Date('2026-06-03T12:00:00-04:00');
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const { data: todayQueue } = useQuery({
    queryKey: [...QUERY_KEYS.TODAY_QUEUE, 'command-center'],
    queryFn: () => api.get<TodayQueue>(`/schedule/today-queue?start_date=${dateOnly(today)}&end_date=${dateOnly(tomorrow)}`),
  });
  const { data: tasks } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'command-center'],
    queryFn: () => api.get<ListResponse<Task>>('/tasks?page=1&page_size=50'),
  });
  const { data: inboundFaxes } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'command-center', 'inbound'],
    queryFn: () => api.get<ListResponse<Fax>>('/faxes?direction=inbound&page=1&page_size=50'),
  });
  const { data: threads } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'command-center'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });
  const { data: auditEvents } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'command-center'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=6'),
  });

  const openTasks = tasks?.data.filter((task) => task.status !== 'completed' && task.status !== 'cancelled') ?? [];
  const dueToday = openTasks.filter((task) => task.due_date && dateOnly(new Date(task.due_date)) === dateOnly(today)).length;
  const unreadMessages = threads?.data.reduce((count, thread) => count + thread.unread_count, 0) ?? 0;
  const unmatchedFaxes = inboundFaxes?.data.filter((fax) => !fax.patient_id).length ?? 0;
  const todayItems = (todayQueue?.data ?? [])
    .filter((item) => dateOnly(new Date(item.appointment.start_time)) === dateOnly(today))
    .sort((a, b) => a.appointment.start_time.localeCompare(b.appointment.start_time));
  const checkedIn = todayQueue?.checked_in ?? 0;

  const queueMetrics = [
    { label: 'Patients scheduled', value: String(todayQueue?.total ?? todayItems.length), note: `${checkedIn} active, ${todayQueue?.blocked ?? 0} blocked`, icon: Users, tone: 'text-clinic-700' },
    { label: 'Open tasks', value: String(openTasks.length), note: `${dueToday} due today`, icon: CheckCircle2, tone: 'text-amber-700' },
    { label: 'Unread messages', value: String(unreadMessages), note: `${threads?.total ?? 0} active threads`, icon: MessageSquare, tone: 'text-accent-700' },
    { label: 'Fax inbox', value: String(inboundFaxes?.total ?? 0), note: `${unmatchedFaxes} unmatched`, icon: FileText, tone: 'text-red-700' },
  ];

  const riskItems = [
    ...openTasks
      .filter((task) => task.priority === 'urgent' || task.priority === 'high')
      .slice(0, 3)
      .map((task) => ({
        label: task.title,
        detail: task.patient_name ? `${task.patient_name} - ${task.assigned_to_name ?? 'Unassigned'}` : task.description ?? 'Needs owner review',
        severity: task.priority === 'urgent' ? 'urgent' : 'high',
      })),
    ...((unmatchedFaxes > 0)
      ? [{ label: 'Unmatched fax queue', detail: `${unmatchedFaxes} inbound documents need chart matching`, severity: 'normal' }]
      : []),
  ].slice(0, 4);

  const handoffItems = [
    `${todayItems.filter((item) => item.appointment.status === 'scheduled').length} scheduled visits still waiting`,
    `${openTasks.filter((task) => task.priority === 'urgent').length} urgent tasks require same-day action`,
    `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'} across patient and staff threads`,
  ];

  const recentAuditEvents = auditEvents?.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-clinic-500">Wednesday clinic session</p>
          <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Command Center</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-accent-200 bg-accent-50 px-2.5 py-1.5 font-medium text-accent-800">
            <span className="h-2 w-2 rounded-full bg-accent-600" />
            Demo-ready
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-clinic-200 bg-white px-2.5 py-1.5 text-clinic-600">
            <Clock className="h-3.5 w-3.5" />
            Last sync just now
          </span>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {queueMetrics.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="rounded-md border border-clinic-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-clinic-500">{label}</span>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-normal text-clinic-900">{value}</div>
            <div className="mt-1 text-sm text-clinic-500">{note}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-md border border-clinic-200 bg-white">
          <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-clinic-800">Today&apos;s Schedule</h2>
              <p className="text-xs text-clinic-500">Live clinic flow and intake state</p>
            </div>
            <Link to="/scheduling" className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:text-accent-800">
              Open schedule
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-clinic-100 bg-clinic-50 text-left text-xs font-medium text-clinic-500">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Patient</th>
                  <th className="px-4 py-2.5">Visit Type</th>
                  <th className="px-4 py-2.5">State</th>
                </tr>
              </thead>
              <tbody>
                {todayItems.map((item) => (
                  <tr key={item.appointment.id} className="border-b border-clinic-100 last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-clinic-600">
                      {new Date(item.appointment.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-clinic-900">{item.appointment.patient_name}</div>
                      {item.blockers.length > 0 && (
                        <div className="mt-0.5 text-xs text-red-700">{item.blockers.join(', ')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-clinic-600">{item.appointment.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${item.checkout_readiness === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-clinic-200 bg-clinic-50 text-clinic-700'}`}>
                        {item.appointment.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {todayItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-clinic-400">No appointments scheduled today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-md border border-clinic-200 bg-white">
            <div className="border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-800">Needs Attention</h2>
              <p className="text-xs text-clinic-500">Clinical risk and operational blockers</p>
            </div>
            <div className="divide-y divide-clinic-100">
              {riskItems.map((item) => (
                <div key={item.label} className="flex gap-3 px-4 py-3">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 ${item.severity === 'urgent' ? 'text-red-700' : item.severity === 'high' ? 'text-amber-700' : 'text-clinic-500'}`} />
                  <div>
                    <div className="text-sm font-medium text-clinic-900">{item.label}</div>
                    <div className="mt-0.5 text-xs text-clinic-500">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-clinic-200 bg-white">
            <div className="border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-800">Shift Handoff</h2>
            </div>
            <ul className="space-y-2 p-4 text-sm text-clinic-700">
              {handoffItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <Inbox className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clinic-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-md border border-clinic-200 bg-white">
            <div className="border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-800">Audit Trail</h2>
              <p className="text-xs text-clinic-500">Recent confirmed actions and system events</p>
            </div>
            <div className="divide-y divide-clinic-100">
              {recentAuditEvents.map((event) => (
                <div key={event.id} className="flex gap-3 px-4 py-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-700" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-clinic-900">{event.event_type.replaceAll('.', ' ')}</div>
                    <div className="mt-0.5 truncate text-xs text-clinic-500">
                      {event.entity_type} - {new Date(event.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {recentAuditEvents.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-clinic-400">No audit events yet</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { to: '/patients', label: 'Find patient', detail: 'Search chart, demographics, tasks', icon: Users },
          { to: '/tasks', label: 'Work task queue', detail: 'Assign, complete, escalate', icon: CheckCircle2 },
          { to: '/faxes', label: 'Process faxes', detail: 'Match OCR to patient charts', icon: CalendarClock },
        ].map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="rounded-md border border-clinic-200 bg-white p-4 transition-colors hover:border-clinic-300 hover:bg-clinic-50">
            <Icon className="h-4 w-4 text-accent-700" />
            <div className="mt-3 text-sm font-semibold text-clinic-900">{label}</div>
            <div className="mt-1 text-xs text-clinic-500">{detail}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
