import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared'
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Appointment, AppointmentStatus, Patient, PatientCarePlanItem, PatientCarePlanListResponse, PatientChartSummary, PatientCheckoutHandoff, PatientDocument, PatientDocumentAccess, PatientDocumentListResponse, PatientEncounter, PatientEncounterListResponse, PatientLabResult, PatientLabResultListResponse, PatientMedication, PatientMedicationListResponse, PatientUpdate, Task } from '@concierge-os/shared';
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Building2,
  CalendarClock,
  Heart,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  MessageSquare,
  Pill,
  ShieldCheck,
  Stethoscope,
  TestTube2,
} from 'lucide-react';

export const Route = createFileRoute('/patients/$patientId')({
  component: PatientChartPage,
});

type Tab = 'summary' | 'demographics' | 'documents' | 'medications' | 'care-plan' | 'encounters' | 'labs' | 'tasks' | 'messages';
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'documents', label: 'Documents' },
  { key: 'medications', label: 'Meds' },
  { key: 'care-plan', label: 'Care Plan' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'labs', label: 'Labs' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'messages', label: 'Messages' },
];

const patientMessages = [
  { from: 'Mary Collins', at: '11:18 AM', subject: 'Lab result question', body: 'I saw a lab alert in the portal. Should I change anything before my visit?' },
  { from: 'Clinic Admin', at: '11:44 AM', subject: 'Lab result question', body: 'We received it and the provider is reviewing. We will call you this afternoon.' },
];

