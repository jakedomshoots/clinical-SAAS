import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { ROUTES, type PatientListResponse, type PortalIntakeListResponse, type PortalIntakeSubmission } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/portal-intake')({
  component: PortalIntakePage,
});

function PortalIntakePage() {
  const api = useApi();
  const queryClient = useQueryClient();
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
    mutationFn: ({ id, status }: { id: string; status: PortalIntakeSubmission['status'] }) => api.patch<PortalIntakeSubmission>(`${ROUTES.PORTAL_INTAKE}/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
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
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_12rem]">
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{item.request_type.replace('_', ' ')}</div>
                  <div className="mt-1 text-xs text-clinic-500">{JSON.stringify(item.submitted_payload)}</div>
                </div>
                <span className="text-sm font-medium text-clinic-700">{item.status}</span>
                <button onClick={() => updateMutation.mutate({ id: item.id, status: 'applied' })} className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">
                  Mark applied
                </button>
              </div>
            ))}
            {rows.length === 0 && <EmptyState title="No portal requests" detail="Stage intake, appointment, or document upload requests for review." />}
          </div>
        </section>
      )}
    </div>
  );
}
