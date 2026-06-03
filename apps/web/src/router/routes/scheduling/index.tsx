import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@concierge-os/shared';
import type { Appointment } from '@concierge-os/shared';
import { ChevronLeft, ChevronRight, Plus, Loader2 } from 'lucide-react';

interface AppointmentListResponse {
  data: Appointment[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-100 text-sky-700 border-sky-200',
  checked_in: 'bg-amber-100 text-amber-700 border-amber-200',
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
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const startStr = formatDate(weekStart);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 7);
  const endStr = formatDate(endDate);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.APPOINTMENTS, startStr, endStr],
    queryFn: () =>
      api.get<AppointmentListResponse>(`/schedule/appointments?start_date=${startStr}&end_date=${endStr}`),
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

  function appointmentsForDay(day: Date): Appointment[] {
    if (!data?.data) return [];
    const dayStr = formatDate(day);
    return data.data.filter((a) => a.start_time.startsWith(dayStr));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Schedule</h1>
        <button className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-clinic-400" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0 rounded-lg border border-clinic-200 bg-white">
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
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
