import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  MessageSquare,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ROUTES, type Appointment, type AppointmentStatus, type AuditEvent, type Fax, type MessageThread, type Task, type TodayQueue } from '@concierge-os/shared';

export const Route = createFileRoute('/roles')({
  component: RoleViewsPage,
});

interface ListResponse<T> {
  data: T[];
  total: number;
}

function dateOnly(date: Date) {
  return date.toISOString().split('T')[0];
}

function RoleViewsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const today = new Date('2026-06-03T12:00:00-04:00');
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const { data: todayQueue } = useQuery({
    queryKey: [...QUERY_KEYS.TODAY_QUEUE, 'role-views'],
    queryFn: () => api.get<TodayQueue>(`${ROUTES.TODAY_QUEUE}?start_date=${dateOnly(today)}&end_date=${dateOnly(tomorrow)}`),
  });
  const { data: tasks } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'role-views'],
    queryFn: () => api.get<ListResponse<Task>>('/tasks?page=1&page_size=50'),
  });
  const { data: faxes } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'role-views'],
    queryFn: () => api.get<ListResponse<Fax>>('/faxes?direction=inbound&page=1&page_size=50'),
  });
  const { data: threads } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'role-views'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });
  const { data: auditEvents } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'role-views'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=8'),
  });

  const queueItems = todayQueue?.data ?? [];
  const openTasks = tasks?.data.filter((task) => task.status !== 'completed' && task.status !== 'cancelled') ?? [];
  const clinicalTasks = openTasks.filter((task) => ['urgent', 'high'].includes(task.priority));
  const unmatchedFaxes = faxes?.data.filter((fax) => !fax.patient_id) ?? [];
  const unreadMessages = threads?.data.reduce((total, thread) => total + thread.unread_count, 0) ?? 0;
  const blockedPatients = queueItems.filter((item) => item.checkout_readiness === 'blocked');
  const checkedInPatients = queueItems.filter((item) => ['checked_in', 'roomed', 'provider_review', 'checkout', 'in_progress'].includes(item.appointment.status));
  const providerReady = queueItems.filter((item) => item.urgent_tasks > 0 || item.documents_needing_review > 0);
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
    },
  });

  const lanes = [
    {
      title: 'Front Desk',
      icon: Users,
      summary: `${queueItems.length} visits, ${todayQueue?.blocked ?? 0} blocked`,
      metrics: [
        ['Scheduled', String(todayQueue?.total ?? 0)],
        ['Checked in', String(todayQueue?.checked_in ?? 0)],
        ['Checkout blockers', String(blockedPatients.length)],
      ],
      actions: [
        ...queueItems.slice(0, 4).map((item) => ({
          label: item.appointment.patient_name,
          detail: `${formatTime(item.appointment.start_time)} - ${formatStatus(item.appointment.status)}`,
          tone: item.checkout_readiness === 'blocked' ? 'red' : 'neutral',
          to: `/patients/${item.appointment.patient_id}`,
          appointmentId: item.appointment.id,
          nextStatus: nextVisitStatus(item.appointment.status),
        })),
      ],
    },
    {
      title: 'MA / Nurse',
      icon: HeartPulse,
      summary: `${checkedInPatients.length} active patients, ${clinicalTasks.length} clinical tasks`,
      metrics: [
        ['Roomed/active', String(checkedInPatients.length)],
        ['High priority tasks', String(clinicalTasks.length)],
        ['Unread messages', String(unreadMessages)],
      ],
      actions: [
        ...clinicalTasks.slice(0, 4).map((task) => ({
          label: task.title,
          detail: `${task.patient_name ?? 'No patient'} - ${task.assigned_to_name ?? 'Unassigned'}`,
          tone: task.priority === 'urgent' ? 'red' : 'amber',
          to: task.patient_id ? `/patients/${task.patient_id}` : '/tasks',
        })),
      ],
    },
    {
      title: 'Provider',
      icon: Stethoscope,
      summary: `${providerReady.length} charts need review`,
      metrics: [
        ['Doc reviews', String(queueItems.reduce((sum, item) => sum + item.documents_needing_review, 0))],
        ['Urgent tasks', String(queueItems.reduce((sum, item) => sum + item.urgent_tasks, 0))],
        ['Open tasks', String(queueItems.reduce((sum, item) => sum + item.open_tasks, 0))],
      ],
      actions: [
        ...providerReady.slice(0, 4).map((item) => ({
          label: item.appointment.patient_name,
          detail: item.blockers.join(', ') || 'Chart review ready',
          tone: item.urgent_tasks > 0 ? 'red' : 'amber',
          to: `/patients/${item.appointment.patient_id}`,
        })),
      ],
    },
    {
      title: 'Manager',
      icon: ShieldCheck,
      summary: `${unmatchedFaxes.length} unmatched faxes, ${auditEvents?.total ?? 0} audit events`,
      metrics: [
        ['Unmatched faxes', String(unmatchedFaxes.length)],
        ['Audit events', String(auditEvents?.total ?? 0)],
        ['Threads', String(threads?.total ?? 0)],
      ],
      actions: [
        ...unmatchedFaxes.slice(0, 2).map((fax) => ({
          label: `Inbound fax from ${fax.from_number}`,
          detail: `${fax.pages} pages - ${fax.status}`,
          tone: 'amber',
          to: '/faxes',
        })),
        ...(auditEvents?.data.slice(0, 2).map((event) => ({
          label: event.event_type.replaceAll('.', ' '),
          detail: `${event.entity_type} - ${formatTime(event.created_at)}`,
          tone: 'neutral',
          to: '/operations',
        })) ?? []),
      ],
    },
  ] as const;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-clinic-500">Operational work by role</p>
          <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Role Views</h1>
        </div>
        <Link to="/" className="inline-flex items-center gap-1 rounded-md border border-clinic-300 bg-white px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50">
          Command Center
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="grid gap-4 xl:grid-cols-2">
        {lanes.map(({ title, icon: Icon, summary, metrics, actions }) => (
          <div key={title} className="rounded-md border border-clinic-200 bg-white">
            <div className="flex items-start justify-between gap-3 border-b border-clinic-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-accent-200 bg-accent-50">
                  <Icon className="h-4 w-4 text-accent-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-clinic-900">{title}</h2>
                  <p className="text-xs text-clinic-500">{summary}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px border-b border-clinic-100 bg-clinic-100">
              {metrics.map(([label, value]) => (
                <div key={label} className="bg-clinic-50 px-4 py-3">
                  <div className="text-2xl font-semibold text-clinic-900">{value}</div>
                  <div className="mt-1 text-xs text-clinic-500">{label}</div>
                </div>
              ))}
            </div>

            <div className="divide-y divide-clinic-100">
              {actions.map((action) => (
                <div key={`${title}-${action.label}-${action.detail}`} className="flex items-start gap-3 px-4 py-3 hover:bg-clinic-50">
                  {action.tone === 'red' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />
                  ) : action.tone === 'amber' ? (
                    <CalendarClock className="mt-0.5 h-4 w-4 text-amber-700" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-accent-700" />
                  )}
                  <Link to={action.to} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-clinic-900">{action.label}</div>
                    <div className="mt-0.5 truncate text-xs text-clinic-500">{action.detail}</div>
                  </Link>
                  {'appointmentId' in action && action.appointmentId && action.nextStatus ? (
                    <button
                      onClick={() => statusMutation.mutate({ id: action.appointmentId, status: action.nextStatus as AppointmentStatus })}
                      className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                    >
                      {nextVisitLabel(action.nextStatus)}
                    </button>
                  ) : (
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-clinic-400" />
                  )}
                </div>
              ))}
              {actions.length === 0 && (
                <div className="flex items-center gap-2 px-4 py-8 text-sm text-clinic-400">
                  <ClipboardList className="h-4 w-4" />
                  No active work in this lane
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { to: '/tasks', label: 'Task queue', detail: `${openTasks.length} open tasks`, icon: ClipboardList },
          { to: '/faxes', label: 'Fax inbox', detail: `${unmatchedFaxes.length} unmatched inbound`, icon: FileText },
          { to: '/messaging', label: 'Messages', detail: `${unreadMessages} unread messages`, icon: MessageSquare },
        ].map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="rounded-md border border-clinic-200 bg-white p-4 hover:bg-clinic-50">
            <Icon className="h-4 w-4 text-accent-700" />
            <div className="mt-3 text-sm font-semibold text-clinic-900">{label}</div>
            <div className="mt-1 text-xs text-clinic-500">{detail}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function nextVisitStatus(status: AppointmentStatus): AppointmentStatus | null {
  const flow: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
    scheduled: 'checked_in',
    checked_in: 'roomed',
    roomed: 'provider_review',
    provider_review: 'checkout',
    in_progress: 'checkout',
    checkout: 'completed',
  };
  return flow[status] ?? null;
}

function nextVisitLabel(status: AppointmentStatus) {
  const labels: Partial<Record<AppointmentStatus, string>> = {
    checked_in: 'Check in',
    roomed: 'Room',
    provider_review: 'Provider',
    checkout: 'Checkout',
    completed: 'Complete',
  };
  return labels[status] ?? 'Advance';
}

function formatStatus(status: string) {
  return status.replace('_', ' ');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
