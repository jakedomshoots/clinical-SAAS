import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, CreditCard, ShieldCheck } from 'lucide-react';
import { ROUTES, type BillingCase, type BillingCaseListResponse, type BillingClaimReadiness, type BillingTimelineResponse, type BillingWorkQueue, type ChargeReviewListResponse, type EligibilityCheck, type PatientListResponse } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

function BillingPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ patient_id: '', payer: '', cpt_codes: '99213', diagnosis_codes: '', notes: '' });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDraft, setCaseDraft] = useState({ payer: '', cpt_codes: '', diagnosis_codes: '', notes: '' });
  const { data: cases, isLoading } = useQuery({
    queryKey: QUERY_KEYS.BILLING_CASES,
    queryFn: () => api.get<BillingCaseListResponse>(ROUTES.BILLING_CASES),
  });
  const { data: chargeReview } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, 'charge-review'],
    queryFn: () => api.get<ChargeReviewListResponse>(ROUTES.BILLING_CHARGE_REVIEW),
  });
  const { data: workQueue } = useQuery({
    queryKey: QUERY_KEYS.BILLING_WORK_QUEUE,
    queryFn: () => api.get<BillingWorkQueue>(ROUTES.BILLING_WORK_QUEUE),
  });
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'billing'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=100`),
  });
  const createMutation = useMutation({
    mutationFn: () => api.post<BillingCase>(ROUTES.BILLING_CASES, {
      patient_id: draft.patient_id,
      payer: draft.payer || null,
      cpt_codes: draft.cpt_codes.split(',').map((item) => item.trim()).filter(Boolean),
      diagnosis_codes: draft.diagnosis_codes.split(',').map((item) => item.trim()).filter(Boolean),
      notes: draft.notes || null,
    }),
    onSuccess: () => {
      setDraft({ patient_id: '', payer: '', cpt_codes: '99213', diagnosis_codes: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<BillingCase> }) => api.patch<BillingCase>(`${ROUTES.BILLING_CASES}/${id}`, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
    },
  });
  const fromEncounterMutation = useMutation({
    mutationFn: (encounterId: string) => api.post<BillingCase>(ROUTES.BILLING_FROM_ENCOUNTER(encounterId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
    },
  });
  const eligibilityMutation = useMutation({
    mutationFn: (patientId: string) => api.post<EligibilityCheck>(ROUTES.ELIGIBILITY_CHECK(patientId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
    },
  });
  const caseActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'submit' | 'payment' | 'deny' | 'rework' }) => {
      const route = action === 'submit' ? ROUTES.BILLING_CASE_SUBMIT(id) : action === 'payment' ? ROUTES.BILLING_CASE_PAYMENT(id) : ROUTES.BILLING_CASE_DENY(id);
      if (action === 'rework') return api.post<BillingCase>(ROUTES.BILLING_CASE_REWORK(id), { notes: 'Denial worked and ready to resubmit.' });
      return api.post<BillingCase>(route, action === 'deny' ? { notes: 'Denial received and queued for follow-up.' } : action === 'payment' ? { remittance_status: 'received' } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
    },
  });
  const rows = cases?.data ?? [];
  const reviewRows = chargeReview?.data ?? [];
  const patientOptions = patients?.data ?? [];
  const selectedCase = rows.find((item) => item.id === selectedCaseId) ?? null;
  const { data: selectedTimeline } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, selectedCaseId, 'timeline'],
    queryFn: () => api.get<BillingTimelineResponse>(ROUTES.BILLING_CASE_TIMELINE(selectedCaseId ?? '')),
    enabled: Boolean(selectedCaseId),
  });
  const { data: selectedReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, selectedCaseId, 'readiness'],
    queryFn: () => api.get<BillingClaimReadiness>(ROUTES.BILLING_CASE_READINESS(selectedCaseId ?? '')),
    enabled: Boolean(selectedCaseId),
  });

  function openCase(item: BillingCase) {
    setSelectedCaseId(item.id);
    setCaseDraft({
      payer: item.payer ?? '',
      cpt_codes: item.cpt_codes.join(', '),
      diagnosis_codes: item.diagnosis_codes.join(', '),
      notes: item.notes ?? '',
    });
  }

  function saveCase() {
    if (!selectedCase) return;
    updateMutation.mutate({
      id: selectedCase.id,
      update: {
        payer: caseDraft.payer || null,
        cpt_codes: caseDraft.cpt_codes.split(',').map((item) => item.trim()).filter(Boolean),
        diagnosis_codes: caseDraft.diagnosis_codes.split(',').map((item) => item.trim()).filter(Boolean),
        notes: caseDraft.notes || null,
      },
    });
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Revenue workflow</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Billing Cases</h1>
        <p className="mt-2 max-w-3xl text-sm text-clinic-500">Move signed clinical work through charge capture, eligibility, submission, denial rework, and payment without hiding blockers.</p>
      </header>
      <section className="grid gap-2 md:grid-cols-5">
        {[
          ['Ready', workQueue?.ready_count ?? 0],
          ['Submitted', workQueue?.submitted_count ?? 0],
          ['Denials', workQueue?.denial_rework_count ?? 0],
          ['Eligibility needed', workQueue?.eligibility_needed_count ?? 0],
          ['Remittance pending', workQueue?.remittance_pending_count ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-clinic-200 bg-white px-3 py-2">
            <div className="text-xl font-semibold text-clinic-900">{value}</div>
            <div className="text-xs text-clinic-500">{label}</div>
          </div>
        ))}
      </section>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-800">
          <CreditCard className="h-4 w-4 text-accent-700" />
          Charge Capture
        </div>
        <form onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }} className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto]">
          <select required value={draft.patient_id} onChange={(event) => setDraft({ ...draft, patient_id: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm">
            <option value="">Select patient</option>
            {patientOptions.map((patient) => <option key={patient.id} value={patient.id}>{patient.last_name}, {patient.first_name}</option>)}
          </select>
          <input placeholder="Payer" value={draft.payer} onChange={(event) => setDraft({ ...draft, payer: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input placeholder="CPT" value={draft.cpt_codes} onChange={(event) => setDraft({ ...draft, cpt_codes: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input placeholder="DX" value={draft.diagnosis_codes} onChange={(event) => setDraft({ ...draft, diagnosis_codes: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <button className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">Create</button>
        </form>
      </section>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
            <ClipboardCheck className="h-4 w-4 text-accent-700" />
            Charge Review
          </div>
          <span className="text-xs font-medium text-clinic-500">{reviewRows.length} signed notes pending charge capture</span>
        </div>
        <div className="divide-y divide-clinic-100">
          {reviewRows.map((item) => (
            <div key={item.encounter_id} className="grid gap-3 py-3 md:grid-cols-[1fr_9rem_auto]">
              <div>
                <div className="text-sm font-semibold text-clinic-900">{item.patient_name}</div>
                <div className="mt-1 text-xs text-clinic-500">{item.encounter_type} · CPT {item.recommended_cpt_codes.join(', ')}</div>
                {item.summary && <div className="mt-1 text-xs text-clinic-600">{item.summary}</div>}
              </div>
              <span className="text-xs text-clinic-500">{item.signed_at ? new Date(item.signed_at).toLocaleDateString() : 'Signed'}</span>
              <button onClick={() => fromEncounterMutation.mutate(item.encounter_id)} className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-xs font-medium text-accent-700 hover:bg-accent-100">
                Create case
              </button>
            </div>
          ))}
          {reviewRows.length === 0 && <EmptyState title="Charge review clear" detail="Signed encounters have billing coverage." />}
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading billing cases" /> : (
        <section className="overflow-hidden rounded-md border border-clinic-200 bg-white">
          <div className="divide-y divide-clinic-100">
            {rows.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_9rem_9rem_18rem]">
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{item.payer ?? 'No payer'}</div>
                  <div className="mt-1 text-xs text-clinic-500">CPT {item.cpt_codes.join(', ') || 'not coded'} · DX {item.diagnosis_codes.join(', ') || 'not coded'}</div>
                  <div className="mt-1 text-xs text-clinic-500">Claim {item.claim_control_number ?? 'not submitted'} · Remit {item.remittance_status}</div>
                  {item.status === 'denied' && item.denial_reason && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      {item.denial_reason}
                    </div>
                  )}
                  {item.notes && <div className="mt-1 text-xs text-clinic-600">{item.notes}</div>}
                </div>
                <select value={item.status} onChange={(event) => updateMutation.mutate({ id: item.id, update: { status: event.target.value as BillingCase['status'] } })} className="rounded-md border border-clinic-200 px-2 py-1 text-sm text-clinic-700">
                  {['draft', 'ready', 'submitted', 'denied', 'paid'].map((status) => <option key={status} value={status}>{humanizeWorkflowLabel(status)}</option>)}
                </select>
                <span className="text-sm text-clinic-500">{humanizeWorkflowLabel(item.eligibility_status)}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => eligibilityMutation.mutate(item.patient_id)} className="inline-flex items-center justify-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Eligibility
                  </button>
                  <button onClick={() => openCase(item)} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50">Details</button>
                  {item.status !== 'submitted' && item.status !== 'paid' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'submit' })} className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50">Submit</button>}
                  {item.status === 'submitted' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'payment' })} className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">Paid</button>}
                  {item.status === 'submitted' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'deny' })} className="rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Deny</button>}
                  {item.status === 'denied' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'rework' })} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">Work denial</button>}
                </div>
              </div>
            ))}
            {rows.length === 0 && <EmptyState title="No billing cases" detail="Start a case from charge capture or a signed encounter." />}
          </div>
        </section>
      )}
      {selectedCase && (
        <section className="rounded-md border border-clinic-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-clinic-900">Billing Case Detail</h2>
              <p className="text-xs text-clinic-500">Edit payer, codes, and case notes before submission.</p>
            </div>
            <button onClick={() => setSelectedCaseId(null)} className="rounded-md border border-clinic-200 px-2 py-1 text-xs font-medium text-clinic-600 hover:bg-clinic-50">Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Payer" placeholder="Payer" value={caseDraft.payer} onChange={(event) => setCaseDraft({ ...caseDraft, payer: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
            <input aria-label="CPT codes" placeholder="CPT codes" value={caseDraft.cpt_codes} onChange={(event) => setCaseDraft({ ...caseDraft, cpt_codes: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
            <input aria-label="Diagnosis codes" placeholder="Diagnosis codes" value={caseDraft.diagnosis_codes} onChange={(event) => setCaseDraft({ ...caseDraft, diagnosis_codes: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
            <textarea aria-label="Billing notes" placeholder="Notes" value={caseDraft.notes} onChange={(event) => setCaseDraft({ ...caseDraft, notes: event.target.value })} className="min-h-24 rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          </div>
          <button onClick={saveCase} className="mt-3 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">Save case</button>
          {selectedReadiness && (
            <div className={`mt-4 rounded-md border px-3 py-2 text-sm ${selectedReadiness.ready ? 'border-accent-200 bg-accent-50 text-accent-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="font-semibold">{selectedReadiness.ready ? 'Ready to submit' : 'Submission blockers'}</div>
              <div className="mt-1 text-xs">{selectedReadiness.recommended_next_step}</div>
              {selectedReadiness.blockers.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs">
                  {selectedReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              )}
              {selectedReadiness.warnings.length > 0 && (
                <div className="mt-2 text-xs">{selectedReadiness.warnings.join(' ')}</div>
              )}
            </div>
          )}
          <div className="mt-4 border-t border-clinic-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-clinic-500">Case timeline</h3>
            <div className="mt-2 space-y-2">
              {(selectedTimeline?.data ?? []).map((event) => (
                <div key={event.id} className="rounded-md bg-clinic-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-clinic-800">{event.event_type.replaceAll('_', ' ')}</div>
                    <span className="rounded border border-clinic-200 bg-white px-1.5 py-0.5 text-[11px] text-clinic-500">{event.status ?? event.source ?? 'audit'}</span>
                  </div>
                  <div className="mt-1 text-xs text-clinic-500">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(selectedTimeline?.data ?? []).length === 0 && <div className="text-xs text-clinic-400">No billing events have been recorded yet.</div>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
