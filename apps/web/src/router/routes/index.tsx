import { Link, createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { InlineAssistantProposals } from '@/components/assistant/inline-proposals';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { OperationalEmptyState } from '@/lib/ui-state';
import {
  ROUTES,
  type Appointment,
  type AppointmentStatus,
  type AuditEvent,
  type Fax,
  type MessageThread,
  type PatientDocumentQueueResponse,
  type Task,
  type TodayQueue,
} from '@concierge-os/shared';

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

import { useDocumentTitle } from '@/hooks/use-document-title';

function CommandCenterPage() {
  useDocumentTitle('Command Center');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = new Date('2026-06-03T12:00:00-04:00');
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const { data: todayQueue } = useQuery({
    queryKey: [...QUERY_KEYS.TODAY_QUEUE, 'command-center'],
    queryFn: () =>
      api.get<TodayQueue>(
        `/schedule/today-queue?start_date=${dateOnly(today)}&end_date=${dateOnly(tomorrow)}`
      ),
    refetchInterval: 30_000,
  });
  const { data: tasks } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'command-center'],
    queryFn: () => api.get<ListResponse<Task>>('/tasks?page=1&page_size=50'),
  });
  const { data: inboundFaxes } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'command-center', 'inbound'],
    queryFn: () => api.get<ListResponse<Fax>>('/faxes?direction=inbound&page=1&page_size=50'),
  });
  const { data: documentQueue } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENT_DOCUMENTS('review-queue'), 'command-center'],
    queryFn: () =>
      api.get<PatientDocumentQueueResponse>(
        `${ROUTES.PATIENT_DOCUMENT_REVIEW_QUEUE}?status=needs_review&page=1&page_size=6`
      ),
  });
  const { data: threads } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'command-center'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });
  const { data: auditEvents } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'command-center'],
    queryFn: () => api.get<ListResponse<AuditEvent>>('/audit?page=1&page_size=6'),
  });

  const openTasks =
    tasks?.data.filter((task) => task.status !== 'completed' && task.status !== 'cancelled') ?? [];
  const dueToday = openTasks.filter(
    (task) => task.due_date && dateOnly(new Date(task.due_date)) === dateOnly(today)
  ).length;
  const unreadMessages =
    threads?.data.reduce((count, thread) => count + thread.unread_count, 0) ?? 0;
  const unmatchedFaxes = inboundFaxes?.data.filter((fax) => !fax.patient_id).length ?? 0;
  const reviewDocuments = documentQueue?.data ?? [];
  const todayItems = (todayQueue?.data ?? [])
    .filter((item) => dateOnly(new Date(item.appointment.start_time)) === dateOnly(today))
    .sort((a, b) => a.appointment.start_time.localeCompare(b.appointment.start_time));
  const checkedIn = todayQueue?.checked_in ?? 0;

  const queueMetrics = [
    {
      label: 'Patients scheduled',
      value: String(todayQueue?.total ?? todayItems.length),
      note: `${checkedIn} active, ${todayQueue?.blocked ?? 0} blocked`,
      icon: Users,
      tone: 'text-ink-muted',
    },
    {
      label: 'Open tasks',
      value: String(openTasks.length),
      note: `${dueToday} due today`,
      icon: CheckCircle2,
      tone: 'text-warn',
    },
    {
      label: 'Unread messages',
      value: String(unreadMessages),
      note: `${threads?.total ?? 0} active threads`,
      icon: MessageSquare,
      tone: 'text-accent',
    },
    {
      label: 'Documents',
      value: String(documentQueue?.total ?? 0),
      note: `${reviewDocuments.filter((item) => item.review_priority === 'urgent' || item.review_priority === 'high').length} high priority`,
      icon: FileText,
      tone: 'text-danger',
    },
  ];

  const riskItems = [
    ...openTasks
      .filter((task) => task.priority === 'urgent' || task.priority === 'high')
      .slice(0, 3)
      .map((task) => ({
        label: task.title,
        detail: task.patient_name
          ? `${task.patient_name} - ${task.assigned_to_name ?? 'Unassigned'}`
          : (task.description ?? 'Needs owner review'),
        severity: task.priority === 'urgent' ? 'urgent' : 'high',
      })),
    ...(unmatchedFaxes > 0
      ? [
          {
            label: 'Unmatched fax queue',
            detail: `${unmatchedFaxes} inbound documents need chart matching`,
            severity: 'normal',
          },
        ]
      : []),
    ...reviewDocuments
      .filter(
        (document) => document.review_priority === 'urgent' || document.review_priority === 'high'
      )
      .slice(0, 2)
      .map((document) => ({
        label: document.title,
        detail: `${document.patient_name} - ${document.routed_to_role ?? 'Unrouted'} document review`,
        severity: document.review_priority === 'urgent' ? 'urgent' : 'high',
      })),
  ].slice(0, 4);

  const handoffItems = [
    `${todayItems.filter((item) => item.appointment.status === 'scheduled').length} scheduled visits still waiting`,
    `${openTasks.filter((task) => task.priority === 'urgent').length} urgent tasks require same-day action`,
    `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'} across patient and staff threads`,
  ];

  const recentAuditEvents = auditEvents?.data ?? [];
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      const previousQueue = queryClient.getQueryData(QUERY_KEYS.TODAY_QUEUE);

      queryClient.setQueryData<TodayQueue>(QUERY_KEYS.TODAY_QUEUE, (old) => {
        if (!old) return old;
        const updatedData = old.data.map((item) => {
          if (item.appointment.id === id) {
            return {
              ...item,
              appointment: {
                ...item.appointment,
                status,
              },
            };
          }
          return item;
        });

        const checkedInCount = updatedData.filter((item) =>
          ['checked_in', 'roomed', 'provider_review', 'checkout', 'in_progress'].includes(
            item.appointment.status
          )
        ).length;

        return {
          ...old,
          data: updatedData,
          checked_in: checkedInCount,
        };
      });

      return { previousQueue };
    },
    onError: (err, variables, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(QUERY_KEYS.TODAY_QUEUE, context.previousQueue);
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update queue item status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      setEditingNotesId(null);
      toast.success('Notes updated successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update notes');
    },
  });

  const nextBestActions = [
    {
      to: '/setup',
      label: 'Check readiness',
      detail: 'Confirm API, demo data, integrations, and launch blockers.',
    },
    {
      to: '/scheduling',
      label: "Build today's schedule",
      detail: 'Add appointments or provider availability before clinic starts.',
    },
    {
      to: '/portal-intake',
      label: 'Review intake',
      detail: 'Triage portal requests, documents, and appointment asks.',
    },
    {
      to: '/tasks',
      label: 'Assign open work',
      detail: 'Move urgent and unassigned tasks to clear owners.',
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-small text-ink-muted">Wednesday clinic session</p>
          <h1 className="font-serif text-display text-ink mt-1">Command Center</h1>
        </div>
        <div className="flex items-center gap-2 text-small">
          <span className="inline-flex items-center gap-1.5 text-ink-faint">
            <Clock className="h-3.5 w-3.5" />
            Last sync just now
          </span>
        </div>
      </header>

      <InlineAssistantProposals title="Command Center proposals" routePath="/" />

      <section className="bg-accent-soft border border-border rounded-md p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-subhead font-medium text-ink">Next best actions</h2>
            <p className="mt-1 text-small text-ink-secondary">
              Start here when the clinic day is quiet, demo data is missing, or the team needs
              direction.
            </p>
          </div>
          <Link
            to="/setup"
            className="bg-accent text-accent-on rounded-md px-3 py-2 text-sm font-medium hover:bg-accent-hover"
          >
            Open setup
          </Link>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {nextBestActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="bg-canvas-raised border border-border rounded-md p-3 hover:border-border-strong transition-colors"
            >
              <div className="text-small font-medium text-ink">{action.label}</div>
              <div className="text-micro text-ink-muted mt-1">{action.detail}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queueMetrics.map(({ label, value, note, icon: Icon, tone }) => (
          <div key={label} className="bg-canvas-raised border border-border rounded-md p-4">
            <div className="flex items-center justify-between">
              <span className="text-small font-medium text-ink-muted">{label}</span>
              <div className={`grid h-7 w-7 place-items-center rounded-md bg-canvas-sunk ${tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="font-serif text-2xl font-medium text-ink mt-3">{value}</div>
            <div className="text-micro text-ink-faint mt-1">{note}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ErrorBoundary title="Today's Schedule Error">
          <section>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-subhead font-medium text-ink">Today&apos;s Schedule</h2>
              <p className="text-micro text-ink-muted mt-0.5">Live clinic flow and intake state</p>
            </div>
            <Link
              to="/scheduling"
              className="inline-flex items-center gap-1 text-small font-medium text-accent hover:text-accent-hover"
            >
              Open schedule
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-canvas-sunk text-left">
                <tr>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">
                    Time
                  </th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">
                    Patient
                  </th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">
                    Visit Type
                  </th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">
                    State
                  </th>
                </tr>
              </thead>
              <tbody>
                {todayItems.map((item) => (
                  <tr
                    key={item.appointment.id}
                    className="border-b border-border-subtle hover:bg-canvas-sunk/50 transition-colors duration-150"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-micro text-ink-muted">
                      {new Date(item.appointment.start_time).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">{item.appointment.patient_name}</div>
                      <div
                        className={`mt-0.5 text-small ${item.blockers.length > 0 ? 'text-danger' : 'text-ink-muted'}`}
                      >
                        {item.blockers.length > 0
                          ? item.blockers.join(', ')
                          : 'Ready for next step'}
                      </div>
                      {editingNotesId === item.appointment.id ? (
                        <div className="mt-1.5 flex gap-1.5 items-center">
                          <input
                            type="text"
                            value={notesDraft}
                            onChange={(e) => setNotesDraft(e.target.value)}
                            className="bg-canvas border border-border rounded-sm px-2 py-0.5 text-micro text-ink focus:outline-none"
                            placeholder="Add note..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateNotesMutation.mutate({ id: item.appointment.id, notes: notesDraft });
                              } else if (e.key === 'Escape') {
                                setEditingNotesId(null);
                              }
                            }}
                          />
                          <button
                            onClick={() => updateNotesMutation.mutate({ id: item.appointment.id, notes: notesDraft })}
                            className="text-micro font-medium text-accent hover:text-accent-hover"
                            disabled={updateNotesMutation.isPending}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotesId(null)}
                            className="text-micro font-medium text-ink-muted hover:text-ink"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-2">
                          {item.appointment.notes ? (
                            <span className="text-micro text-ink-muted italic truncate max-w-[200px]">
                              Note: {item.appointment.notes}
                            </span>
                          ) : null}
                          <button
                            onClick={() => {
                              setEditingNotesId(item.appointment.id);
                              setNotesDraft(item.appointment.notes || '');
                            }}
                            className="text-micro font-medium text-ink-faint hover:text-accent"
                          >
                            {item.appointment.notes ? 'Edit note' : '+ Note'}
                          </button>
                        </div>
                      )}
                      <div className="mt-1">
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: item.appointment.patient_id }}
                          className="inline-flex text-micro font-medium text-accent hover:text-accent-hover"
                        >
                          Open handoff
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{item.appointment.type}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <span
                          className={`inline-flex rounded-sm border px-2 py-0.5 text-micro font-medium ${item.checkout_readiness === 'blocked' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border-subtle bg-canvas-sunk text-ink-muted'}`}
                        >
                          {item.appointment.status.replace('_', ' ')}
                        </span>
                        {nextVisitStatus(item.appointment.status) && (
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: item.appointment.id,
                                status: nextVisitStatus(item.appointment.status)!,
                              })
                            }
                            disabled={statusMutation.isPending}
                            className="btn btn-sm btn-accent-soft inline-flex items-center gap-1.5"
                          >
                            {statusMutation.isPending &&
                              statusMutation.variables?.id === item.appointment.id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            {nextVisitLabel(item.appointment.status)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {todayItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6">
                      <OperationalEmptyState
                        title="No appointments scheduled today"
                        detail="Create the first appointment, import the clinic calendar, or seed the pilot workspace so staff can trust this dashboard before clinic starts."
                        primaryAction={
                          <Link
                            to="/scheduling"
                            className="bg-accent text-accent-on rounded-md px-3 py-2 text-sm font-medium hover:bg-accent-hover"
                          >
                            Create appointment
                          </Link>
                        }
                        secondaryAction={
                          <Link
                            to="/setup"
                            className="border border-border bg-canvas-raised text-ink-secondary rounded-md px-3 py-2 text-sm font-medium hover:border-border-strong hover:bg-canvas-sunk"
                          >
                            Seed demo data
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        </ErrorBoundary>

        <ErrorBoundary title="Sidebar Widgets Error">
          <aside className="space-y-5">
            <section className="divide-y divide-border">
            <div className="py-3 border-b border-border">
              <h2 className="text-subhead font-medium text-ink">Needs Attention</h2>
              <p className="text-micro text-ink-muted mt-0.5">
                Clinical risk and operational blockers
              </p>
            </div>
            {riskItems.map((item) => (
              <div
                key={item.label}
                className="flex gap-3 px-4 py-3 hover:bg-canvas-sunk/50 transition-colors duration-150"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 ${item.severity === 'urgent' ? 'text-danger' : item.severity === 'high' ? 'text-warn' : 'text-ink-faint'}`}
                />
                <div>
                  <div className="text-small font-medium text-ink">{item.label}</div>
                  <div className="mt-0.5 text-micro text-ink-muted">{item.detail}</div>
                </div>
              </div>
            ))}
          </section>

          <section className="divide-y divide-border">
            <div className="py-3 border-b border-border">
              <h2 className="text-subhead font-medium text-ink">Document Review Queue</h2>
              <p className="text-micro text-ink-muted mt-0.5">
                Outside records needing clinical or front-office review
              </p>
            </div>
            {reviewDocuments.slice(0, 4).map((document) => (
              <Link
                key={document.id}
                to="/patients/$patientId"
                params={{ patientId: document.patient_id }}
                className="block px-4 py-3 hover:bg-canvas-sunk/50 transition-colors duration-150"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-small font-medium text-ink">{document.title}</div>
                    <div className="mt-0.5 text-micro text-ink-muted">
                      {document.patient_name} · {document.source}
                    </div>
                    <div className="mt-0.5 text-micro text-ink-muted">
                      {document.routed_to_role ?? 'Unrouted'} ·{' '}
                      {document.source_reference ?? 'No reference'}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-medium ${document.review_priority === 'urgent' ? 'bg-danger/10 text-danger' : document.review_priority === 'high' ? 'bg-warn/10 text-warn' : 'bg-canvas-sunk text-ink-muted'}`}
                  >
                    {document.review_priority}
                  </span>
                </div>
              </Link>
            ))}
            {reviewDocuments.length === 0 && (
              <div className="px-4 py-8 text-center text-small text-ink-faint">
                No outside documents need review.
              </div>
            )}
          </section>

          <section className="divide-y divide-border">
            <div className="py-3 border-b border-border">
              <h2 className="text-subhead font-medium text-ink">Shift Handoff</h2>
            </div>
            <ul className="space-y-2 p-4 text-small text-ink-secondary">
              {handoffItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <Inbox className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="divide-y divide-border">
            <div className="py-3 border-b border-border">
              <h2 className="text-subhead font-medium text-ink">Audit Trail</h2>
              <p className="text-micro text-ink-muted mt-0.5">
                Recent confirmed actions and system events
              </p>
            </div>
            {recentAuditEvents.map((event) => (
              <div
                key={event.id}
                className="flex gap-3 px-4 py-3 hover:bg-canvas-sunk/50 transition-colors duration-150"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <div className="truncate text-small font-medium text-ink">
                    {event.event_type.replaceAll('.', ' ')}
                  </div>
                  <div className="mt-0.5 truncate text-micro text-ink-muted">
                    {event.entity_type} -{' '}
                    {new Date(event.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            {recentAuditEvents.length === 0 && (
              <div className="px-4 py-8 text-center text-small text-ink-faint">
                No audit events yet
              </div>
            )}
          </section>
        </aside>
        </ErrorBoundary>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          {
            to: '/patients',
            label: 'Find patient',
            detail: 'Search chart, demographics, tasks',
            icon: Users,
          },
          {
            to: '/tasks',
            label: 'Work task queue',
            detail: 'Assign, complete, escalate',
            icon: CheckCircle2,
          },
          {
            to: '/faxes',
            label: 'Process faxes',
            detail: 'Match OCR to patient charts',
            icon: CalendarClock,
          },
        ].map(({ to, label, detail, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="bg-canvas-raised border border-border rounded-md p-4 hover:border-border-strong hover:shadow-card transition-all duration-150"
          >
            <div className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft">
              <Icon className="h-4 w-4 text-accent" />
            </div>
            <div className="mt-3 text-small font-semibold text-ink">{label}</div>
            <div className="mt-1 text-micro text-ink-muted">{detail}</div>
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
    scheduled: 'Check in',
    checked_in: 'Room',
    roomed: 'Provider',
    provider_review: 'Checkout',
    in_progress: 'Checkout',
    checkout: 'Complete',
  };
  return labels[status] ?? 'Advance';
}
