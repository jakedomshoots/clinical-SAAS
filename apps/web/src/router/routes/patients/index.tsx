import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { ROUTES, type Patient, type PatientDocument, type PatientDocumentProcessResult, type PatientDocumentQueueItem, type PatientDocumentQueueResponse } from '@concierge-os/shared';
import { Check, FileText, FolderOpen, Search, Plus, X } from 'lucide-react';

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

export const Route = createFileRoute('/patients/')({
  component: PatientListPage,
});

function PatientListPage() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [documentFilters, setDocumentFilters] = useState({ status: 'needs_review', routed_to_role: '', review_priority: '' });
  const [documentQueueForms, setDocumentQueueForms] = useState<Record<string, DocumentQueueFormState>>({});
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
  const patientTextFields: { key: 'first_name' | 'last_name' | 'dob' | 'gender' | 'phone' | 'email'; label: string; type: string }[] = [
    { key: 'first_name', label: 'First name', type: 'text' },
    { key: 'last_name', label: 'Last name', type: 'text' },
    { key: 'dob', label: 'Date of birth', type: 'date' },
    { key: 'gender', label: 'Gender', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
  ];

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, search, page],
    queryFn: () => api.get<PatientListResponse>(`/patients?search=${encodeURIComponent(search)}&page=${page}&page_size=20`),
  });
  const { data: documentQueue, isLoading: documentsLoading, isError: documentsError } = useQuery({
    queryKey: [
      ...QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench'),
      documentFilters.status,
      documentFilters.routed_to_role,
      documentFilters.review_priority,
    ],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', page_size: '12' });
      if (documentFilters.status) params.set('status', documentFilters.status);
      if (documentFilters.routed_to_role) params.set('routed_to_role', documentFilters.routed_to_role);
      if (documentFilters.review_priority) params.set('review_priority', documentFilters.review_priority);
      return api.get<PatientDocumentQueueResponse>(`${ROUTES.PATIENT_DOCUMENT_REVIEW_QUEUE}?${params.toString()}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Patient>('/patients', newPatient),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
      setShowNewPatient(false);
      setNewPatient({ first_name: '', last_name: '', dob: '', gender: '', phone: '', email: '', sms_consent: false, email_consent: false, preferred_contact_channel: '' });
      navigate({ to: '/patients/$patientId', params: { patientId: patient.id } });
    },
  });
  const updateDocumentMutation = useMutation({
    mutationFn: ({ document, data }: { document: PatientDocumentQueueItem; data: Partial<PatientDocument> }) =>
      api.patch<PatientDocument>(ROUTES.PATIENT_DOCUMENT(document.patient_id, document.id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const bulkUpdateDocumentsMutation = useMutation({
    mutationFn: async ({ documents, status }: { documents: PatientDocumentQueueItem[]; status: PatientDocument['status'] }) => {
      await Promise.all(documents.map((document) => api.patch<PatientDocument>(
        ROUTES.PATIENT_DOCUMENT(document.patient_id, document.id),
        { status },
      )));
    },
    onSuccess: () => {
      setSelectedDocumentIds([]);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const processDocumentMutation = useMutation({
    mutationFn: (document: PatientDocumentQueueItem) =>
      api.post<PatientDocumentProcessResult>(ROUTES.PATIENT_DOCUMENT_PROCESS(document.patient_id, document.id), {}),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS('review-queue-workbench') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(result.document.patient_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(result.document.patient_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
  });
  const formForDocument = (document: PatientDocumentQueueItem): DocumentQueueFormState => documentQueueForms[document.id] ?? {
    status: document.status,
    routed_to_role: document.routed_to_role ?? '',
    review_priority: document.review_priority ?? 'normal',
    reviewed_by: document.reviewed_by ?? '',
    review_note: document.review_note ?? '',
  };
  const updateDocumentForm = (document: PatientDocumentQueueItem, patch: Partial<DocumentQueueFormState>) => {
    setDocumentQueueForms((current) => ({
      ...current,
      [document.id]: { ...formForDocument(document), ...patch },
    }));
  };
  const submitDocument = (document: PatientDocumentQueueItem, statusOverride?: PatientDocument['status']) => {
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
  const selectedDocuments = documentRows.filter((document) => selectedDocumentIds.includes(document.id));
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocumentIds((current) => current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId]);
  };

  return (
    <div className="space-y-5">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Patients</h1>
        <button onClick={() => setShowNewPatient(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          <Plus className="h-4 w-4" />
          New Patient
        </button>
      </div>

      <section className="rounded-md border border-clinic-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
              <FolderOpen className="h-4 w-4 text-accent-700" />
              Document Intake Workbench
            </h2>
            <p className="text-xs text-clinic-500">{documentQueue?.total ?? 0} outside record(s) match the current filters</p>
          </div>
          <div className="grid w-full gap-2 md:w-auto md:grid-cols-3">
            <select
              value={documentFilters.status}
              onChange={(event) => setDocumentFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
            >
              <option value="needs_review">Needs review</option>
              <option value="received">Received</option>
              <option value="filed">Filed</option>
              <option value="reconciled">Reconciled</option>
              <option value="rejected">Rejected</option>
              <option value="">All statuses</option>
            </select>
            <select
              value={documentFilters.routed_to_role}
              onChange={(event) => setDocumentFilters((current) => ({ ...current, routed_to_role: event.target.value }))}
              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
            >
              <option value="">All roles</option>
              <option value="front_desk">Front desk</option>
              <option value="ma_nurse">MA/nurse</option>
              <option value="provider">Provider</option>
              <option value="care_coordinator">Care coordinator</option>
              <option value="billing">Billing</option>
            </select>
            <select
              value={documentFilters.review_priority}
              onChange={(event) => setDocumentFilters((current) => ({ ...current, review_priority: event.target.value }))}
              className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
            >
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
        {selectedDocumentIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clinic-100 bg-clinic-50 px-4 py-2">
            <div className="text-xs font-medium text-clinic-600">{selectedDocumentIds.length} selected</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => bulkUpdateDocumentsMutation.mutate({ documents: selectedDocuments, status: 'filed' })}
                disabled={bulkUpdateDocumentsMutation.isPending || selectedDocuments.length === 0}
                className="rounded-md border border-accent-200 bg-accent-50 px-3 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 disabled:opacity-60"
              >
                File selected
              </button>
              <button
                type="button"
                onClick={() => bulkUpdateDocumentsMutation.mutate({ documents: selectedDocuments, status: 'reconciled' })}
                disabled={bulkUpdateDocumentsMutation.isPending || selectedDocuments.length === 0}
                className="rounded-md border border-clinic-300 bg-white px-3 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
              >
                Reconcile selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedDocumentIds([])}
                className="rounded-md border border-clinic-300 bg-white px-3 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="divide-y divide-clinic-100">
          {documentsLoading && <div className="px-4 py-6 text-sm text-clinic-500">Loading document queue...</div>}
          {documentsError && <div className="px-4 py-6 text-sm text-red-700">Unable to load document queue.</div>}
          {!documentsLoading && !documentsError && documentRows.length === 0 && (
            <div className="px-4 py-6 text-sm text-clinic-500">No outside documents match these filters.</div>
          )}
          {!documentsLoading && !documentsError && documentRows.map((document) => {
            const form = formForDocument(document);
            return (
              <div key={document.id} className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_32rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(document.id)}
                      onChange={() => toggleDocumentSelection(document.id)}
                      className="h-4 w-4 rounded border-clinic-300 text-accent-600"
                      aria-label={`Select ${document.title}`}
                    />
                    <button
                      type="button"
                      onClick={() => navigate({ to: '/patients/$patientId', params: { patientId: document.patient_id } })}
                      className="text-left text-sm font-semibold text-clinic-900 hover:text-accent-700"
                    >
                      {document.title}
                    </button>
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${document.review_priority === 'urgent' ? 'border-red-200 bg-red-50 text-red-700' : document.review_priority === 'high' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-clinic-200 bg-clinic-50 text-clinic-600'}`}>
                      {document.review_priority}
                    </span>
                    <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-0.5 text-[11px] font-medium text-clinic-600">{document.status.replace('_', ' ')}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-clinic-500">
                    <span>{document.patient_name} · {document.patient_mrn}</span>
                    <span>{document.source}</span>
                    <span>{document.source_reference ?? 'No reference'}</span>
                    <span>{document.routed_to_role ?? 'Unrouted'}</span>
                    {document.source_contact && <span>{document.source_contact}</span>}
                  </div>
                  {document.summary && <div className="mt-1 text-xs text-clinic-600">{document.summary}</div>}
                </div>
                <div className="grid gap-2 md:grid-cols-[8.5rem_8.5rem_7.5rem_8rem_minmax(0,1fr)_13rem]">
                  <select
                    value={form.status}
                    onChange={(event) => updateDocumentForm(document, { status: event.target.value as PatientDocument['status'] })}
                    className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  >
                    <option value="received">Received</option>
                    <option value="needs_review">Needs review</option>
                    <option value="filed">Filed</option>
                    <option value="reconciled">Reconciled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <input
                    value={form.routed_to_role}
                    onChange={(event) => updateDocumentForm(document, { routed_to_role: event.target.value })}
                    placeholder="Route"
                    className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  />
                  <select
                    value={form.review_priority}
                    onChange={(event) => updateDocumentForm(document, { review_priority: event.target.value })}
                    className="rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input
                    value={form.reviewed_by}
                    onChange={(event) => updateDocumentForm(document, { reviewed_by: event.target.value })}
                    placeholder="Reviewer"
                    className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  />
                  <input
                    value={form.review_note}
                    onChange={(event) => updateDocumentForm(document, { review_note: event.target.value })}
                    placeholder="Review note"
                    className="min-w-0 rounded-md border border-clinic-200 px-2 py-1.5 text-xs focus:border-accent-500 focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => submitDocument(document)}
                      disabled={updateDocumentMutation.isPending}
                      className="rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDocument(document, 'filed')}
                      disabled={updateDocumentMutation.isPending}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1.5 text-xs font-medium text-accent-700 hover:bg-accent-100 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      File
                    </button>
                    <button
                      type="button"
                      onClick={() => processDocumentMutation.mutate(document)}
                      disabled={processDocumentMutation.isPending}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-clinic-300 px-2 py-1.5 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Task
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-clinic-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or MRN..."
          className="w-full rounded-lg border border-clinic-300 py-2 pl-9 pr-3 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Loading patients" />
      ) : isError ? (
        <ErrorState title="Unable to load patients" detail={error instanceof Error ? error.message : 'The patient list could not be loaded.'} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-clinic-200 bg-white">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-clinic-200 bg-clinic-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">MRN</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">DOB</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => navigate({ to: '/patients/$patientId', params: { patientId: patient.id } })}
                    className="cursor-pointer border-b border-clinic-100 transition-colors hover:bg-clinic-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-clinic-500">{patient.mrn}</td>
                    <td className="px-4 py-3 font-medium text-clinic-800">{patient.last_name}, {patient.first_name}</td>
                    <td className="px-4 py-3 text-clinic-600">{patient.dob}</td>
                    <td className="px-4 py-3 text-clinic-600">{patient.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${patient.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-clinic-100 text-clinic-500'}`}>
                        {patient.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        title="No patients found"
                        detail={search ? 'Try a different name, MRN, phone, or email search.' : 'Create a patient to start building the clinic chart surface.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-clinic-500">
              <span>Showing {((data.page - 1) * data.page_size) + 1}–{Math.min(data.page * data.page_size, data.total)} of {data.total}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-clinic-300 px-3 py-1.5 text-sm transition-colors hover:bg-clinic-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * data.page_size >= data.total}
                  className="rounded-md border border-clinic-300 px-3 py-1.5 text-sm transition-colors hover:bg-clinic-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showNewPatient && (
        <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg rounded-md border border-clinic-300 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-900">New Patient</h2>
              <button type="button" onClick={() => setShowNewPatient(false)} className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {patientTextFields.map(({ key, label, type }) => (
                <label key={key} className="text-sm font-medium text-clinic-700">
                  {label}
                  <input
                    type={type}
                    required={['first_name', 'last_name', 'dob', 'gender'].includes(key)}
                    value={newPatient[key]}
                    onChange={(event) => setNewPatient({ ...newPatient, [key]: event.target.value })}
                    className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </label>
              ))}
              <label className="text-sm font-medium text-clinic-700">
                Preferred outreach
                <select
                  value={newPatient.preferred_contact_channel}
                  onChange={(event) => setNewPatient({ ...newPatient, preferred_contact_channel: event.target.value })}
                  className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900"
                >
                  <option value="">None selected</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-clinic-700">
                  <input type="checkbox" checked={newPatient.sms_consent} onChange={(event) => setNewPatient({ ...newPatient, sms_consent: event.target.checked })} className="h-4 w-4 rounded border-clinic-300 text-accent-600" />
                  SMS consent
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-clinic-700">
                  <input type="checkbox" checked={newPatient.email_consent} onChange={(event) => setNewPatient({ ...newPatient, email_consent: event.target.checked })} className="h-4 w-4 rounded border-clinic-300 text-accent-600" />
                  Email consent
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setShowNewPatient(false)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">Cancel</button>
              <button disabled={createMutation.isPending} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create patient'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
