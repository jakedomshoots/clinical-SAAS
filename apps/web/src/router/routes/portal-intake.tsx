import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { ROUTES, type AppointmentConflictCheck, type PatientListResponse, type PortalIntakeListResponse, type PortalIntakeSubmission } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';

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
        <p className="text-small text-ink-muted">Patient digital front door</p>
        <h1 className="mt-1 font-serif text-display text-ink">Portal Intake</h1>
        <p className="mt-2 max-w-3xl text-small text-ink-muted">Triage patient-submitted requests into chart updates, appointments, or document review with conflicts visible before scheduling.</p>
      </header>
      <section className="rounded-md border border-border bg-canvas-raised p-4">
        <div className="mb-3 flex items-center gap-2 text-headline font-sans font-semibold text-ink">
          <ClipboardList className="h-4 w-4 text-accent" />
          Stage Patient Requests
        </div>
        <div className="flex flex-wrap gap-2">
          {['intake_form', 'appointment_request', 'document_upload'].map((type) => (
            <button key={type} onClick={() => createMutation.mutate(type)} className="rounded-md border border-border bg-canvas-raised text-ink-secondary px-3 py-2 text-sm font-medium hover:border-border-strong hover:bg-canvas-sunk">
              {humanizeWorkflowLabel(type)}
            </button>
          ))}
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading portal intake" /> : (
        <section className="overflow-hidden rounded-md border border-border bg-canvas-raised">
          <div className="divide-y divide-border">
            {rows.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_8rem_22rem] border-b border-border-subtle hover:bg-canvas-sunk/50">
                <div>
                  <div className="text-sm font-semibold text-ink">{humanizeWorkflowLabel(item.request_type)}</div>
                  <div className="mt-1 text-xs text-ink-muted">{JSON.stringify(item.submitted_payload)}</div>
                  {conflictChecks[item.id] && (
                    <div className="mt-2 space-y-1">
                      {conflictChecks[item.id].warnings.map((warning) => <div key={warning} className="text-xs font-medium text-warn">{warning}</div>)}
                      {conflictChecks[item.id].suggested_slots.map((slot) => (
                        <button
                          key={slot.start_time}
                          onClick={() => updateMutation.mutate({ id: item.id, update: { submitted_payload: { ...item.submitted_payload, start_time: slot.start_time, end_time: slot.end_time, notes: 'Updated to alternate slot after conflict check.' } } })}
                          className="block text-left text-xs font-medium text-accent hover:text-accent"
                        >
                          Use alternate: {new Date(slot.start_time).toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-ink-secondary">{humanizeWorkflowLabel(item.status)}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'apply' })} className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft">Apply chart</button>
                  {item.request_type === 'appointment_request' && <button onClick={() => conflictMutation.mutate(item)} className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-xs font-medium text-warn">Check slot</button>}
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'appointment' })} className="rounded-md border border-border bg-canvas-raised px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk">Schedule</button>
                  <button onClick={() => actionMutation.mutate({ id: item.id, action: 'document' })} className="rounded-md border border-border bg-canvas-raised px-2 py-1 text-xs font-medium text-ink-secondary hover:bg-canvas-sunk">Document</button>
                  <button onClick={() => updateMutation.mutate({ id: item.id, update: { status: 'rejected' } })} className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-xs font-medium text-danger">Reject</button>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <EmptyState
                title="No portal requests"
                detail="Stage intake, appointment, or document upload requests for review. Empty means either the queue is clear or demo data has not been seeded yet."
                action={<button type="button" onClick={() => createMutation.mutate('intake_form')} className="rounded-md bg-accent text-accent-on px-4 py-2 text-sm font-medium hover:bg-accent-hover">Stage intake request</button>}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
