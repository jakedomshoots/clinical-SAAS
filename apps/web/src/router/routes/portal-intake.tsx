import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
  ROUTES,
  type AppointmentConflictCheck,
  type PatientListResponse,
  type PortalIntakeListResponse,
  type PortalIntakeSubmission,
} from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';

type IntakeFilter = 'all' | 'intake_form' | 'appointment_request' | 'document_upload';

export const Route = createFileRoute('/portal-intake')({
  component: PortalIntakePage,
});

function statusTone(status: string) {
  if (status === 'applied' || status === 'processed')
    return 'border-success/20 bg-success/10 text-success';
  if (status === 'rejected') return 'border-danger/20 bg-danger/10 text-danger';
  if (status === 'pending' || status === 'needs_review')
    return 'border-accent-soft bg-accent-soft text-accent';
  return 'border-border bg-canvas-sunk text-ink-muted';
}

function formatPayload(payload: Record<string, unknown>) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2 text-micro">
      {Object.entries(payload).map(([key, value]) => {
        if (value === null || value === undefined || value === '') return null;
        let displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (key.includes('time') && typeof value === 'string') {
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) {
            displayVal = date.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
          }
        }
        return (
          <span
            key={key}
            className="inline-flex items-center rounded-sm bg-canvas-sunk px-2 py-0.5 text-ink-secondary border border-border-subtle"
          >
            <span className="font-semibold text-ink-muted capitalize mr-1">
              {key.replace('_', ' ')}:
            </span>
            {displayVal}
          </span>
        );
      })}
    </div>
  );
}

import { useDocumentTitle } from '@/hooks/use-document-title';

