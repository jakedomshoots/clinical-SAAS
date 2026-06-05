import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { ROUTES, type Appointment, type AppointmentReminderQueue, type AppointmentStatus, type Patient, type ProviderAvailability, type UserListResponse } from '@concierge-os/shared';
import { Bell, CalendarClock, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

interface AppointmentListResponse {
  data: Appointment[];
  total: number;
}

interface PatientListResponse {
  data: Patient[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-700 border-sky-200',
  checked_in: 'bg-amber-100 text-amber-700 border-amber-200',
  roomed: 'bg-teal-100 text-teal-700 border-teal-200',
  provider_review: 'bg-violet-100 text-violet-700 border-violet-200',
  checkout: 'bg-lime-100 text-lime-700 border-lime-200',
  in_progress: 'bg-accent-100 text-accent-700 border-accent-200',
  completed: 'bg-clinic-100 text-clinic-600 border-clinic-200',
  cancelled: 'bg-red-50 text-red-400 border-red-100 line-through',
  no_show: 'bg-red-100 text-red-700 border-red-200',
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

function SchedulePage() {
  const api = useApi();
  const queryClient = useQueryClient();
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

  const startStr = formatDate(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = formatDate(endDate);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.APPOINTMENTS, startStr, endStr],
    queryFn: () =>
      api.get<AppointmentListResponse>(`/schedule/appointments?start_date=${startStr}&end_date=${endStr}`),
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
      setNewAppointment({ patient_id: '', provider_id: '', start_time: '', type: 'Office visit', notes: '' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      api.patch<Appointment>(`/schedule/appointments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
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
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.APPOINTMENTS, 'availability', activeProviderId] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (appointmentId: string) => api.post<AppointmentReminderQueue>(ROUTES.APPOINTMENT_REMINDERS(appointmentId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_EVENTS });
    },
  });

  function appointmentsForDay(day: Date): Appointment[] {
    if (!data?.data) return [];
    const dayStr = formatDate(day);
    return data.data.filter((a) => a.start_time.startsWith(dayStr));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Schedule</h1>
        <button onClick={() => setShowNewAppointment(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
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
            className="rounded-md border border-clinic-300 p-1.5 hover:bg-clinic-100"
          >
            <ChevronLeft className="h-4 w-4 text-clinic-600" />
          </button>
          <span className="text-sm font-medium text-clinic-700">
            {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
            {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={() => {
              const next = new Date(weekStart);
              next.setDate(next.getDate() + 7);
              setWeekStart(next);
            }}
            className="rounded-md border border-clinic-300 p-1.5 hover:bg-clinic-100"
          >
            <ChevronRight className="h-4 w-4 text-clinic-600" />
          </button>
        </div>
        <button
          onClick={() => setWeekStart(getWeekStart(new Date()))}
          className="text-sm text-accent-600 hover:text-accent-700"
        >
          Today
        </button>
      </div>

      <section className="mb-4 grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <CalendarClock className="h-4 w-4 text-accent-700" />
            Provider Availability
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_8rem_auto]">
            <select value={activeProviderId} onChange={(event) => setSelectedProviderId(event.target.value)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm">
              {providerOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.display_name}</option>)}
            </select>
            <select value={availabilityForm.day_of_week} onChange={(event) => setAvailabilityForm({ ...availabilityForm, day_of_week: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
            <input type="time" value={availabilityForm.start_time} onChange={(event) => setAvailabilityForm({ ...availabilityForm, start_time: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
            <input type="time" value={availabilityForm.end_time} onChange={(event) => setAvailabilityForm({ ...availabilityForm, end_time: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
            <button disabled={!activeProviderId || availabilityMutation.isPending} onClick={() => availabilityMutation.mutate()} className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-medium text-accent-700 hover:bg-accent-100 disabled:opacity-50">
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(availability ?? []).map((item) => (
              <span key={item.id} className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.day_of_week]} {item.start_time}-{item.end_time}
              </span>
            ))}
            {activeProviderId && (availability ?? []).length === 0 && <span className="text-xs text-clinic-400">No availability set for this provider.</span>}
          </div>
        </div>
        <div className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <Bell className="h-4 w-4 text-accent-700" />
            Reminder Queue
          </div>
          <p className="mt-2 text-xs text-clinic-500">Use the bell on any appointment to stage SMS and email reminders for delivery.</p>
          {reminderMutation.isSuccess && <p className="mt-3 rounded-md bg-accent-50 px-3 py-2 text-xs font-medium text-accent-800">Reminder events queued.</p>}
        </div>
      </section>

      {isLoading ? (
        <LoadingState label="Loading schedule" />
      ) : isError ? (
        <ErrorState title="Unable to load schedule" detail={error instanceof Error ? error.message : 'The schedule could not be loaded.'} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-clinic-200 bg-white">
          <div className="grid min-w-[56rem] grid-cols-7 gap-0">
            {weekDays.map((day, i) => {
              const apps = appointmentsForDay(day);
              const isToday = formatDate(day) === formatDate(new Date());
              return (
                <div
                  key={i}
                  className={`min-h-32 border-r border-b border-clinic-100 p-2 last:border-r-0 ${
                    isToday ? 'bg-accent-50/50' : ''
                  }`}
                >
                  <div className={`mb-2 text-center text-xs font-semibold ${isToday ? 'text-accent-700' : 'text-clinic-500'}`}>
                    <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-lg">{day.getDate()}</div>
                  </div>
                  <div className="space-y-1">
                    {apps.map((appt) => (
                      <div
                        key={appt.id}
                        className={`rounded border px-2 py-1 text-xs ${STATUS_COLORS[appt.status]}`}
                      >
                        <div className="font-medium">
                          {new Date(appt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                        <div className="truncate">{appt.patient_name || 'Unknown'}</div>
                        <div className="text-[10px] opacity-70">{appt.type}</div>
                        {nextVisitStatus(appt.status) && (
                          <button
                            onClick={() => statusMutation.mutate({ id: appt.id, status: nextVisitStatus(appt.status)! })}
                            className="mt-1 rounded border border-white/50 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-clinic-700 hover:bg-white"
                          >
                            {nextVisitLabel(appt.status)}
                          </button>
                        )}
                        {!['completed', 'cancelled', 'no_show'].includes(appt.status) && (
                          <>
                            <button
                              onClick={() => rescheduleMutation.mutate({ appointment: appt, minutes: 15 })}
                              className="ml-1 mt-1 rounded border border-white/50 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-clinic-700 hover:bg-white"
                            >
                              +15m
                            </button>
                            <button
                              onClick={() => reminderMutation.mutate(appt.id)}
                              title="Queue appointment reminders"
                              className="ml-1 mt-1 inline-flex items-center rounded border border-white/50 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-clinic-700 hover:bg-white"
                            >
                              <Bell className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                    {apps.length === 0 && i === 0 && (
                      <div className="rounded-md border border-dashed border-clinic-200 p-2 text-center text-xs text-clinic-400">
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

      {!isLoading && !isError && data?.data.length === 0 && (
        <div className="mt-4 rounded-lg border border-clinic-200 bg-white">
          <EmptyState title="No appointments this week" detail="Create an appointment to populate the clinic schedule." />
        </div>
      )}

      {showNewAppointment && (
        <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg rounded-md border border-clinic-300 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-900">New Appointment</h2>
              <button type="button" onClick={() => setShowNewAppointment(false)} className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-clinic-700">
                  Patient
                  <select required value={newAppointment.patient_id} onChange={(event) => setNewAppointment({ ...newAppointment, patient_id: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm">
                    <option value="">Select patient</option>
                    {patientOptions.map((patient) => <option key={patient.id} value={patient.id}>{patient.last_name}, {patient.first_name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Provider
                  <select required value={newAppointment.provider_id} onChange={(event) => setNewAppointment({ ...newAppointment, provider_id: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm">
                    <option value="">Select provider</option>
                    {providerOptions.map((provider) => <option key={provider.id} value={provider.id}>{provider.display_name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Start time
                  <input required type="datetime-local" value={newAppointment.start_time} onChange={(event) => setNewAppointment({ ...newAppointment, start_time: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Type
                  <input required value={newAppointment.type} onChange={(event) => setNewAppointment({ ...newAppointment, type: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block text-sm font-medium text-clinic-700">
                Notes
                <textarea value={newAppointment.notes} onChange={(event) => setNewAppointment({ ...newAppointment, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setShowNewAppointment(false)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">Cancel</button>
              <button disabled={createMutation.isPending} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
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
