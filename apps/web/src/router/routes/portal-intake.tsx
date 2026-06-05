import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { ROUTES, type AppointmentConflictCheck, type PatientListResponse, type PortalIntakeListResponse, type PortalIntakeSubmission } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/portal-intake')({
  component: PortalIntakePage,
});

function PortalIntakePage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [conflictChecks, setConflictChecks] = useState<Record<string, { warnings: string[]; suggested_slots: { start_time: string; end_time: string }[] }>>({});
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.PORTAL_INTAKE,
    queryFn: () => api.get<PortalIntakeListResponse>(ROUTES.PORTAL_INTAKE),
  });
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'intake'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=20`),
  });
  const createMutation = useMutation({
    mutationFn: (request_type: string) => api.post<PortalIntakeSubmission>(ROUTES.PORTAL_INTAKE, {
      patient_id: patients?.data[0]?.id ?? null,
      request_type,
      submitted_payload: { reason: request_type, source: 'staff demo entry' },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<PortalIntakeSubmission> }) => api.patch<PortalIntakeSubmission>(`${ROUTES.PORTAL_INTAKE}/${id}`, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'apply' | 'appointment' | 'document' }) => {
      const route = action === 'apply' ? ROUTES.PORTAL_INTAKE_APPLY(id) : action === 'appointment' ? ROUTES.PORTAL_INTAKE_APPOINTMENT(id) : ROUTES.PORTAL_INTAKE_DOCUMENT(id);
      return api.post(route, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
    },
  });
  const conflictMutation = useMutation({
    mutationFn: async (item: PortalIntakeSubmission) => {
      const payload = item.submitted_payload;
      const providerId = String(payload.provider_id ?? '');
      const startTime = String(payload.start_time ?? '');
      const endTime = String(payload.end_time ?? '');
      if (!providerId || !startTime || !endTime) return { id: item.id, warnings: ['Provider and requested time are required before conflict checking.'], suggested_slots: [] };
      const params = new URLSearchParams({ provider_id: providerId, start_time: startTime, end_time: endTime });
      const result = await api.get<AppointmentConflictCheck>(`${ROUTES.APPOINTMENT_CONFLICT_CHECK}?${params.toString()}`);
      return { id: item.id, warnings: result.warnings.length > 0 ? result.warnings : ['No conflicts found.'], suggested_slots: result.suggested_slots };
    },
    onSuccess: ({ id, warnings, suggested_slots }) => setConflictChecks((current) => ({ ...current, [id]: { warnings, suggested_slots } })),
  });
  const rows = data?.data ?? [];
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Patient digital front door</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Portal Intake</h1>
      </header>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-800">
          <ClipboardList className="h-4 w-4 text-accent-700" />
          Stage Patient Requests
        </div>
        <div className="flex flex-wrap gap-2">
          {['intake_form', 'appointment_request', 'document_upload'].map((type) => (
            <button key={type} onClick={() => createMutation.mutate(type)} className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading portal intake" /> : (
        <section className="overflow-hidden rounded-md border border-clinic-200 bg-white">
          <div className="divide-y divide-clinic-100">
            {rows.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_8rem_22rem]">
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{item.request_type.replace('_', ' ')}</div>
                  <div className="mt-1 text-xs text-clinic-500">{JSON.stringify(item.submitted_payload)}</div>
                  {conflictChecks[item.id] && (
                    <div className="mt-2 space-y-1">
                      {conflictChecks[item.id].warnings.map((warning) => <div key={warning} className="text-xs font-medium text-amber-700">{warning}</div>)}
                      {conflictChecks[item.id].suggested_slots.map((slot) => (
                        <button
                          key={slot.start_time}
                          onClick={() => updateMutation.mutate({ id: item.id, update: { submitted_payload: { ...item.submitted_payload, start_time: slot.start_time, end_time: slot.end_time, notes: 'Updated to alternate slot after conflict check.' } } })}
                          className="block text-left text-xs font-medium text-accent-700 hover:text-accent-900"
                        >
                          Use alternate: {new Date(slot.start_time).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-clinic-700">{item.status}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'apply' })} className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">Apply chart</button>
                  {item.request_type === 'appointment_request' && <button onClick={() => conflictMutation.mutate(item)} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Check slot</button>}
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'appointment' })} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50">Schedule</button>
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'document' })} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50">Document</button>
                  <button onClick={() => updateMutation.mutate({ id: item.id, update: { status: 'rejected' } })} className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Reject</button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <EmptyState title="No portal requests" detail="Stage intake, appointment, or document upload requests for review." />}
          </div>
        </section>
      )}
    </div>
  );
}
