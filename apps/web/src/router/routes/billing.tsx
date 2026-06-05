import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { ROUTES, type BillingCase, type BillingCaseListResponse, type EligibilityCheck, type Patient, type PatientListResponse } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState } from '@/lib/ui-state';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

function BillingPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: cases, isLoading } = useQuery({
    queryKey: QUERY_KEYS.BILLING_CASES,
    queryFn: () => api.get<BillingCaseListResponse>(ROUTES.BILLING_CASES),
  });
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'billing'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=100`),
  });
  const createMutation = useMutation({
    mutationFn: (patient: Patient) => api.post<BillingCase>(ROUTES.BILLING_CASES, { patient_id: patient.id, cpt_codes: ['99213'], diagnosis_codes: [] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES }),
  });
  const eligibilityMutation = useMutation({
    mutationFn: (patientId: string) => api.post<EligibilityCheck>(ROUTES.ELIGIBILITY_CHECK(patientId), {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES }),
  });
  const rows = cases?.data ?? [];
  const patientOptions = patients?.data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Revenue workflow</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Billing Cases</h1>
      </header>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-800">
          <CreditCard className="h-4 w-4 text-accent-700" />
          Charge Capture
        </div>
        <div className="flex flex-wrap gap-2">
          {patientOptions.slice(0, 5).map((patient) => (
            <button key={patient.id} onClick={() => createMutation.mutate(patient)} className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">
              Start case: {patient.last_name}, {patient.first_name}
            </button>
          ))}
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading billing cases" /> : (
        <section className="overflow-hidden rounded-md border border-clinic-200 bg-white">
          <div className="divide-y divide-clinic-100">
            {rows.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_10rem_9rem]">
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{item.payer ?? 'No payer'}</div>
                  <div className="mt-1 text-xs text-clinic-500">CPT {item.cpt_codes.join(', ') || 'not coded'} · DX {item.diagnosis_codes.join(', ') || 'not coded'}</div>
                  {item.notes && <div className="mt-1 text-xs text-clinic-600">{item.notes}</div>}
                </div>
                <span className="text-sm font-medium text-clinic-700">{item.status}</span>
                <span className="text-sm text-clinic-500">{item.eligibility_status}</span>
                <button onClick={() => eligibilityMutation.mutate(item.patient_id)} className="inline-flex items-center justify-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Eligibility
                </button>
              </div>
            ))}
            {rows.length === 0 && <EmptyState title="No billing cases" detail="Start a case from charge capture or a signed encounter." />}
          </div>
        </section>
      )}
    </div>
  );
}