function PatientChartPage() {
  const { patientId } = Route.useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [documentAccessMessage, setDocumentAccessMessage] = useState<string | null>(null);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const { data: patient, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.PATIENT(patientId),
    queryFn: () => api.get<Patient>(ROUTES.PATIENT(patientId)),
  });

  const { data: documentList, isLoading: documentsLoading, isError: documentsError } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(patientId),
    queryFn: () => api.get<PatientDocumentListResponse>(ROUTES.PATIENT_DOCUMENTS(patientId)),
  });

  const { data: chartSummary } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId),
    queryFn: () => api.get<PatientChartSummary>(ROUTES.PATIENT_CHART_SUMMARY(patientId)),
  });

  const { data: checkoutHandoff } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId),
    queryFn: () => api.get<PatientCheckoutHandoff>(ROUTES.PATIENT_CHECKOUT_HANDOFF(patientId)),
  });

  const { data: medicationList } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_MEDICATIONS(patientId),
    queryFn: () => api.get<PatientMedicationListResponse>(ROUTES.PATIENT_MEDICATIONS(patientId)),
  });

  const { data: carePlanList } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_CARE_PLAN(patientId),
    queryFn: () => api.get<PatientCarePlanListResponse>(ROUTES.PATIENT_CARE_PLAN(patientId)),
  });

  const { data: labList } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_LABS(patientId),
    queryFn: () => api.get<PatientLabResultListResponse>(ROUTES.PATIENT_LABS(patientId)),
  });

  const { data: encounterList } = useQuery({
    queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId),
    queryFn: () => api.get<PatientEncounterListResponse>(ROUTES.PATIENT_ENCOUNTERS(patientId)),
  });

  const documentRows = documentList?.data ?? [];
  const medicationRows = medicationList?.data ?? [];
  const carePlanItems = carePlanList?.data ?? [];
  const labRows = labList?.data ?? [];
  const encounterRows = encounterList?.data ?? [];
  const documentsNeedingReview = documentRows.filter((document) => document.status === 'needs_review').length;
  const openTasks = chartSummary?.open_tasks ?? [];
  const blockers = chartSummary?.blockers ?? [];

  const updateMutation = useMutation({
    mutationFn: (data: PatientUpdate) => api.patch<Patient>(ROUTES.PATIENT(patientId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT(patientId) });
      setEditing(false);
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ documentId, status }: { documentId: string; status: PatientDocument['status'] }) =>
      api.patch<PatientDocument>(ROUTES.PATIENT_DOCUMENT(patientId, documentId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const documentAccessMutation = useMutation({
    mutationFn: (documentId: string) =>
      api.get<PatientDocumentAccess>(ROUTES.PATIENT_DOCUMENT_ACCESS(patientId, documentId)),
    onSuccess: (access) => {
      if (access.available && access.url) {
        window.open(access.url, '_blank', 'noopener,noreferrer');
        setDocumentAccessMessage(`Document access expires at ${access.expires_at ?? 'the configured expiry time'}.`);
      } else {
        setDocumentAccessMessage(access.reason ?? 'This document is not available for viewing yet.');
      }
    },
  });

  const updateMedicationMutation = useMutation({
    mutationFn: ({ medicationId, status }: { medicationId: string; status: PatientMedication['status'] }) =>
      api.patch<PatientMedication>(ROUTES.PATIENT_MEDICATION(patientId, medicationId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_MEDICATIONS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const updateCarePlanMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: PatientCarePlanItem['status'] }) =>
      api.patch<PatientCarePlanItem>(ROUTES.PATIENT_CARE_PLAN_ITEM(patientId, itemId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CARE_PLAN(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const updateLabMutation = useMutation({
    mutationFn: ({ labId, status }: { labId: string; status: PatientLabResult['status'] }) =>
      api.patch<PatientLabResult>(ROUTES.PATIENT_LAB(patientId, labId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_LABS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const updateEncounterMutation = useMutation({
    mutationFn: ({ encounterId, status }: { encounterId: string; status: PatientEncounter['status'] }) =>
      api.patch<PatientEncounter>(ROUTES.PATIENT_ENCOUNTER(patientId, encounterId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const createHandoffTaskMutation = useMutation({
    mutationFn: ({ sourceType, sourceId }: { sourceType: string; sourceId: string }) =>
      api.post<Task>(ROUTES.PATIENT_CHECKOUT_HANDOFF_TASKS(patientId), {
        source_type: sourceType,
        source_id: sourceId,
        priority: 'high',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
    },
  });

  const completeCheckoutMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      api.patch<Appointment>(`/schedule/appointments/${appointmentId}`, { status: 'completed' satisfies AppointmentStatus }),
    onSuccess: () => {
      setCheckoutError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPOINTMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TODAY_QUEUE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
    onError: (mutationError) => {
      setCheckoutError(mutationError instanceof Error ? mutationError.message : 'Checkout could not be completed.');
    },
  });

  function startEditing() {
    if (!patient) return;
    setEditForm({
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone || '',
      email: patient.email || '',
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
    });
  }

  if (isLoading) {
    return <LoadingState label="Loading patient chart" />;
  }

  if (isError) {
    return <ErrorState title="Unable to load patient chart" detail={error instanceof Error ? error.message : 'The patient chart could not be loaded.'} />;
  }

  if (!patient) {
    return <EmptyState title="Patient not found" detail="The selected chart is not available in the current frontend data set." />;
  }

  return (
    <div>
      <button
        onClick={() => navigate({ to: '/patients' })}
        className="mb-4 flex items-center gap-2 text-sm text-clinic-500 hover:text-clinic-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patients
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-clinic-800">
            {patient.last_name}, {patient.first_name}
          </h1>
          <p className="mt-1 flex items-center gap-3 text-sm text-clinic-500">
            <span className="font-mono text-xs">{patient.mrn}</span>
            <span>{patient.dob}</span>
            <span>{patient.gender}</span>
          </p>
        </div>
        <button
          onClick={() => setHandoffOpen(true)}
          className="flex items-center gap-2 rounded-md bg-clinic-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-clinic-700"
        >
          <ShieldCheck className="h-4 w-4" />
          Checkout Handoff
        </button>
        {activeTab === 'demographics' && !editing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 rounded-md border border-clinic-300 px-3 py-1.5 text-sm text-clinic-600 hover:bg-clinic-100"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-clinic-200">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setEditing(false); }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-accent-600 text-accent-700'
                : 'text-clinic-500 hover:text-clinic-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-5">
          <section className="grid gap-3 lg:grid-cols-4">
            {[
              { label: 'Visit state', value: 'Checkout prep', detail: 'Provider review pending', icon: Stethoscope, tone: 'text-accent-700' },
              { label: 'Documents', value: String(chartSummary?.counts.documents_total ?? documentRows.length), detail: `${chartSummary?.counts.documents_needing_review ?? documentsNeedingReview} needs review`, icon: FolderOpen, tone: 'text-amber-700' },
              { label: 'Open tasks', value: String(chartSummary?.counts.open_tasks ?? openTasks.length), detail: `${chartSummary?.counts.urgent_tasks ?? 0} urgent`, icon: ClipboardList, tone: 'text-red-700' },
              { label: 'Care plan', value: String(carePlanItems.length), detail: `${chartSummary?.counts.unsigned_encounters ?? 0} unsigned notes`, icon: ShieldCheck, tone: 'text-clinic-700' },
            ].map(({ label, value, detail, icon: Icon, tone }) => (
              <div key={label} className="rounded-md border border-clinic-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-clinic-500">{label}</span>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <div className="mt-3 text-2xl font-semibold text-clinic-900">{value}</div>
                <div className="mt-1 text-sm text-clinic-500">{detail}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-md border border-clinic-200 bg-white">
              <div className="border-b border-clinic-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-clinic-800">Checkout Handoff</h2>
                <p className="text-xs text-clinic-500">What the care team needs before this patient leaves</p>
              </div>
              <div className="divide-y divide-clinic-100">
                {carePlanItems.map((item) => (
                  <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[7rem_1fr_7rem_7rem]">
                    <div className="text-sm font-medium text-clinic-700">
                      {item.assigned_to_name ?? item.owner_role}
                      {item.escalation && <div className="mt-0.5 text-xs text-red-700">{formatClinicalStatus(item.escalation)}</div>}
                    </div>
                    <div className="text-sm text-clinic-800">{item.item}</div>
                    <div className="text-sm text-clinic-500">{item.due ?? 'No due date'}</div>
                    <div className="text-sm font-medium text-clinic-700">{formatClinicalStatus(item.status)}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-md border border-clinic-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-clinic-800">Clinical Flags</h2>
              <div className="mt-3 space-y-3 text-sm">
                {blockers.length > 0 ? blockers.map((blocker) => (
                  <div key={blocker} className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
                    {blocker}
                  </div>
                )) : (
                  <div className="rounded-md border border-clinic-200 bg-clinic-50 p-3 text-clinic-700">
                    No chart blockers are currently reported.
                  </div>
                )}
              </div>
            </aside>
          </section>
        </div>
      )}

      {activeTab === 'demographics' && (
        <div className="rounded-lg border border-clinic-200 bg-white p-6">
          {editing ? (
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-clinic-700">First Name</label>
                <input
                  type="text"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-clinic-700">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-clinic-700">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-clinic-700">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {updateMutation.isPending ? 'Saving' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-2 rounded-md border border-clinic-300 px-4 py-2 text-sm text-clinic-600 hover:bg-clinic-100"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 max-w-lg text-sm">
              {[
                { icon: Phone, label: 'Phone', value: patient.phone || '—' },
                { icon: Mail, label: 'Email', value: patient.email || '—' },
                { icon: MapPin, label: 'Address', value: patient.address ? `${patient.address.street}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}` : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-clinic-400" />
                  <div>
                    <dt className="font-medium text-clinic-500">{label}</dt>
                    <dd className="mt-0.5 text-clinic-800">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-6 border-t border-clinic-200 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-clinic-700">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Allergies
              </h3>
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((a, i) => (
                  <span key={i} className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
                    {a.substance} — {a.reaction}
                  </span>
                ))}
              </div>
            </div>
          )}

          {patient.problem_list && patient.problem_list.length > 0 && (
            <div className="mt-4 border-t border-clinic-200 pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-clinic-700">
                <Heart className="h-4 w-4 text-red-400" />
                Problem List
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-clinic-600">
                {patient.problem_list.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'encounters' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <FileText className="h-4 w-4 text-accent-700" />
              Encounter Timeline
            </h2>
          </div>
          <div className="divide-y divide-clinic-100">
            {encounterRows.map((encounter) => (
              <div key={encounter.id} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_14rem]">
                <div className="font-mono text-xs text-clinic-500">{formatDateOnly(encounter.created_at)}</div>
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{encounter.encounter_type}</div>
                  <div className="mt-1 text-sm text-clinic-600">{encounter.summary ?? 'No summary entered.'}</div>
                  <div className="mt-1 text-xs text-clinic-500">{encounter.provider_name ?? 'No provider assigned'}</div>
                  {(encounter.assessment || encounter.plan) && (
                    <div className="mt-2 grid gap-2 text-xs text-clinic-600 md:grid-cols-2">
                      {encounter.assessment && <div><span className="font-semibold text-clinic-700">Assessment:</span> {encounter.assessment}</div>}
                      {encounter.plan && <div><span className="font-semibold text-clinic-700">Plan:</span> {encounter.plan}</div>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  <span className="inline-flex rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">
                    {formatClinicalStatus(encounter.status)}
                  </span>
                  {encounter.status === 'provider_review' && (
                    <button
                      onClick={() => updateEncounterMutation.mutate({ encounterId: encounter.id, status: 'signed' })}
                      className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                    >
                      Sign
                    </button>
                  )}
                </div>
              </div>
            ))}
            {encounterRows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-clinic-400">No encounters have been added to this chart.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <FolderOpen className="h-4 w-4 text-accent-700" />
              Outside Documents
            </h2>
            <p className="mt-1 text-xs text-clinic-500">Faxed, scanned, and imported records from outside offices</p>
          </div>
          <div className="divide-y divide-clinic-100">
            {documentAccessMessage && (
              <div className="border-b border-accent-100 bg-accent-50 px-4 py-2 text-sm text-accent-800">
                {documentAccessMessage}
              </div>
            )}
            {documentsLoading && (
              <div className="px-4 py-6 text-sm text-clinic-500">Loading outside documents...</div>
            )}
            {documentsError && (
              <div className="px-4 py-6 text-sm text-red-700">Unable to load outside documents.</div>
            )}
            {!documentsLoading && !documentsError && documentRows.length === 0 && (
              <div className="px-4 py-6 text-sm text-clinic-500">No outside documents have been attached to this chart yet.</div>
            )}
            {!documentsLoading && !documentsError && documentRows.map((document) => (
              <div key={document.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_12rem_10rem_6rem]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-clinic-900">{document.title}</span>
                    <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-0.5 text-xs font-medium text-clinic-600">
                      {document.document_type}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-clinic-500">
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{document.source}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDateTime(document.received_at)}</span>
                    <span>{document.pages} pages</span>
                    {document.matched_by && <span>Matched by {document.matched_by}</span>}
                  </div>
                  {document.summary && <p className="mt-2 max-w-3xl text-sm text-clinic-700">{document.summary}</p>}
                </div>
                <div className="text-sm font-medium text-clinic-700">{formatDocumentStatus(document.status)}</div>
                <div className="text-sm text-clinic-500">{document.file_url ? 'Available in chart' : 'Metadata only'}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  {document.status === 'needs_review' && (
                    <button
                      onClick={() => updateDocumentMutation.mutate({ documentId: document.id, status: 'filed' })}
                      disabled={updateDocumentMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      File
                    </button>
                  )}
                  <button
                    onClick={() => documentAccessMutation.mutate(document.id)}
                    disabled={documentAccessMutation.isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <Pill className="h-4 w-4 text-accent-700" />
              Medication Reconciliation
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-clinic-100 bg-clinic-50 text-left text-xs font-medium text-clinic-500">
                <tr>
                  <th className="px-4 py-2.5">Medication</th>
                  <th className="px-4 py-2.5">Dose</th>
                  <th className="px-4 py-2.5">Directions</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {medicationRows.map((medication) => (
                  <tr key={medication.name} className="border-b border-clinic-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-clinic-900">{medication.name}</td>
                    <td className="px-4 py-3 text-clinic-700">{medication.dose ?? '—'}</td>
                    <td className="px-4 py-3 text-clinic-600">{medication.directions ?? '—'}</td>
                    <td className="px-4 py-3 text-clinic-500">{medication.source ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">
                        {formatClinicalStatus(medication.status)}
                      </span>
                      {medication.status === 'review' && (
                        <button
                          onClick={() => updateMedicationMutation.mutate({ medicationId: medication.id, status: 'active' })}
                          className="ml-2 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                        >
                          Confirm
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {medicationRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-clinic-400">No medications have been added to this chart.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'care-plan' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <ShieldCheck className="h-4 w-4 text-accent-700" />
              Care Plan And Checkout Needs
            </h2>
          </div>
          <div className="divide-y divide-clinic-100">
            {carePlanItems.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_8rem_8rem]">
                <div className="text-sm font-medium text-clinic-700">
                  {item.assigned_to_name ?? item.owner_role}
                  {item.escalation && <div className="mt-0.5 text-xs text-red-700">{formatClinicalStatus(item.escalation)}</div>}
                </div>
                <div className="text-sm text-clinic-800">{item.item}</div>
                <div className="text-sm text-clinic-500">{item.due ?? 'No due date'}</div>
                <div className="text-sm font-medium text-clinic-700">
                  {formatClinicalStatus(item.status)}
                  {item.status !== 'completed' && (
                    <button
                      onClick={() => updateCarePlanMutation.mutate({ itemId: item.id, status: 'completed' })}
                      className="ml-2 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            ))}
            {carePlanItems.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-clinic-400">No care-plan items have been added to this chart.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'labs' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <TestTube2 className="h-4 w-4 text-accent-700" />
              Labs
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-clinic-100 bg-clinic-50 text-left text-xs font-medium text-clinic-500">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Panel</th>
                <th className="px-4 py-2.5">Result</th>
                <th className="px-4 py-2.5">Flag</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {labRows.map((lab) => (
                <tr key={lab.id} className="border-b border-clinic-100 last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-clinic-500">{lab.collected_at ? formatDateOnly(lab.collected_at) : '—'}</td>
                  <td className="px-4 py-3 font-medium text-clinic-900">{lab.panel}</td>
                  <td className="px-4 py-3 text-clinic-700">{lab.result}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${lab.flag === 'Critical' ? 'bg-red-100 text-red-700' : lab.flag === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-accent-100 text-accent-700'}`}>
                      {lab.flag ?? 'Normal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-clinic-600">
                    {formatClinicalStatus(lab.status)}
                    {lab.status === 'needs_review' && (
                      <button
                        onClick={() => updateLabMutation.mutate({ labId: lab.id, status: 'reviewed' })}
                        className="ml-2 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                      >
                        Reviewed
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {labRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-clinic-400">No lab results have been added to this chart.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <ClipboardList className="h-4 w-4 text-accent-700" />
              Linked Tasks
            </h2>
          </div>
          <div className="divide-y divide-clinic-100">
            {openTasks.length === 0 && (
              <div className="px-4 py-6 text-sm text-clinic-500">No open tasks are linked to this patient.</div>
            )}
            {openTasks.map((task) => (
              <div key={task.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_8rem_7rem]">
                <div className="text-sm font-medium text-clinic-900">{task.title}</div>
                <div className="text-sm text-clinic-600">{task.assigned_to_name ?? 'Unassigned'}</div>
                <div className="text-sm text-clinic-600">{formatTaskDueDate(task)}</div>
                <div className="text-sm font-medium text-clinic-700">{formatTaskPriority(task.priority)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="rounded-lg border border-clinic-200 bg-white">
          <div className="border-b border-clinic-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-clinic-800">
              <MessageSquare className="h-4 w-4 text-accent-700" />
              Patient Messages
            </h2>
          </div>
          <div className="divide-y divide-clinic-100">
            {patientMessages.map((message) => (
              <div key={`${message.from}-${message.at}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-clinic-900">{message.subject}</div>
                  <div className="text-xs text-clinic-500">{message.at}</div>
                </div>
                <div className="mt-1 text-xs font-medium text-clinic-500">{message.from}</div>
                <p className="mt-2 max-w-3xl text-sm text-clinic-700">{message.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {handoffOpen && checkoutHandoff && (
        <CheckoutHandoffPanel
          handoff={checkoutHandoff}
          checkoutError={checkoutError}
          completing={completeCheckoutMutation.isPending}
          onClose={() => setHandoffOpen(false)}
          onFileDocument={(documentId) => updateDocumentMutation.mutate({ documentId, status: 'filed' })}
          onConfirmMedication={(medicationId) => updateMedicationMutation.mutate({ medicationId, status: 'active' })}
          onReviewLab={(labId) => updateLabMutation.mutate({ labId, status: 'reviewed' })}
          onCompleteCarePlan={(itemId) => updateCarePlanMutation.mutate({ itemId, status: 'completed' })}
          onSignEncounter={(encounterId) => updateEncounterMutation.mutate({ encounterId, status: 'signed' })}
          onCreateTask={(sourceType, sourceId) => createHandoffTaskMutation.mutate({ sourceType, sourceId })}
          onCompleteCheckout={() => {
            const appointment = checkoutHandoff.chart_summary.upcoming_appointments.find((item) =>
              ['checkout', 'provider_review', 'roomed', 'checked_in', 'in_progress'].includes(item.status),
            ) ?? checkoutHandoff.chart_summary.upcoming_appointments[0];
            if (appointment) completeCheckoutMutation.mutate(appointment.id);
          }}
        />
      )}
    </div>
  );
}

function CheckoutHandoffPanel({
  handoff,
  checkoutError,
  completing,
  onClose,
  onFileDocument,
  onConfirmMedication,
  onReviewLab,
  onCompleteCarePlan,
  onSignEncounter,
  onCreateTask,
  onCompleteCheckout,
}: {
  handoff: PatientCheckoutHandoff;
  checkoutError: string | null;
  completing: boolean;
  onClose: () => void;
  onFileDocument: (documentId: string) => void;
  onConfirmMedication: (medicationId: string) => void;
  onReviewLab: (labId: string) => void;
  onCompleteCarePlan: (itemId: string) => void;
  onSignEncounter: (encounterId: string) => void;
  onCreateTask: (sourceType: string, sourceId: string) => void;
  onCompleteCheckout: () => void;
}) {
  const blocked = handoff.chart_summary.checkout_readiness === 'blocked';

  return (
    <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-md border border-clinic-300 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Checkout Handoff</h2>
            <p className="mt-1 text-xs text-clinic-500">
              {handoff.patient.last_name}, {handoff.patient.first_name} - {handoff.patient.mrn}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close checkout handoff" className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={`border-b px-4 py-3 text-sm ${blocked ? 'border-red-100 bg-red-50 text-red-800' : 'border-accent-100 bg-accent-50 text-accent-800'}`}>
            {blocked ? handoff.chart_summary.blockers.join('; ') : 'No chart blockers are currently reported.'}
          </div>

          <HandoffSection title="Documents Needing Review" rows={handoff.documents_needing_review.map((item) => ({
            id: item.id,
            title: item.title,
            detail: `${item.source} - ${item.pages} pages`,
            actionLabel: 'File',
            onAction: () => onFileDocument(item.id),
            onCreateTask: () => onCreateTask('document', item.id),
          }))} />

          <HandoffSection title="Medication Reconciliation" rows={handoff.medications_needing_review.map((item) => ({
            id: item.id,
            title: item.name,
            detail: `${item.dose ?? 'No dose'} - ${formatClinicalStatus(item.status)}`,
            actionLabel: 'Confirm',
            onAction: () => onConfirmMedication(item.id),
            onCreateTask: () => onCreateTask('medication', item.id),
          }))} />

          <HandoffSection title="Labs Needing Review" rows={handoff.labs_needing_review.map((item) => ({
            id: item.id,
            title: `${item.panel}: ${item.result}`,
            detail: `${item.flag ?? 'No flag'} - ${formatClinicalStatus(item.status)}`,
            actionLabel: 'Reviewed',
            onAction: () => onReviewLab(item.id),
            onCreateTask: () => onCreateTask('lab', item.id),
          }))} />

          <HandoffSection title="Care Plan Open Items" rows={handoff.care_plan_open_items.map((item) => ({
            id: item.id,
            title: item.item,
            detail: `${item.assigned_to_name ?? item.owner_role} - ${item.due ?? 'No due date'}${item.escalation ? ` - ${formatClinicalStatus(item.escalation)}` : ''}`,
            actionLabel: 'Done',
            onAction: () => onCompleteCarePlan(item.id),
            onCreateTask: () => onCreateTask('care_plan', item.id),
          }))} />

          <HandoffSection title="Unsigned Encounters" rows={handoff.unsigned_encounters.map((item) => ({
            id: item.id,
            title: item.encounter_type,
            detail: item.provider_name ?? 'No provider assigned',
            actionLabel: 'Sign',
            onAction: () => onSignEncounter(item.id),
            onCreateTask: () => onCreateTask('encounter', item.id),
          }))} />
        </div>

        <div className="border-t border-clinic-200 px-4 py-3">
          {checkoutError && <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{checkoutError}</div>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">
              Close
            </button>
            <button
              onClick={onCompleteCheckout}
              disabled={blocked || completing || handoff.chart_summary.upcoming_appointments.length === 0}
              className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {completing ? 'Completing...' : 'Complete Checkout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HandoffSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; title: string; detail: string; actionLabel: string; onAction: () => void; onCreateTask: () => void }>;
}) {
  return (
    <section className="border-b border-clinic-100">
      <div className="flex items-center justify-between bg-clinic-50 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase text-clinic-500">{title}</h3>
        <span className="text-xs font-medium text-clinic-500">{rows.length}</span>
      </div>
      <div className="divide-y divide-clinic-100">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-clinic-900">{row.title}</div>
              <div className="mt-0.5 truncate text-xs text-clinic-500">{row.detail}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={row.onCreateTask} className="inline-flex items-center gap-1 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-700 hover:bg-clinic-50">
                <ClipboardList className="h-3.5 w-3.5" />
                Task
              </button>
              <button onClick={row.onAction} className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100">
                {row.actionLabel}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-4 text-sm text-clinic-400">Clear</div>}
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[0];
}

function formatDocumentStatus(status: PatientDocument['status']) {
  return status
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTaskDueDate(task: Task) {
  return task.due_date ? formatDateTime(task.due_date) : 'No due date';
}

function formatTaskPriority(priority: Task['priority']) {
  return priority[0].toUpperCase() + priority.slice(1);
}

function formatClinicalStatus(status: string) {
  return status
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
