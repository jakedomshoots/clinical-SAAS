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
        <h1 className="font-serif text-display text-ink">Billing Cases</h1>
        <p className="text-small text-ink-muted mt-1 max-w-3xl">Move signed clinical work through charge capture, eligibility, submission, denial rework, and payment without hiding blockers.</p>
      </header>
      <section className="grid gap-3 md:grid-cols-5">
        {[
          ['Ready', workQueue?.ready_count ?? 0],
          ['Submitted', workQueue?.submitted_count ?? 0],
          ['Denials', workQueue?.denial_rework_count ?? 0],
          ['Eligibility needed', workQueue?.eligibility_needed_count ?? 0],
          ['Remittance pending', workQueue?.remittance_pending_count ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="bg-canvas-raised border border-border rounded-md p-4">
            <div className="font-serif text-2xl font-medium text-ink">{value}</div>
            <div className="text-meta text-ink-muted mt-1">{label}</div>
          </div>
        ))}
      </section>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="mb-3 flex items-center gap-2 text-subhead font-medium text-ink">
          <CreditCard className="h-4 w-4 text-accent" />
          Charge Capture
        </div>
        <form onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }} className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto]">
          <select required value={draft.patient_id} onChange={(event) => setDraft({ ...draft, patient_id: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink">
            <option value="">Select patient</option>
            {patientOptions.map((patient) => <option key={patient.id} value={patient.id}>{patient.last_name}, {patient.first_name}</option>)}
          </select>
          <input placeholder="Payer" value={draft.payer} onChange={(event) => setDraft({ ...draft, payer: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
          <input placeholder="CPT" value={draft.cpt_codes} onChange={(event) => setDraft({ ...draft, cpt_codes: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
          <input placeholder="DX" value={draft.diagnosis_codes} onChange={(event) => setDraft({ ...draft, diagnosis_codes: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
          <button className="bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">Create</button>
        </form>
      </section>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-subhead font-medium text-ink">
            <ClipboardCheck className="h-4 w-4 text-accent" />
            Charge Review
          </div>
          <span className="text-meta text-ink-muted">{reviewRows.length} signed notes pending charge capture</span>
        </div>
        <div className="divide-y divide-border">
          {reviewRows.map((item) => (
            <div key={item.encounter_id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_9rem_auto] hover:bg-canvas-sunk/50 transition-colors duration-150">
              <div>
                <div className="text-small font-medium text-ink">{item.patient_name}</div>
                <div className="text-meta text-ink-muted mt-1">{item.encounter_type} · CPT {item.recommended_cpt_codes.join(', ')}</div>
                {item.summary && <div className="text-small text-ink-secondary mt-1">{item.summary}</div>}
              </div>
              <span className="text-meta text-ink-muted">{item.signed_at ? new Date(item.signed_at).toLocaleDateString() : 'Signed'}</span>
              <button onClick={() => fromEncounterMutation.mutate(item.encounter_id)} className="rounded-md border border-accent-soft bg-accent-soft px-3 py-2 text-small font-medium text-accent hover:bg-accent-soft/80 active:scale-[0.98] transition-transform duration-75">
                Create case
              </button>
            </div>
          ))}
          {reviewRows.length === 0 && <EmptyState title="Charge review clear" detail="Signed encounters have billing coverage." />}
        </div>
      </section>
      {isLoading ? <LoadingState label="Loading billing cases" /> : (
        <section>
          <div className="divide-y divide-border">
            {rows.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_9rem_9rem_18rem] hover:bg-canvas-sunk/50 transition-colors duration-150">
                <div>
                  <div className="text-small font-medium text-ink">{item.payer ?? 'No payer'}</div>
                  <div className="text-meta text-ink-muted mt-1">CPT {item.cpt_codes.join(', ') || 'not coded'} · DX {item.diagnosis_codes.join(', ') || 'not coded'}</div>
                  <div className="text-meta text-ink-muted mt-1">Claim {item.claim_control_number ?? 'not submitted'} · Remit {item.remittance_status}</div>
                  {item.status === 'denied' && item.denial_reason && (
                    <div className="inline-flex items-center gap-1 rounded-pill bg-warn/10 px-2 py-0.5 text-micro font-medium text-warn mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      {item.denial_reason}
                    </div>
                  )}
                  {item.notes && <div className="text-small text-ink-secondary mt-1">{item.notes}</div>}
                </div>
                <select value={item.status} onChange={(event) => updateMutation.mutate({ id: item.id, update: { status: event.target.value as BillingCase['status'] } })} className="bg-canvas border border-border rounded-sm px-2 py-1 text-small text-ink">
                  {['draft', 'ready', 'submitted', 'denied', 'paid'].map((status) => <option key={status} value={status}>{humanizeWorkflowLabel(status)}</option>)}
                </select>
                <span className="text-small text-ink-muted">{humanizeWorkflowLabel(item.eligibility_status)}</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => eligibilityMutation.mutate(item.patient_id)} className="inline-flex items-center gap-1 rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-small font-medium text-accent hover:bg-accent-soft/80 active:scale-[0.98] transition-transform duration-75">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Eligibility
                  </button>
                  <button onClick={() => openCase(item)} className="rounded-md border border-border bg-canvas-raised px-2 py-1 text-small font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75">Details</button>
                  {item.status !== 'submitted' && item.status !== 'paid' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'submit' })} className="rounded-md border border-border bg-canvas-raised px-2 py-1 text-small font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75">Submit</button>}
                  {item.status === 'submitted' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'payment' })} className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-small font-medium text-accent hover:bg-accent-soft/80 active:scale-[0.98] transition-transform duration-75">Paid</button>}
                  {item.status === 'submitted' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'deny' })} className="rounded-md border border-danger/20 bg-danger/10 px-2 py-1 text-small font-medium text-danger hover:bg-danger/20 active:scale-[0.98] transition-transform duration-75">Deny</button>}
                  {item.status === 'denied' && <button onClick={() => caseActionMutation.mutate({ id: item.id, action: 'rework' })} className="rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-small font-medium text-warn hover:bg-warn/20 active:scale-[0.98] transition-transform duration-75">Work denial</button>}
                </div>
              </div>
            ))}
            {rows.length === 0 && <EmptyState title="No billing cases" detail="Start a case from charge capture or a signed encounter." />}
          </div>
        </section>
      )}
      {selectedCase && (
        <section className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-subhead font-medium text-ink">Billing Case Detail</h2>
              <p className="text-small text-ink-muted mt-1">Edit payer, codes, and case notes before submission.</p>
            </div>
            <button onClick={() => setSelectedCaseId(null)} className="rounded-md border border-border bg-canvas-raised px-2 py-1 text-small font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75">Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input aria-label="Payer" placeholder="Payer" value={caseDraft.payer} onChange={(event) => setCaseDraft({ ...caseDraft, payer: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
            <input aria-label="CPT codes" placeholder="CPT codes" value={caseDraft.cpt_codes} onChange={(event) => setCaseDraft({ ...caseDraft, cpt_codes: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
            <input aria-label="Diagnosis codes" placeholder="Diagnosis codes" value={caseDraft.diagnosis_codes} onChange={(event) => setCaseDraft({ ...caseDraft, diagnosis_codes: event.target.value })} className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
            <textarea aria-label="Billing notes" placeholder="Notes" value={caseDraft.notes} onChange={(event) => setCaseDraft({ ...caseDraft, notes: event.target.value })} className="min-h-24 bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint" />
          </div>
          <button onClick={saveCase} className="mt-3 bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">Save case</button>
          {selectedReadiness && (
            <div className={`mt-4 rounded-md border px-3 py-2 text-small ${selectedReadiness.ready ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
              <div className="font-medium">{selectedReadiness.ready ? 'Ready to submit' : 'Submission blockers'}</div>
              <div className="text-meta mt-1">{selectedReadiness.recommended_next_step}</div>
              {selectedReadiness.blockers.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-small">
                  {selectedReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                </ul>
              )}
              {selectedReadiness.warnings.length > 0 && (
                <div className="mt-2 text-small">{selectedReadiness.warnings.join(' ')}</div>
              )}
            </div>
          )}
          <div className="mt-4 border-t border-border pt-3">
            <h3 className="text-meta font-medium text-ink-muted uppercase">Case timeline</h3>
            <div className="mt-2 space-y-2">
              {(selectedTimeline?.data ?? []).map((event) => (
                <div key={event.id} className="rounded-sm bg-canvas-sunk px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-small font-medium text-ink">{event.event_type.replaceAll('_', ' ')}</div>
                    <span className="rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro text-ink-muted">{event.status ?? event.source ?? 'audit'}</span>
                  </div>
                  <div className="text-meta text-ink-muted mt-1">{new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(selectedTimeline?.data ?? []).length === 0 && <div className="text-small text-ink-faint">No billing events have been recorded yet.</div>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
