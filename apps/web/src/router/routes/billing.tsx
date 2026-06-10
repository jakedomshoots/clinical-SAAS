import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SearchablePatientPicker } from '@/components/searchable-patient-picker';
import { useToast } from '@/components/toast';
import { Button } from '@/components/button';
import { useState, useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  ROUTES,
  type BillingCase,
  type BillingCaseListResponse,
  type BillingClaimReadiness,
  type BillingTimelineResponse,
  type BillingWorkQueue,
  type ChargeReviewListResponse,
  type EligibilityCheck,
  type PatientListResponse,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';

export const Route = createFileRoute('/billing')({
  component: BillingPage,
});

import { useDocumentTitle } from '@/hooks/use-document-title';

function BillingPage() {
  useDocumentTitle('Billing');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState({
    patient_id: '',
    payer: '',
    cpt_codes: '99213',
    diagnosis_codes: '',
    notes: '',
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDraft, setCaseDraft] = useState({
    payer: '',
    cpt_codes: '',
    diagnosis_codes: '',
    notes: '',
  });
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
    mutationFn: () =>
      api.post<BillingCase>(ROUTES.BILLING_CASES, {
        patient_id: draft.patient_id,
        payer: draft.payer || null,
        cpt_codes: draft.cpt_codes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        diagnosis_codes: draft.diagnosis_codes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes: draft.notes || null,
      }),
    onSuccess: () => {
      setDraft({ patient_id: '', payer: '', cpt_codes: '99213', diagnosis_codes: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
      toast.success('Billing case created');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create billing case');
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<BillingCase> }) =>
      api.patch<BillingCase>(`${ROUTES.BILLING_CASES}/${id}`, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
      toast.success('Billing case updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update billing case');
    },
  });
  const fromEncounterMutation = useMutation({
    mutationFn: (encounterId: string) =>
      api.post<BillingCase>(ROUTES.BILLING_FROM_ENCOUNTER(encounterId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
      toast.success('Billing case created from encounter');
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create billing case from encounter'
      );
    },
  });
  const eligibilityMutation = useMutation({
    mutationFn: (patientId: string) =>
      api.post<EligibilityCheck>(ROUTES.ELIGIBILITY_CHECK(patientId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
      toast.success('Eligibility check completed');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Eligibility check failed');
    },
  });
  const caseActionMutation = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'submit' | 'payment' | 'deny' | 'rework';
    }) => {
      const route =
        action === 'submit'
          ? ROUTES.BILLING_CASE_SUBMIT(id)
          : action === 'payment'
            ? ROUTES.BILLING_CASE_PAYMENT(id)
            : ROUTES.BILLING_CASE_DENY(id);
      if (action === 'rework')
        return api.post<BillingCase>(ROUTES.BILLING_CASE_REWORK(id), {
          notes: 'Denial worked and ready to resubmit.',
        });
      return api.post<BillingCase>(
        route,
        action === 'deny'
          ? { notes: 'Denial received and queued for follow-up.' }
          : action === 'payment'
            ? { remittance_status: 'received' }
            : {}
      );
    },
    onSuccess: (res, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE });
      const actionLabels = {
        submit: 'submitted',
        payment: 'marked as paid',
        deny: 'marked as denied',
        rework: 'queued for rework',
      };
      toast.success(`Billing case successfully ${actionLabels[variables.action]}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    },
  });
  const rows = useMemo(() => cases?.data ?? [], [cases?.data]);
  const reviewRows = chargeReview?.data ?? [];
  const patientOptions = patients?.data ?? [];
  const selectedCase = rows.find((item) => item.id === selectedCaseId) ?? null;
  const { data: selectedTimeline } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, selectedCaseId, 'timeline'],
    queryFn: () =>
      api.get<BillingTimelineResponse>(ROUTES.BILLING_CASE_TIMELINE(selectedCaseId ?? '')),
    enabled: Boolean(selectedCaseId),
  });
  const { data: selectedReadiness } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, selectedCaseId, 'readiness'],
    queryFn: () =>
      api.get<BillingClaimReadiness>(ROUTES.BILLING_CASE_READINESS(selectedCaseId ?? '')),
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
        cpt_codes: caseDraft.cpt_codes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        diagnosis_codes: caseDraft.diagnosis_codes
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        notes: caseDraft.notes || null,
      },
    });
  }

  const pipelineData = useMemo(() => {
    if (!workQueue) return [];
    const closedCount = rows.filter((c) => c.status === 'paid').length;
    return [
      { name: 'Ready to File', value: workQueue.ready_count ?? 0, color: 'var(--color-info)' },
      { name: 'Submitted', value: workQueue.submitted_count ?? 0, color: 'var(--accent)' },
      { name: 'Denials / Rework', value: workQueue.denial_rework_count ?? 0, color: 'var(--color-danger)' },
      { name: 'Paid / Closed', value: closedCount, color: 'var(--color-success)' },
    ];
  }, [workQueue, rows]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-display text-ink">Billing Cases</h1>
        <p className="text-small text-ink-muted mt-1 max-w-3xl">
          Move signed clinical work through charge capture, eligibility, submission, denial rework,
          and payment without hiding blockers.
        </p>
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

      <ErrorBoundary title="Billing Pipeline Error">
        {workQueue && (
          <div className="bg-canvas-raised border border-border rounded-md p-4">
            <h2 className="text-subhead font-medium text-ink flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-accent" />
              Billing Pipeline Funnel
            </h2>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={pipelineData}
                  margin={{ top: 5, right: 10, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" stroke="var(--ink-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="var(--ink-muted)" fontSize={10} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--canvas-raised)',
                      borderColor: 'var(--border)',
                      color: 'var(--ink)',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </ErrorBoundary>

      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="mb-3 flex items-center gap-2 text-subhead font-medium text-ink">
          <CreditCard className="h-4 w-4 text-accent" />
          Charge Capture
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate();
          }}
          className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto] items-end"
        >
          <div className="w-full">
            <SearchablePatientPicker
              required
              patients={patientOptions}
              value={draft.patient_id}
              onChange={(val) => setDraft({ ...draft, patient_id: val })}
              placeholder="Select patient..."
            />
          </div>
          <input
            placeholder="Payer"
            value={draft.payer}
            onChange={(event) => setDraft({ ...draft, payer: event.target.value })}
            className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <input
            placeholder="CPT"
            value={draft.cpt_codes}
            onChange={(event) => setDraft({ ...draft, cpt_codes: event.target.value })}
            className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <input
            placeholder="DX"
            value={draft.diagnosis_codes}
            onChange={(event) => setDraft({ ...draft, diagnosis_codes: event.target.value })}
            className="bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <Button loading={createMutation.isPending}>Create</Button>
        </form>
      </section>
      <section className="bg-canvas-raised border border-border rounded-md p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-subhead font-medium text-ink">
            <ClipboardCheck className="h-4 w-4 text-accent" />
            Charge Review
          </div>
          <span className="text-meta text-ink-muted">
            {reviewRows.length} signed notes pending charge capture
          </span>
        </div>
        <div className="divide-y divide-border">
          {reviewRows.map((item) => (
            <div
              key={item.encounter_id}
              className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_9rem_auto] hover:bg-canvas-sunk/50 transition-colors duration-150"
            >
              <div>
                <div className="text-small font-medium text-ink">{item.patient_name}</div>
                <div className="text-meta text-ink-muted mt-1">
                  {item.encounter_type} · CPT {item.recommended_cpt_codes.join(', ')}
                </div>
                {item.summary && (
                  <div className="text-small text-ink-secondary mt-1">{item.summary}</div>
                )}
              </div>
              <span className="text-meta text-ink-muted">
                {item.signed_at ? new Date(item.signed_at).toLocaleDateString() : 'Signed'}
              </span>
              <button
                onClick={() => fromEncounterMutation.mutate(item.encounter_id)}
                className="btn btn-sm btn-accent-soft"
              >
                Create case
              </button>
            </div>
          ))}
          {reviewRows.length === 0 && (
            <EmptyState
              title="Charge review clear"
              detail="Signed encounters have billing coverage."
            />
          )}
        </div>
      </section>
      <ErrorBoundary title="Billing Cases Error">
        {isLoading ? (
          <LoadingState label="Loading billing cases" />
        ) : (
          <section>
          <div className="divide-y divide-border">
            {rows.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_9rem_9rem_18rem] hover:bg-canvas-sunk/50 transition-colors duration-150"
              >
                <div>
                  <div className="text-small font-medium text-ink">{item.payer ?? 'No payer'}</div>
                  <div className="text-meta text-ink-muted mt-1">
                    CPT {item.cpt_codes.join(', ') || 'not coded'} · DX{' '}
                    {item.diagnosis_codes.join(', ') || 'not coded'}
                  </div>
                  <div className="text-meta text-ink-muted mt-1">
                    Claim {item.claim_control_number ?? 'not submitted'} · Remit{' '}
                    {item.remittance_status}
                  </div>
                  {item.status === 'denied' && item.denial_reason && (
                    <div className="inline-flex items-center gap-1 rounded-pill bg-warn/10 px-2 py-0.5 text-micro font-medium text-warn mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      {item.denial_reason}
                    </div>
                  )}
                  {item.notes && (
                    <div className="text-small text-ink-secondary mt-1">{item.notes}</div>
                  )}
                </div>
                <select
                  value={item.status}
                  onChange={(event) =>
                    updateMutation.mutate({
                      id: item.id,
                      update: { status: event.target.value as BillingCase['status'] },
                    })
                  }
                  className="bg-canvas border border-border rounded-sm px-2 py-1 text-small text-ink"
                >
                  {['draft', 'ready', 'submitted', 'denied', 'paid'].map((status) => (
                    <option key={status} value={status}>
                      {humanizeWorkflowLabel(status)}
                    </option>
                  ))}
                </select>
                <span className="text-small text-ink-muted">
                  {humanizeWorkflowLabel(item.eligibility_status)}
                </span>
                <div className="action-group">
                  <button
                    onClick={() => eligibilityMutation.mutate(item.patient_id)}
                    disabled={eligibilityMutation.isPending}
                    className="btn btn-sm btn-accent-soft inline-flex items-center gap-1.5"
                  >
                    {eligibilityMutation.isPending && eligibilityMutation.variables === item.patient_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Eligibility
                  </button>
                  <button onClick={() => openCase(item)} className="btn btn-sm btn-secondary">
                    Details
                  </button>
                  {item.status !== 'submitted' && item.status !== 'paid' && (
                    <button
                      onClick={() => caseActionMutation.mutate({ id: item.id, action: 'submit' })}
                      disabled={caseActionMutation.isPending}
                      className="btn btn-sm btn-secondary inline-flex items-center gap-1.5"
                    >
                      {caseActionMutation.isPending &&
                        caseActionMutation.variables?.id === item.id &&
                        caseActionMutation.variables?.action === 'submit' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      Submit
                    </button>
                  )}
                  {item.status === 'submitted' && (
                    <button
                      onClick={() => caseActionMutation.mutate({ id: item.id, action: 'payment' })}
                      disabled={caseActionMutation.isPending}
                      className="btn btn-sm btn-accent-soft inline-flex items-center gap-1.5"
                    >
                      {caseActionMutation.isPending &&
                        caseActionMutation.variables?.id === item.id &&
                        caseActionMutation.variables?.action === 'payment' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      Paid
                    </button>
                  )}
                  {item.status === 'submitted' && (
                    <button
                      onClick={() => caseActionMutation.mutate({ id: item.id, action: 'deny' })}
                      disabled={caseActionMutation.isPending}
                      className="btn btn-sm btn-danger inline-flex items-center gap-1.5"
                    >
                      {caseActionMutation.isPending &&
                        caseActionMutation.variables?.id === item.id &&
                        caseActionMutation.variables?.action === 'deny' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      Deny
                    </button>
                  )}
                  {item.status === 'denied' && (
                    <button
                      onClick={() => caseActionMutation.mutate({ id: item.id, action: 'rework' })}
                      disabled={caseActionMutation.isPending}
                      className="btn btn-sm btn-warn inline-flex items-center gap-1.5"
                    >
                      {caseActionMutation.isPending &&
                        caseActionMutation.variables?.id === item.id &&
                        caseActionMutation.variables?.action === 'rework' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                      Work denial
                    </button>
                  )}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <EmptyState
                title="No billing cases"
                detail="Start a case from charge capture or a signed encounter."
              />
            )}
          </div>
        </section>
      )}
      {selectedCase && (
        <section className="bg-canvas-raised border border-border rounded-md p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-subhead font-medium text-ink">Billing Case Detail</h2>
              <p className="text-small text-ink-muted mt-1">
                Edit payer, codes, and case notes before submission.
              </p>
            </div>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <input
              aria-label="Payer"
              placeholder="Payer"
              value={caseDraft.payer}
              onChange={(event) => setCaseDraft({ ...caseDraft, payer: event.target.value })}
              className="bg-canvas border border-border rounded-sm px-3 py-2 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            />
            <input
              aria-label="CPT codes"
              placeholder="CPT codes (comma separated)"
              value={caseDraft.cpt_codes}
              onChange={(event) => setCaseDraft({ ...caseDraft, cpt_codes: event.target.value })}
              className="bg-canvas border border-border rounded-sm px-3 py-2 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            />
            <input
              aria-label="Diagnosis codes"
              placeholder="Diagnosis codes (comma separated)"
              value={caseDraft.diagnosis_codes}
              onChange={(event) =>
                setCaseDraft({ ...caseDraft, diagnosis_codes: event.target.value })
              }
              className="bg-canvas border border-border rounded-sm px-3 py-2 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            />
            <textarea
              aria-label="Billing notes"
              placeholder="Notes"
              value={caseDraft.notes}
              onChange={(event) => setCaseDraft({ ...caseDraft, notes: event.target.value })}
              className="min-h-20 bg-canvas border border-border rounded-sm px-3 py-2 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            />
          </div>
          <div className="action-group">
            <button onClick={saveCase} className="btn btn-primary">
              Save case
            </button>
            <button onClick={() => setSelectedCaseId(null)} className="btn btn-secondary">
              Close detail
            </button>
          </div>
          {selectedReadiness && (
            <div
              className={`mt-4 rounded-md border px-3 py-2 text-small ${selectedReadiness.ready ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}
            >
              <div className="font-medium">
                {selectedReadiness.ready ? 'Ready to submit' : 'Submission blockers'}
              </div>
              <div className="text-meta mt-1">{selectedReadiness.recommended_next_step}</div>
              {selectedReadiness.blockers.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-small">
                  {selectedReadiness.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
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
                    <div className="text-small font-medium text-ink">
                      {event.event_type.replaceAll('_', ' ')}
                    </div>
                    <span className="rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro text-ink-muted">
                      {event.status ?? event.source ?? 'audit'}
                    </span>
                  </div>
                  <div className="text-meta text-ink-muted mt-1">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {(selectedTimeline?.data ?? []).length === 0 && (
                <div className="text-small text-ink-faint">
                  No billing events have been recorded yet.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      </ErrorBoundary>
    </div>
  );
}
