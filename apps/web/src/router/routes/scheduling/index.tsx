import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchablePatientPicker } from '@/components/searchable-patient-picker';
import { useToast } from '@/components/toast';
import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/lib/api-client';
import { ErrorBoundary } from '@/components/error-boundary';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';
import {
  ROUTES,
  type Appointment,
  type AppointmentConflictCheck,
  type AppointmentReminderQueue,
  type AppointmentStatus,
  type Patient,
  type ProviderAvailability,
  type UserListResponse,
} from '@concierge-os/shared';
import { Bell, CalendarClock, ChevronLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';

interface AppointmentListResponse {
  data: Appointment[];
  total: number;
}

interface PatientListResponse {
  data: Patient[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-canvas-sunk text-ink-muted border-border',
  checked_in: 'bg-accent-soft text-accent border-accent-soft',
  roomed: 'bg-accent-soft text-accent border-accent-soft',
  provider_review: 'bg-accent-soft text-accent border-accent-soft',
  checkout: 'bg-success/10 text-success border-success/20',
  in_progress: 'bg-accent-soft text-accent border-accent-soft',
  completed: 'bg-canvas-sunk text-ink-faint border-border-subtle',
  cancelled: 'bg-canvas-sunk text-ink-faint border-border-subtle line-through',
  no_show: 'bg-danger/10 text-danger border-danger/20',
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const Route = createFileRoute('/scheduling/')({
  component: SchedulePage,
});

import { useDocumentTitle } from '@/hooks/use-document-title';

function SchedulePage() {
  useDocumentTitle('Schedule');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patient_id: '',
    provider_id: '',
    start_time: '',
    type: 'Office visit',
    notes: '',
  });
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [availabilityForm, setAvailabilityForm] = useState({
    day_of_week: '1',
    start_time: '09:00',
    end_time: '17:00',
  });
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowNewAppointment(true);
      } else if (e.key === 'Escape') {
        setShowNewAppointment(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startStr = formatDate(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = formatDate(endDate);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.APPOINTMENTS, startStr, endStr],
    queryFn: () =>
      api.get<AppointmentListResponse>(
        `/schedule/appointments?start_date=${startStr}&end_date=${endStr}`
      ),
  });
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'schedule-picker'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=100`),
  });
  const { data: staff } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'providers'],
    queryFn: () => api.get<UserListResponse>(`${ROUTES.USERS}?role=provider`),
  });
  const patientOptions = patients?.data ?? [];
  const providerOptions = staff?.data ?? [];
  const activeProviderId = selectedProviderId || providerOptions[0]?.id || '';
  const { data: availability } = useQuery({
    queryKey: [...QUERY_KEYS.APPOINTMENTS, 'availability', activeProviderId],
    enabled: Boolean(activeProviderId),
    queryFn: () => api.get<ProviderAvailability[]>(ROUTES.PROVIDER_AVAILABILITY(activeProviderId)),
  });
  const conflictWindow = useMemo(() => {
    if (!newAppointment.provider_id || !newAppointment.start_time) return null;
    const start = new Date(newAppointment.start_time);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return { start, end };
  }, [newAppointment.provider_id, newAppointment.start_time]);
  const { data: conflictCheck } = useQuery({
    queryKey: [
      ...QUERY_KEYS.APPOINTMENTS,
      'conflict-check',
      newAppointment.provider_id,
      newAppointment.start_time,
    ],
    enabled: Boolean(showNewAppointment && conflictWindow),
    queryFn: () =>
      api.get<AppointmentConflictCheck>(
        `${ROUTES.APPOINTMENT_CONFLICT_CHECK}?provider_id=${encodeURIComponent(newAppointment.provider_id)}&start_time=${encodeURIComponent(conflictWindow!.start.toISOString())}&end_time=${encodeURIComponent(conflictWindow!.end.toISOString())}`
      ),
  });

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const createMutation = useMutation({
    mutationFn: () => {
      const start = new Date(newAppointment.start_time);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return api.post<Appointment>(`${ROUTES.SCHEDULE}/appointments`, {
        patient_id: newAppointment.patient_id,
        provider_id: newAppointment.provider_id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        type: newAppointment.type,
        notes: newAppointment.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      setShowNewAppointment(false);
      setNewAppointment({
        patient_id: '',
        provider_id: '',
        start_time: '',
        type: 'Office visit',
        notes: '',
      });
      toast.success('Appointment scheduled successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule appointment');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      toast.success('Appointment status updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update appointment status');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ appointment, minutes }: { appointment: Appointment; minutes: number }) => {
      const start = new Date(appointment.start_time);
      const end = new Date(appointment.end_time);
      start.setMinutes(start.getMinutes() + minutes);
      end.setMinutes(end.getMinutes() + minutes);
      return api.patch<Appointment>(`/schedule/appointments/${appointment.id}`, {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      toast.success('Appointment rescheduled successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to reschedule appointment');
    },
  });

  const availabilityMutation = useMutation({
    mutationFn: () =>
      api.post<ProviderAvailability>(`${ROUTES.SCHEDULE}/availability`, {
        provider_id: activeProviderId,
        day_of_week: Number(availabilityForm.day_of_week),
        start_time: availabilityForm.start_time,
        end_time: availabilityForm.end_time,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.APPOINTMENTS, 'availability', activeProviderId],
      });
      toast.success('Provider availability saved');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save provider availability');
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      api.post<AppointmentReminderQueue>(ROUTES.APPOINTMENT_REMINDERS(appointmentId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
      toast.success('Appointment reminder triggered');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to trigger appointment reminder');
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      setEditingNotesId(null);
      toast.success('Appointment notes updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update notes');
    },
  });

  function appointmentsForDay(day: Date): Appointment[] {
    if (!data?.data) return [];
    const dayStr = formatDate(day);
    return data.data.filter((a) => a.start_time.startsWith(dayStr));
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-display text-ink">Schedule</h1>
          <p className="mt-1 text-small text-ink-muted">
            Build the day around provider availability, conflict warnings, and reminder staging.
          </p>
        </div>
        <button onClick={() => setShowNewAppointment(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" />
          New Appointment
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const prev = new Date(weekStart);
              prev.setDate(prev.getDate() - 7);
              setWeekStart(prev);
            }}
            className="rounded-md border border-border bg-canvas-raised p-1.5 hover:border-border-strong hover:bg-canvas-sunk transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-ink-secondary" />
          </button>
          <span className="text-small font-medium text-ink">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <button
            onClick={() => {
              const next = new Date(weekStart);
              next.setDate(next.getDate() + 7);
              setWeekStart(next);
            }}
            className="rounded-md border border-border bg-canvas-raised p-1.5 hover:border-border-strong hover:bg-canvas-sunk transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-ink-secondary" />
          </button>
        </div>
        <button
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="text-small text-accent hover:text-accent-hover transition-colors"
        >
          Today
        </button>
      </div>

      <section className="mb-4 grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="mb-3 flex items-center gap-2 text-subhead font-medium text-ink">
            <CalendarClock className="h-4 w-4 text-accent" />
            Provider Availability
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_8rem_auto]">
            <select
              value={activeProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
            >
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.display_name}
                </option>
              ))}
            </select>
            <select
              value={availabilityForm.day_of_week}
              onChange={(event) =>
                setAvailabilityForm({ ...availabilityForm, day_of_week: event.target.value })
              }
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={availabilityForm.start_time}
              onChange={(event) =>
                setAvailabilityForm({ ...availabilityForm, start_time: event.target.value })
              }
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
            />
            <input
              type="time"
              value={availabilityForm.end_time}
              onChange={(event) =>
                setAvailabilityForm({ ...availabilityForm, end_time: event.target.value })
              }
              className="rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
            />
            <button
              disabled={!activeProviderId || availabilityMutation.isPending}
              onClick={() => availabilityMutation.mutate()}
              className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(availability ?? []).map((item) => (
              <span
                key={item.id}
                className="rounded-md border border-border bg-canvas-sunk px-2 py-1 text-micro font-medium text-ink-secondary"
              >
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.day_of_week]}{' '}
                {item.start_time}-{item.end_time}
              </span>
            ))}
            {activeProviderId && (availability ?? []).length === 0 && (
              <span className="text-micro text-ink-faint">
                No availability set for this provider.
              </span>
            )}
          </div>
        </div>
        <div className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="flex items-center gap-2 text-subhead font-medium text-ink">
            <Bell className="h-4 w-4 text-accent" />
            Reminder Queue
          </div>
          <p className="mt-2 text-micro text-ink-muted">
            Use the bell on any appointment to stage SMS and email reminders for delivery.
          </p>
          {reminderMutation.isSuccess && (
            <p className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-micro font-medium text-accent">
              Reminder events queued.
            </p>
          )}
        </div>
      </section>

      <ErrorBoundary title="Weekly Calendar Grid Error">
        {isLoading ? (
          <LoadingState label="Loading schedule" />
        ) : isError ? (
          <ErrorState
            title="Unable to load schedule"
            detail={error instanceof Error ? error.message : 'The schedule could not be loaded.'}
          />
        ) : (
          <div className="overflow-x-auto">
          <div className="grid min-w-[56rem] grid-cols-7 gap-0 border border-border rounded-md overflow-hidden">
            {weekDays.map((day, i) => {
              const apps = appointmentsForDay(day);
              const isToday = formatDate(day) === formatDate(new Date());
              return (
                <div
                  key={i}
                  className={`min-h-32 border-r border-b border-border-subtle p-2 last:border-r-0 ${
                    isToday ? 'bg-accent-soft/30' : ''
                  }`}
                >
                  <div
                    className={`mb-2 text-center text-meta font-medium ${isToday ? 'text-accent' : 'text-ink-muted'}`}
                  >
                    <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-lg">{day.getDate()}</div>
                  </div>
                  <div className="space-y-1">
                    {apps.map((appt) => (
                      <div
                        key={appt.id}
                        className={`group rounded-sm border p-2 text-micro relative transition-all duration-150 hover:shadow-sm ${STATUS_COLORS[appt.status]}`}
                      >
                        <div className="font-semibold truncate">
                          {appt.patient_name || 'Unknown'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-micro opacity-85">
                          <span>
                            {new Date(appt.start_time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>·</span>
                          <span className="truncate">{appt.type}</span>
                        </div>
                        <div className="mt-1 text-micro opacity-70 font-medium">
                          {humanizeWorkflowLabel(appt.status)}
                        </div>

                        {editingNotesId === appt.id ? (
                          <div className="mt-1.5 flex flex-col gap-1 z-20">
                            <input
                              type="text"
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              className="w-full bg-canvas border border-border rounded-sm px-1 py-0.5 text-[10px] text-ink focus:outline-none"
                              placeholder="Notes..."
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateNotesMutation.mutate({ id: appt.id, notes: notesDraft });
                                } else if (e.key === 'Escape') {
                                  e.stopPropagation();
                                  setEditingNotesId(null);
                                }
                              }}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNotesId(null);
                                }}
                                className="px-1 py-0.5 text-[9px] rounded bg-canvas-raised hover:bg-canvas-sunk text-ink-secondary"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNotesMutation.mutate({ id: appt.id, notes: notesDraft });
                                }}
                                disabled={updateNotesMutation.isPending}
                                className="bg-accent text-accent-on rounded px-1 py-0.5 text-[9px] hover:bg-accent-hover font-medium inline-flex items-center gap-1"
                              >
                                {updateNotesMutation.isPending &&
                                  updateNotesMutation.variables?.id === appt.id && (
                                    <Loader2 className="h-2 w-2 animate-spin" />
                                  )}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {appt.notes && (
                              <div
                                className="mt-1 text-[10px] text-ink-muted italic border-t border-border/10 pt-1 leading-tight"
                                title={appt.notes}
                              >
                                {appt.notes}
                              </div>
                            )}
                            <div className="mt-1.5 hidden group-hover:flex flex-wrap gap-1 transition-all duration-150">
                              {nextVisitStatus(appt.status) && (
                                <button
                                  onClick={() =>
                                    statusMutation.mutate({
                                      id: appt.id,
                                      status: nextVisitStatus(appt.status)!,
                                    })
                                  }
                                  className="rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro font-medium text-ink hover:bg-canvas-sunk transition-colors cursor-pointer"
                                >
                                  {nextVisitLabel(appt.status)}
                                </button>
                              )}
                              {!['completed', 'cancelled', 'no_show'].includes(appt.status) && (
                                <>
                                  <button
                                    onClick={() =>
                                      rescheduleMutation.mutate({ appointment: appt, minutes: 15 })
                                    }
                                    className="rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro font-medium text-ink hover:bg-canvas-sunk transition-colors cursor-pointer"
                                  >
                                    +15m
                                  </button>
                                  <button
                                    onClick={() => reminderMutation.mutate(appt.id)}
                                    title="Queue appointment reminders"
                                    className="inline-flex items-center rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro font-medium text-ink hover:bg-canvas-sunk transition-colors cursor-pointer"
                                  >
                                    <Bell className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingNotesId(appt.id);
                                  setNotesDraft(appt.notes || '');
                                }}
                                title="Edit inline notes"
                                className="rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro font-medium text-ink hover:bg-canvas-sunk transition-colors cursor-pointer"
                              >
                                Note
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {apps.length === 0 && i === 0 && (
                      <div className="rounded-md border border-dashed border-border p-2 text-center text-micro text-ink-faint">
                        No visits
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </ErrorBoundary>

      {!isLoading && !isError && data?.data.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No appointments this week"
            detail="Create an appointment, add provider availability, or seed the pilot workspace so coordinators know whether the quiet calendar is intentional."
            action={
              <button
                type="button"
                onClick={() => setShowNewAppointment(true)}
                className="btn btn-primary"
              >
                Create appointment
              </button>
            }
          />
        </div>
      )}

      {showNewAppointment && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg bg-canvas-raised border border-border rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-subhead font-medium text-ink">New Appointment</h2>
              <button
                type="button"
                onClick={() => setShowNewAppointment(false)}
                className="text-ink-muted hover:text-ink rounded-md p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-small font-medium text-ink-secondary">
                  Patient <span className="text-danger">*</span>
                  <div className="mt-1">
                    <SearchablePatientPicker
                      required
                      patients={patientOptions}
                      value={newAppointment.patient_id}
                      onChange={(val) => setNewAppointment({ ...newAppointment, patient_id: val })}
                      placeholder="Select patient..."
                    />
                  </div>
                </div>
                <label className="text-small font-medium text-ink-secondary">
                  Provider
                  <select
                    required
                    value={newAppointment.provider_id}
                    onChange={(event) =>
                      setNewAppointment({ ...newAppointment, provider_id: event.target.value })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                  >
                    <option value="">Select provider</option>
                    {providerOptions.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.display_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-small font-medium text-ink-secondary">
                  Start time
                  <input
                    required
                    type="datetime-local"
                    value={newAppointment.start_time}
                    onChange={(event) =>
                      setNewAppointment({ ...newAppointment, start_time: event.target.value })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                  />
                </label>
                <label className="text-small font-medium text-ink-secondary">
                  Type
                  <input
                    required
                    value={newAppointment.type}
                    onChange={(event) =>
                      setNewAppointment({ ...newAppointment, type: event.target.value })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                  />
                </label>
              </div>
              <label className="block text-small font-medium text-ink-secondary">
                Notes
                <textarea
                  value={newAppointment.notes}
                  onChange={(event) =>
                    setNewAppointment({ ...newAppointment, notes: event.target.value })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft"
                />
              </label>
              {conflictCheck && (
                <div
                  className={`rounded-md border px-3 py-2 text-small ${conflictCheck.warnings.length ? 'border-warn/20 bg-warn/10 text-warn' : 'border-accent-soft bg-accent-soft text-accent'}`}
                >
                  {conflictCheck.warnings.length
                    ? conflictCheck.warnings.join('. ')
                    : 'Provider is available for this slot.'}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setShowNewAppointment(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button disabled={createMutation.isPending} className="btn btn-primary">
                {createMutation.isPending ? 'Creating...' : 'Create appointment'}
              </button>
            </div>
          </form>
        </div>
      )}
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
