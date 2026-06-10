import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { useToast } from '@/components/toast';
import {
  ROUTES,
  type Patient,
  type PatientDocument,
  type PatientDocumentProcessResult,
  type PatientDocumentQueueItem,
  type PatientDocumentQueueResponse,
} from '@concierge-os/shared';
import { Check, FileText, FolderOpen, Plus, X } from 'lucide-react';

interface PatientListResponse {
  data: Patient[];
  total: number;
  page: number;
  page_size: number;
}

type DocumentQueueFormState = {
  status: PatientDocument['status'];
  routed_to_role: string;
  review_priority: string;
  reviewed_by: string;
  review_note: string;
};

type PatientSearch = {
  search?: string;
  page?: number;
  docStatus?: string;
  docRole?: string;
  docPriority?: string;
  docPage?: number;
};

export const Route = createFileRoute('/patients/')({
  component: PatientListPage,
  validateSearch: (search: Record<string, unknown>): PatientSearch => {
    return {
      search: search.search as string | undefined,
      page: Number(search.page) || undefined,
      docStatus: search.docStatus as string | undefined,
      docRole: search.docRole as string | undefined,
      docPriority: search.docPriority as string | undefined,
      docPage: Number(search.docPage) || undefined,
    };
  },
});

import { useDocumentTitle } from '@/hooks/use-document-title';