function PortalIntakePage() {
  useDocumentTitle('Portal Intake');
  const api = useApi();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'intake_form' | 'appointment_request' | 'document_upload'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [conflictChecks, setConflictChecks] = useState<
    Record<
      string,
      { warnings: string[]; suggested_slots: { start_time: string; end_time: string }[] }
    >
  >({});

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.PORTAL_INTAKE,
    queryFn: () => api.get<PortalIntakeListResponse>(ROUTES.PORTAL_INTAKE),
  });
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'intake'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=20`),
  });
  const createMutation = useMutation({
    mutationFn: (request_type: string) =>
      api.post<PortalIntakeSubmission>(ROUTES.PORTAL_INTAKE, {
        patient_id: patients?.data[0]?.id ?? null,
        request_type,
        submitted_payload: { reason: request_type, source: 'staff demo entry' },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<PortalIntakeSubmission> }) =>
      api.patch<PortalIntakeSubmission>(`${ROUTES.PORTAL_INTAKE}/${id}`, update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'apply' | 'appointment' | 'document' }) => {
      const route =
        action === 'apply'
          ? ROUTES.PORTAL_INTAKE_APPLY(id)
          : action === 'appointment'
            ? ROUTES.PORTAL_INTAKE_APPOINTMENT(id)
            : ROUTES.PORTAL_INTAKE_DOCUMENT(id);
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
      if (!providerId || !startTime || !endTime)
        return {
          id: item.id,
          warnings: ['Provider and requested time are required before conflict checking.'],
          suggested_slots: [],
        };
      const params = new URLSearchParams({
        provider_id: providerId,
        start_time: startTime,
        end_time: endTime,
      });
      const result = await api.get<AppointmentConflictCheck>(
        `${ROUTES.APPOINTMENT_CONFLICT_CHECK}?${params.toString()}`
      );
      return {
        id: item.id,
        warnings: result.warnings.length > 0 ? result.warnings : ['No conflicts found.'],
        suggested_slots: result.suggested_slots,
      };
    },
    onSuccess: ({ id, warnings, suggested_slots }) =>
      setConflictChecks((current) => ({ ...current, [id]: { warnings, suggested_slots } })),
  });

  const rows = data?.data ?? [];
  const filteredRows = rows.filter((item) => {
    const matchesCategory = activeFilter === 'all' || item.request_type === activeFilter;
    const matchesSearch =
      searchQuery === '' ||
      item.request_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(item.submitted_payload).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-small text-ink-muted">Patient digital front door</p>
        <h1 className="mt-1 font-serif text-display text-ink">Portal Intake</h1>
        <p className="mt-2 max-w-3xl text-small text-ink-muted">
          Triage patient-submitted requests into chart updates, appointments, or document review
          with conflicts visible before scheduling.
        </p>
      </header>

      <section className="rounded-md border border-border bg-canvas-raised p-4">
        <div className="mb-3 flex items-center gap-2 text-subhead font-semibold text-ink">
          <ClipboardList className="h-4 w-4 text-accent" />
          Stage Patient Requests
        </div>
        <p className="mb-3 text-small text-ink-muted">
          Add a new portal request to the queue for triage.
        </p>
        <div className="action-group">
          {['intake_form', 'appointment_request', 'document_upload'].map((type) => (
            <button
              key={type}
              onClick={() => createMutation.mutate(type)}
              className="btn btn-secondary btn-sm"
            >
              {humanizeWorkflowLabel(type)}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-canvas-raised px-4 py-3 rounded-md border border-border">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'All Requests' },
            { key: 'intake_form', label: 'Intake Forms' },
            { key: 'appointment_request', label: 'Appt Requests' },
            { key: 'document_upload', label: 'Uploads' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as IntakeFilter)}
              className={`tab-pill ${
                activeFilter === tab.key ? 'tab-pill-active' : 'tab-pill-inactive'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter requests..."
          className="w-full sm:w-64 bg-canvas border border-border rounded-md px-3 py-1.5 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading portal intake" />
      ) : (
        <section className="overflow-hidden rounded-md border border-border bg-canvas-raised">
          <div className="divide-y divide-border">
            {filteredRows.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 px-5 py-4 border-b border-border-subtle hover:bg-canvas-sunk/30 transition-colors duration-150"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="text-small font-semibold text-ink">
                      {humanizeWorkflowLabel(item.request_type)}
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-pill px-2 py-0.5 text-micro font-medium border ${statusTone(item.status)}`}
                    >
                      {humanizeWorkflowLabel(item.status)}
                    </span>
                  </div>

                  <div className="action-group shrink-0">
                    <button
                      onClick={() => actionMutation.mutate({ id: item.id, action: 'apply' })}
                      className="btn btn-sm btn-accent-soft"
                    >
                      Apply chart
                    </button>
                    {item.request_type === 'appointment_request' && (
                      <button
                        onClick={() => conflictMutation.mutate(item)}
                        className="btn btn-sm btn-warn"
                      >
                        Check slot
                      </button>
                    )}
                    <button
                      onClick={() => actionMutation.mutate({ id: item.id, action: 'appointment' })}
                      className="btn btn-sm btn-secondary"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => actionMutation.mutate({ id: item.id, action: 'document' })}
                      className="btn btn-sm btn-secondary"
                    >
                      Document
                    </button>
                    <button
                      onClick={() =>
                        updateMutation.mutate({ id: item.id, update: { status: 'rejected' } })
                      }
                      className="btn btn-sm btn-danger"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  {formatPayload(item.submitted_payload)}
                  {conflictChecks[item.id] && (
                    <div className="mt-2.5 bg-canvas p-2.5 rounded border border-border-subtle space-y-1.5 animate-in fade-in duration-100">
                      <div className="text-micro font-bold text-ink-secondary uppercase tracking-wide">
                        Conflict Results
                      </div>
                      {conflictChecks[item.id].warnings.map((warning) => (
                        <div
                          key={warning}
                          className="text-micro font-medium text-danger flex items-center gap-1.5"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                          {warning}
                        </div>
                      ))}
                      {conflictChecks[item.id].suggested_slots.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[11px] font-medium text-ink-muted">
                            Suggested open slots:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {conflictChecks[item.id].suggested_slots.map((slot) => (
                              <button
                                key={slot.start_time}
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: item.id,
                                    update: {
                                      submitted_payload: {
                                        ...item.submitted_payload,
                                        start_time: slot.start_time,
                                        end_time: slot.end_time,
                                        notes: 'Updated to alternate slot after conflict check.',
                                      },
                                    },
                                  })
                                }
                                className="inline-flex rounded border border-accent bg-accent-soft px-2 py-0.5 text-micro font-medium text-accent hover:bg-accent hover:text-accent-on transition-colors duration-150 active:scale-[0.98] cursor-pointer"
                              >
                                {new Date(slot.start_time).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                (
                                {new Date(slot.start_time).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                                )
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredRows.length === 0 && (
              <EmptyState
                title="No portal requests match filters"
                detail="Stage intake, appointment, or document upload requests, or try clearing your search query."
                action={
                  <button
                    type="button"
                    onClick={() => createMutation.mutate('intake_form')}
                    className="rounded-md bg-accent text-accent-on px-4 py-2 text-sm font-medium hover:bg-accent-hover cursor-pointer active:scale-[0.98]"
                  >
                    Stage intake request
                  </button>
                }
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