function PatientListPage() {
  useDocumentTitle('Patients');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = Route.useNavigate();
  const {
    search: searchParam,
    page: searchPage,
    docStatus,
    docRole,
    docPriority,
    docPage,
  } = Route.useSearch();

  const search = searchParam ?? '';
  const page = searchPage ?? 1;

  const [localSearch, setLocalSearch] = useState(search);

  const docStatusFilter = docStatus ?? 'needs_review';
  const docRoleFilter = docRole ?? '';
  const docPriorityFilter = docPriority ?? '';
  const documentQueuePage = docPage ?? 1;

  const setDocStatusFilter = (status: string) =>
    navigate({ search: (prev) => ({ ...prev, docStatus: status || undefined, docPage: undefined }) });
  const setDocRoleFilter = (role: string) =>
    navigate({ search: (prev) => ({ ...prev, docRole: role || undefined, docPage: undefined }) });
  const setDocPriorityFilter = (priority: string) =>
    navigate({ search: (prev) => ({ ...prev, docPriority: priority || undefined, docPage: undefined }) });
  const setDocumentQueuePage = (val: number | ((p: number) => number)) => {
    const nextPage = typeof val === 'function' ? val(documentQueuePage) : val;
    navigate({ search: (prev) => ({ ...prev, docPage: nextPage === 1 ? undefined : nextPage }) });
  };

  const [documentQueueForms, setDocumentQueueForms] = useState<
    Record<string, DocumentQueueFormState>
  >({});
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    sms_consent: false,
    email_consent: false,
    preferred_contact_channel: '',
  });
  const patientTextFields: {
    key: 'first_name' | 'last_name' | 'dob' | 'phone' | 'email';
    label: string;
    type: string;
    required?: boolean;
  }[] = [
    { key: 'first_name', label: 'First name', type: 'text', required: true },
    { key: 'last_name', label: 'Last name', type: 'text', required: true },
    { key: 'dob', label: 'Date of birth', type: 'date', required: true },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
  ];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, search, page],
    queryFn: () =>
      api.get<PatientListResponse>(
        `/patients?search=${encodeURIComponent(search)}&page=${page}&page_size=20`
      ),
  });
  const {
    data: documentQueue,
    isLoading: documentsLoading,
    isError: documentsError,
  } = useQuery({
    queryKey: [
      ...QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench'),
      docStatusFilter,
      docRoleFilter,
      docPriorityFilter,
      documentQueuePage,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(documentQueuePage), page_size: '12' });
      if (docStatusFilter) params.set('status', docStatusFilter);
      if (docRoleFilter) params.set('routed_to_role', docRoleFilter);
      if (docPriorityFilter) params.set('review_priority', docPriorityFilter);
      return api.get<PatientDocumentQueueResponse>(
        `${ROUTES.PATIENT_DOCUMENT_REVIEW_QUEUE}?${params.toString()}`
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Patient>('/patients', newPatient),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
      setShowNewPatient(false);
      setNewPatient({
        first_name: '',
        last_name: '',
        dob: '',
        gender: '',
        phone: '',
        email: '',
        sms_consent: false,
        email_consent: false,
        preferred_contact_channel: '',
      });
      toast.success(`Patient ${patient.first_name} ${patient.last_name} created successfully`);
      navigate({ to: '/patients/$patientId', params: { patientId: patient.id } });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create patient');
    },
  });
  const updateDocumentMutation = useMutation({
    mutationFn: ({
      document,
      data,
    }: {
      document: PatientDocumentQueueItem;
      data: Partial<PatientDocument>;
    }) =>
      api.patch<PatientDocument>(ROUTES.PATIENT_DOCUMENT(document.patient_id, document.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench'),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
      toast.success('Document updated successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update document');
    },
  });
  const bulkUpdateDocumentsMutation = useMutation({
    mutationFn: async ({
      documents,
      status,
    }: {
      documents: PatientDocumentQueueItem[];
      status: PatientDocument['status'];
    }) => {
      await Promise.all(
        documents.map((document) =>
          api.patch<PatientDocument>(ROUTES.PATIENT_DOCUMENT(document.patient_id, document.id), {
            status,
          })
        )
      );
    },
    onSuccess: () => {
      setSelectedDocumentIds([]);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench'),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
      toast.success('Selected documents updated successfully');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update selected documents');
    },
  });
  const processDocumentMutation = useMutation({
    mutationFn: (document: PatientDocumentQueueItem) =>
      api.post<PatientDocumentProcessResult>(
        ROUTES.PATIENT_DOCUMENT_PROCESS(document.patient_id, document.id),
        {}
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench'),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(result.document.patient_id),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(result.document.patient_id),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
      toast.success(
        result.created_task_id
          ? 'Successfully processed document and generated task'
          : 'Successfully processed document'
      );
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to process document');
    },
  });

  // Sync search query param to local state (e.g. on back navigation)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search update to URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== search) {
        navigate({
          search: (prev) => ({ ...prev, search: localSearch || undefined, page: undefined }),
        });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [localSearch, navigate, search]);

  const setPage = (val: number | ((p: number) => number)) => {
    const nextPage = typeof val === 'function' ? val(page) : val;
    navigate({ search: (prev) => ({ ...prev, page: nextPage === 1 ? undefined : nextPage }) });
  };
  const formForDocument = (document: PatientDocumentQueueItem): DocumentQueueFormState =>
    documentQueueForms[document.id] ?? {
      status: document.status,
      routed_to_role: document.routed_to_role ?? '',
      review_priority: document.review_priority ?? 'normal',
      reviewed_by: document.reviewed_by ?? '',
      review_note: document.review_note ?? '',
    };
  const updateDocumentForm = (
    document: PatientDocumentQueueItem,
    patch: Partial<DocumentQueueFormState>
  ) => {
    setDocumentQueueForms((current) => ({
      ...current,
      [document.id]: { ...formForDocument(document), ...patch },
    }));
  };
  const submitDocument = (
    document: PatientDocumentQueueItem,
    statusOverride?: PatientDocument['status']
  ) => {
    const form = formForDocument(document);
    updateDocumentMutation.mutate({
      document,
      data: {
        status: statusOverride ?? form.status,
        routed_to_role: form.routed_to_role.trim() || null,
        review_priority: form.review_priority || 'normal',
        reviewed_by: form.reviewed_by.trim() || null,
        review_note: form.review_note.trim() || null,
      },
    });
  };
  const documentRows = documentQueue?.data ?? [];
  const selectedDocuments = documentRows.filter((document) =>
    selectedDocumentIds.includes(document.id)
  );
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  };

  return (
    <div className="space-y-5">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-display text-ink">Patients</h1>
        <Button onClick={() => setShowNewPatient(true)} icon={Plus}>
          New Patient
        </Button>
      </div>

      <ErrorBoundary title="Document Intake Workbench Error">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border">
          <div>
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <FolderOpen className="h-4 w-4 text-accent" />
              Document Intake Workbench
            </h2>
            <p className="text-micro text-ink-muted mt-0.5">
              {documentQueue?.total ?? 0} outside record(s) match the current filters
            </p>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-3">
            <select
              value={docStatusFilter}
              onChange={(event) => setDocStatusFilter(event.target.value)}
              className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            >
              <option value="needs_review">Needs review</option>
              <option value="received">Received</option>
              <option value="filed">Filed</option>
              <option value="reconciled">Reconciled</option>
              <option value="rejected">Rejected</option>
              <option value="">All statuses</option>
            </select>
            <select
              value={docRoleFilter}
              onChange={(event) => setDocRoleFilter(event.target.value)}
              className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            >
              <option value="">All roles</option>
              <option value="front_desk">Front desk</option>
              <option value="ma_nurse">MA/nurse</option>
              <option value="provider">Provider</option>
              <option value="care_coordinator">Care coordinator</option>
              <option value="billing">Billing</option>
            </select>
            <select
              value={docPriorityFilter}
              onChange={(event) => setDocPriorityFilter(event.target.value)}
              className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
        {selectedDocumentIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-canvas-sunk px-4 py-2 border-b border-border">
            <div className="text-micro font-medium text-ink-muted">
              {selectedDocumentIds.length} selected
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  bulkUpdateDocumentsMutation.mutate({
                    documents: selectedDocuments,
                    status: 'filed',
                  })
                }
                disabled={bulkUpdateDocumentsMutation.isPending || selectedDocuments.length === 0}
              >
                File selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  bulkUpdateDocumentsMutation.mutate({
                    documents: selectedDocuments,
                    status: 'reconciled',
                  })
                }
                disabled={bulkUpdateDocumentsMutation.isPending || selectedDocuments.length === 0}
              >
                Reconcile selected
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDocumentIds([])}>
                Clear
              </Button>
            </div>
          </div>
        )}
        <div className="divide-y divide-border">
          {documentsLoading && (
            <div className="px-4 py-6 text-small text-ink-muted">Loading document queue...</div>
          )}
          {documentsError && (
            <div className="px-4 py-6 text-small text-danger">Unable to load document queue.</div>
          )}
          {!documentsLoading && !documentsError && documentRows.length === 0 && (
            <div className="px-4 py-6 text-small text-ink-muted">
              No outside documents match these filters.
            </div>
          )}
          {!documentsLoading &&
            !documentsError &&
            documentRows.map((document) => {
              const form = formForDocument(document);
              return (
                <div
                  key={document.id}
                  className="flex flex-col gap-2 px-4 py-3.5 border-b border-border-subtle hover:bg-canvas-raised/40 transition-colors duration-150"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedDocumentIds.includes(document.id)}
                        onChange={() => toggleDocumentSelection(document.id)}
                        className="h-4 w-4 rounded border-border text-accent"
                        aria-label={`Select ${document.title}`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          navigate({
                            to: '/patients/$patientId',
                            params: { patientId: document.patient_id },
                          })
                        }
                        className="text-left text-small font-medium text-ink hover:text-accent transition-colors"
                      >
                        {document.title}
                      </button>
                      <Badge
                        intent={
                          document.review_priority === 'urgent'
                            ? 'danger'
                            : document.review_priority === 'high'
                              ? 'warn'
                              : 'muted'
                        }
                      >
                        {document.review_priority}
                      </Badge>
                      <Badge intent="muted">{document.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-micro text-ink-muted">
                      <span>
                        {document.patient_name} · {document.patient_mrn}
                      </span>
                      <span>{document.source}</span>
                      <span>{document.source_reference ?? 'No reference'}</span>
                      <span>{document.routed_to_role ?? 'Unrouted'}</span>
                      {document.source_contact && <span>{document.source_contact}</span>}
                    </div>
                    {document.summary && (
                      <div className="mt-1 text-micro text-ink-secondary">{document.summary}</div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-col gap-2 bg-canvas-sunk/30 p-3 rounded-md border border-border-subtle">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={form.status}
                        onChange={(event) =>
                          updateDocumentForm(document, {
                            status: event.target.value as PatientDocument['status'],
                          })
                        }
                        className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-small text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      >
                        <option value="received">Received</option>
                        <option value="needs_review">Needs review</option>
                        <option value="filed">Filed</option>
                        <option value="reconciled">Reconciled</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <input
                        value={form.routed_to_role}
                        onChange={(event) =>
                          updateDocumentForm(document, { routed_to_role: event.target.value })
                        }
                        placeholder="Route to role"
                        className="w-36 bg-canvas border border-border rounded-sm px-2 py-1.5 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      />
                      <select
                        value={form.review_priority}
                        onChange={(event) =>
                          updateDocumentForm(document, { review_priority: event.target.value })
                        }
                        className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-small text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High priority</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <input
                        value={form.reviewed_by}
                        onChange={(event) =>
                          updateDocumentForm(document, { reviewed_by: event.target.value })
                        }
                        placeholder="Reviewed by"
                        className="w-36 bg-canvas border border-border rounded-sm px-2 py-1.5 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={form.review_note}
                        onChange={(event) =>
                          updateDocumentForm(document, { review_note: event.target.value })
                        }
                        placeholder="Review note (optional)"
                        className="flex-1 min-w-[16rem] bg-canvas border border-border rounded-sm px-2 py-1.5 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                      />
                      <div className="action-group">
                        {(() => {
                          const isUpdatingThisDoc =
                            updateDocumentMutation.isPending &&
                            updateDocumentMutation.variables?.document.id === document.id;
                          const isProcessingThisDoc =
                            processDocumentMutation.isPending &&
                            processDocumentMutation.variables?.id === document.id;
                          return (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => submitDocument(document)}
                                loading={
                                  isUpdatingThisDoc &&
                                  updateDocumentMutation.variables?.data.status !== 'filed'
                                }
                                disabled={updateDocumentMutation.isPending}
                              >
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={Check}
                                onClick={() => submitDocument(document, 'filed')}
                                loading={
                                  isUpdatingThisDoc &&
                                  updateDocumentMutation.variables?.data.status === 'filed'
                                }
                                disabled={updateDocumentMutation.isPending}
                              >
                                File
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={FileText}
                                onClick={() => processDocumentMutation.mutate(document)}
                                loading={isProcessingThisDoc}
                                disabled={processDocumentMutation.isPending}
                              >
                                Task
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          {!documentsLoading && !documentsError && documentQueue && documentQueue.total > 0 && (
            <div className="flex items-center justify-between text-small text-ink-muted mt-3 px-4 py-2 border-t border-border bg-canvas-sunk/10">
              <span>
                Showing {(documentQueue.page - 1) * documentQueue.page_size + 1}–
                {Math.min(documentQueue.page * documentQueue.page_size, documentQueue.total)} of {documentQueue.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDocumentQueuePage((p) => Math.max(1, p - 1))}
                  disabled={documentQueuePage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDocumentQueuePage((p) => p + 1)}
                  disabled={documentQueuePage * documentQueue.page_size >= documentQueue.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
      </ErrorBoundary>

      <ErrorBoundary title="Patients Directory Error">
      <div className="mb-4">
        <Input
          variant="search"
          value={localSearch}
          onChange={(e) => {
            setLocalSearch(e.target.value);
          }}
          placeholder="Search by name or MRN..."
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading patients" />
      ) : isError ? (
        <ErrorState
          title="Unable to load patients"
          detail={error instanceof Error ? error.message : 'The patient list could not be loaded.'}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-canvas-sunk border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    MRN
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    DOB
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() =>
                      navigate({ to: '/patients/$patientId', params: { patientId: patient.id } })
                    }
                    className="cursor-pointer border-b border-border-subtle hover:bg-canvas-sunk/50 transition-colors duration-150"
                  >
                    <td className="px-4 py-3 font-mono text-micro text-ink-muted">{patient.mrn}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {patient.last_name}, {patient.first_name}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{patient.dob}</td>
                    <td className="px-4 py-3 text-ink-muted">{patient.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge intent={patient.is_active ? 'success' : 'muted'}>
                        {patient.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No patients found"
                        detail={
                          search
                            ? 'Try a different name, MRN, phone, or email search.'
                            : 'Create a patient or seed the pilot workspace so the clinic team has real chart context.'
                        }
                        action={
                          search ? undefined : (
                            <div className="flex flex-wrap justify-center gap-2">
                              <Button onClick={() => setShowNewPatient(true)}>
                                Create patient
                              </Button>
                              <Link
                                to="/setup"
                                className="inline-flex items-center justify-center gap-2 border border-border bg-canvas-raised text-ink-secondary rounded-md px-4 py-2 text-sm font-medium hover:border-border-strong hover:bg-canvas-sunk"
                              >
                                Seed demo data
                              </Link>
                            </div>
                          )
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > 0 && (
            <div className="flex items-center justify-between text-small text-ink-muted mt-4">
              <span>
                Showing {(data.page - 1) * data.page_size + 1}–
                {Math.min(data.page * data.page_size, data.total)} of {data.total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * data.page_size >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      </ErrorBoundary>

      {showNewPatient && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg bg-canvas-raised border border-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="flex items-start justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-subhead font-medium text-ink">New Patient</h2>
                <p className="mt-1 text-micro text-ink-muted">
                  Required fields are marked with *. Consent controls protect outreach before any
                  message is sent.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewPatient(false)}
                className="rounded-md p-1 text-ink-muted hover:text-ink hover:bg-canvas-sunk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {patientTextFields.map(({ key, label, type, required }) => (
                <label key={key} className="text-small font-medium text-ink-secondary">
                  {label}
                  {required && <span className="ml-1 text-danger">*</span>}
                  <input
                    type={type}
                    required={required}
                    value={newPatient[key]}
                    onChange={(event) =>
                      setNewPatient({ ...newPatient, [key]: event.target.value })
                    }
                    className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                  />
                </label>
              ))}
              <label className="text-small font-medium text-ink-secondary">
                Preferred outreach
                <select
                  value={newPatient.preferred_contact_channel}
                  onChange={(event) =>
                    setNewPatient({ ...newPatient, preferred_contact_channel: event.target.value })
                  }
                  className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink"
                >
                  <option value="">None selected</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-small font-medium text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={newPatient.sms_consent}
                    onChange={(event) =>
                      setNewPatient({ ...newPatient, sms_consent: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-border text-accent"
                  />
                  SMS consent
                </label>
                <label className="inline-flex items-center gap-2 text-small font-medium text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={newPatient.email_consent}
                    onChange={(event) =>
                      setNewPatient({ ...newPatient, email_consent: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-border text-accent"
                  />
                  Email consent
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => setShowNewPatient(false)}>
                Cancel
              </Button>
              <Button disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create patient'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
