import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared'
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { Badge } from '@/components/badge';
import { Button } from '@/components/button';
import type { Appointment, AppointmentStatus, AuditEvent, BillingCase, BillingCaseListResponse, BillingTimelineResponse, EligibilityCheck, EncounterTemplateListResponse, Patient, PatientCarePlanItem, PatientCarePlanListResponse, PatientChartSummary, PatientCheckoutHandoff, PatientDocument, PatientDocumentAccess, PatientDocumentDownloadHandoff, PatientDocumentListResponse, PatientDocumentProcessResult, PatientEncounter, PatientEncounterListResponse, PatientLabResult, PatientLabResultListResponse, PatientMedication, PatientMedicationListResponse, PatientUpdate, Task, User } from '@concierge-os/shared';
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

type Tab = 'summary' | 'demographics' | 'documents' | 'medications' | 'care-plan' | 'encounters' | 'labs' | 'billing' | 'tasks' | 'messages';
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'demographics', label: 'Demographics' },
  { key: 'documents', label: 'Documents' },
  { key: 'medications', label: 'Meds' },
  { key: 'care-plan', label: 'Care Plan' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'labs', label: 'Labs' },
  { key: 'billing', label: 'Billing' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'messages', label: 'Messages' },
];

const patientMessages = [
  { from: 'Mary Collins', at: '11:18 AM', subject: 'Lab result question', body: 'I saw a lab alert in the portal. Should I change anything before my visit?' },
  { from: 'Clinic Admin', at: '11:44 AM', subject: 'Lab result question', body: 'We received it and the provider is reviewing. We will call you this afternoon.' },
];

interface UserListResponse {
  data: User[];
  total: number;
}

interface AuditListResponse {
  data: AuditEvent[];
  total: number;
}

type DocumentReviewFormState = {
  status: PatientDocument['status'];
  routed_to_role: string;
  review_priority: string;
  reviewed_by: string;
  review_note: string;
};

function PatientChartPage() {
  const { patientId } = Route.useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [documentAccessMessage, setDocumentAccessMessage] = useState<string | null>(null);
  const [documentAccessRequest, setDocumentAccessRequest] = useState<PatientDocument | null>(null);
  const [documentAccessReason, setDocumentAccessReason] = useState('Clinical chart review');
  const [documentReviewForms, setDocumentReviewForms] = useState<Record<string, DocumentReviewFormState>>({});
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
  const { data: encounterTemplates } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENT_ENCOUNTERS(patientId), 'templates'],
    queryFn: () => api.get<EncounterTemplateListResponse>(ROUTES.ENCOUNTER_TEMPLATES),
  });
  const { data: billingCases } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, patientId],
    queryFn: () => api.get<BillingCaseListResponse>(ROUTES.BILLING_CASES),
  });
  const { data: eligibilityHistory } = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_CASES, patientId, 'eligibility-history'],
    queryFn: () => api.get<BillingTimelineResponse>(ROUTES.ELIGIBILITY_HISTORY(patientId)),
  });

  const { data: accessHistory } = useQuery({
    queryKey: [...QUERY_KEYS.AUDIT, 'patient-access-history', patientId],
    queryFn: () => api.get<AuditListResponse>(ROUTES.PATIENT_ACCESS_HISTORY(patientId)),
  });

  const { data: staff } = useQuery({
    queryKey: QUERY_KEYS.USERS,
    queryFn: () => api.get<UserListResponse>(ROUTES.USERS),
  });

  const documentRows = documentList?.data ?? [];
  const medicationRows = medicationList?.data ?? [];
  const carePlanItems = carePlanList?.data ?? [];
  const labRows = labList?.data ?? [];
  const encounterRows = encounterList?.data ?? [];
  const staffRows = staff?.data ?? [];
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
    mutationFn: ({ documentId, data }: { documentId: string; data: Partial<PatientDocument> }) =>
      api.patch<PatientDocument>(ROUTES.PATIENT_DOCUMENT(patientId, documentId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const documentAccessMutation = useMutation({
    mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
      api.get<PatientDocumentAccess>(`${ROUTES.PATIENT_DOCUMENT_ACCESS(patientId, documentId)}?reason=${encodeURIComponent(reason)}`),
    onSuccess: async (access) => {
      setDocumentAccessRequest(null);
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.AUDIT, 'patient-access-history', patientId] });
      if (access.available && access.url) {
        if (access.url.startsWith('/api/')) {
          const handoff = await api.get<PatientDocumentDownloadHandoff>(access.url);
          if (handoff.presigned_url) {
            window.open(handoff.presigned_url, '_blank', 'noopener,noreferrer');
          }
          setDocumentAccessMessage(`${handoff.file_name}: ${handoff.message} Source ${handoff.source_uri_preview}. Access expires at ${handoff.expires_at ?? access.expires_at ?? 'the configured expiry time'}.`);
          return;
        }
        window.open(access.url, '_blank', 'noopener,noreferrer');
        setDocumentAccessMessage(`${access.viewer_mode === 'inline' ? 'Preview' : 'Download'} access expires at ${access.expires_at ?? 'the configured expiry time'}${access.content_type ? ` (${access.content_type})` : ''}.`);
      } else {
        setDocumentAccessMessage(access.reason ?? 'This document is not available for viewing yet.');
      }
    },
  });

  const processDocumentMutation = useMutation({
    mutationFn: (documentId: string) =>
      api.post<PatientDocumentProcessResult>(ROUTES.PATIENT_DOCUMENT_PROCESS(patientId, documentId), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
    },
  });

  const formForDocumentReview = (document: PatientDocument): DocumentReviewFormState => documentReviewForms[document.id] ?? {
    status: document.status,
    routed_to_role: document.routed_to_role ?? '',
    review_priority: document.review_priority ?? 'normal',
    reviewed_by: document.reviewed_by ?? '',
    review_note: document.review_note ?? '',
  };
  const updateDocumentReviewForm = (document: PatientDocument, patch: Partial<DocumentReviewFormState>) => {
    setDocumentReviewForms((current) => ({
      ...current,
      [document.id]: { ...formForDocumentReview(document), ...patch },
    }));
  };
  const submitDocumentReview = (document: PatientDocument) => {
    const form = formForDocumentReview(document);
    updateDocumentMutation.mutate({
      documentId: document.id,
      data: {
        status: form.status,
        routed_to_role: form.routed_to_role.trim() || null,
        review_priority: form.review_priority.trim() || 'normal',
        reviewed_by: form.reviewed_by.trim() || null,
        review_note: form.review_note.trim() || null,
      },
    });
  };

  const updateMedicationMutation = useMutation({
    mutationFn: ({ medicationId, status }: { medicationId: string; status: PatientMedication['status'] }) =>
      api.patch<PatientMedication>(ROUTES.PATIENT_MEDICATION(patientId, medicationId), { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_MEDICATIONS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHECKOUT_HANDOFF(patientId) });
    },
  });

  const updateCarePlanMutation = useMutation({
    mutationFn: ({ itemId, update }: { itemId: string; update: Partial<PatientCarePlanItem> }) =>
      api.patch<PatientCarePlanItem>(ROUTES.PATIENT_CARE_PLAN_ITEM(patientId, itemId), update),
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

  const createEncounterMutation = useMutation({
    mutationFn: (templateId: string) => {
      const template = encounterTemplates?.data.find((item) => item.id === templateId);
      return api.post<PatientEncounter>(ROUTES.PATIENT_ENCOUNTERS(patientId), {
        provider_id: staffRows.find((user) => user.role === 'provider')?.id ?? staffRows[0]?.id ?? null,
        encounter_type: template?.encounter_type ?? 'office_visit',
        status: 'provider_review',
        summary: template?.name ?? 'Templated encounter',
        subjective: template?.subjective ?? null,
        objective: template?.objective ?? null,
        assessment: template?.assessment ?? null,
        plan: template?.plan ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_ENCOUNTERS(patientId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT_CHART_SUMMARY(patientId) });
    },
  });

  const chargeCaptureMutation = useMutation({
    mutationFn: (encounterId: string) => api.post<BillingCase>(ROUTES.BILLING_FROM_ENCOUNTER(encounterId), {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES }),
  });
  const eligibilityMutation = useMutation({
    mutationFn: () => api.post<EligibilityCheck>(ROUTES.ELIGIBILITY_CHECK(patientId), {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CASES }),
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
      sms_consent: patient.sms_consent ? 'true' : 'false',
      email_consent: patient.email_consent ? 'true' : 'false',
      preferred_contact_channel: patient.preferred_contact_channel || '',
    });
    setEditing(true);
  }

  function saveEdit() {
    updateMutation.mutate({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      phone: editForm.phone || null,
      email: editForm.email || null,
      sms_consent: editForm.sms_consent === 'true',
      email_consent: editForm.email_consent === 'true',
      preferred_contact_channel: editForm.preferred_contact_channel === 'sms' || editForm.preferred_contact_channel === 'email'
        ? editForm.preferred_contact_channel
        : null,
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
        className="mb-4 flex items-center gap-2 text-small text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to patients
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-display text-ink">
            {patient.last_name}, {patient.first_name}
          </h1>
          <p className="mt-1 flex items-center gap-3 text-small text-ink-muted">
            <span className="font-mono text-micro">{patient.mrn}</span>
            <span>{patient.dob}</span>
            <span>{patient.gender}</span>
          </p>
        </div>
        <Button
          onClick={() => setHandoffOpen(true)}
          icon={ShieldCheck}
        >
          Checkout Handoff
        </Button>
        {activeTab === 'demographics' && !editing && (
          <Button
            variant="secondary"
            size="sm"
            icon={Pencil}
            onClick={startEditing}
          >
            Edit
          </Button>
        )}
      </div>

      <div className="mb-6 flex gap-0 overflow-x-auto border-b border-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setEditing(false); }}
            className={`px-4 py-2.5 text-small font-medium transition-colors ${
              activeTab === key
                ? 'border-b-2 border-accent text-accent'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-5">
          <section className="grid gap-3 lg:grid-cols-5">
            {[
              { label: 'Visit state', value: 'Checkout prep', detail: 'Provider review pending', icon: Stethoscope, tone: 'text-accent' },
              { label: 'Documents', value: String(chartSummary?.counts.documents_total ?? documentRows.length), detail: `${chartSummary?.counts.documents_needing_review ?? documentsNeedingReview} needs review`, icon: FolderOpen, tone: 'text-warn' },
              { label: 'Open tasks', value: String(chartSummary?.counts.open_tasks ?? openTasks.length), detail: `${chartSummary?.counts.urgent_tasks ?? 0} urgent`, icon: ClipboardList, tone: 'text-danger' },
              { label: 'Clinical review', value: String((chartSummary?.counts.medications_needing_review ?? 0) + (chartSummary?.counts.labs_needing_review ?? 0)), detail: `${chartSummary?.counts.medications_needing_review ?? 0} meds, ${chartSummary?.counts.labs_needing_review ?? 0} labs`, icon: AlertTriangle, tone: 'text-warn' },
              { label: 'Care plan', value: String(carePlanItems.length), detail: `${chartSummary?.counts.care_plan_blockers ?? 0} blocked, ${chartSummary?.counts.unsigned_encounters ?? 0} unsigned`, icon: ShieldCheck, tone: 'text-ink-muted' },
            ].map(({ label, value, detail, icon: Icon, tone }) => (
              <div key={label} className="bg-canvas-raised border border-border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <span className="text-small font-medium text-ink-muted">{label}</span>
                  <Icon className={`h-4 w-4 ${tone}`} />
                </div>
                <div className="font-serif text-2xl font-medium text-ink mt-3">{value}</div>
                <div className="text-micro text-ink-faint mt-1">{detail}</div>
              </div>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="border border-border bg-canvas-raised rounded-md">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-subhead font-medium text-ink">Checkout Handoff</h2>
                <p className="text-micro text-ink-muted mt-0.5">What the care team needs before this patient leaves</p>
              </div>
              <div className="divide-y divide-border">
                {carePlanItems.map((item) => (
                  <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[10rem_1fr_7rem_7rem]">
                    <div className="text-small font-medium text-ink-secondary">
                      <select
                        value={item.assigned_to_id ?? ''}
                        onChange={(event) => updateCarePlanMutation.mutate({ itemId: item.id, update: { assigned_to_id: event.target.value || null } })}
                        className="w-full bg-canvas border border-border rounded-sm px-2 py-1 text-micro text-ink-secondary"
                      >
                        <option value="">{item.owner_role}</option>
                        {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                      </select>
                      {item.escalation && <div className="mt-0.5 text-micro text-danger">{formatClinicalStatus(item.escalation)}</div>}
                    </div>
                    <div className="text-small text-ink">{item.item}</div>
                    <div className="text-small text-ink-muted">{item.due ?? 'No due date'}</div>
                    <div className="text-small font-medium text-ink-secondary">{formatClinicalStatus(item.status)}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="border border-border bg-canvas-raised rounded-md p-4">
              <h2 className="text-subhead font-medium text-ink">Clinical Flags</h2>
              <div className="mt-3 space-y-3 text-small">
                {blockers.length > 0 ? blockers.map((blocker) => (
                  <div key={blocker} className="rounded-md border border-danger/20 bg-danger/10 p-3 text-danger">
                    {blocker}
                  </div>
                )) : (
                  <div className="rounded-md border border-border bg-canvas-sunk p-3 text-ink-secondary">
                    No chart blockers are currently reported.
                  </div>
                )}
              </div>
            </aside>
          </section>
        </div>
      )}

      {activeTab === 'demographics' && (
        <div className="border border-border bg-canvas-raised rounded-md p-6">
          {editing ? (
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-1 block text-small font-medium text-ink-secondary">First Name</label>
                <input
                  type="text"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-small font-medium text-ink-secondary">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-small font-medium text-ink-secondary">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-small font-medium text-ink-secondary">Email</label>
                <input
                  type="email"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-small font-medium text-ink-secondary">Preferred outreach</label>
                <select
                  value={editForm.preferred_contact_channel || ''}
                  onChange={(e) => setEditForm({ ...editForm, preferred_contact_channel: e.target.value })}
                  className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink"
                >
                  <option value="">None selected</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-small font-medium text-ink-secondary">
                  <input type="checkbox" checked={editForm.sms_consent === 'true'} onChange={(e) => setEditForm({ ...editForm, sms_consent: e.target.checked ? 'true' : 'false' })} className="h-4 w-4 rounded border-border text-accent" />
                  SMS consent
                </label>
                <label className="inline-flex items-center gap-2 text-small font-medium text-ink-secondary">
                  <input type="checkbox" checked={editForm.email_consent === 'true'} onChange={(e) => setEditForm({ ...editForm, email_consent: e.target.checked ? 'true' : 'false' })} className="h-4 w-4 rounded border-border text-accent" />
                  Email consent
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  icon={Check}
                >
                  {updateMutation.isPending ? 'Saving' : 'Save'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(false)}
                  icon={X}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-4 max-w-lg text-small">
              {[
                { icon: Phone, label: 'Phone', value: patient.phone || '—' },
                { icon: Mail, label: 'Email', value: patient.email || '—' },
                { icon: MessageSquare, label: 'Outreach consent', value: `${patient.sms_consent ? 'SMS' : 'No SMS'} / ${patient.email_consent ? 'Email' : 'No email'}` },
                { icon: ShieldCheck, label: 'Preferred outreach', value: patient.preferred_contact_channel || '—' },
                { icon: MapPin, label: 'Address', value: patient.address ? `${patient.address.street}, ${patient.address.city}, ${patient.address.state} ${patient.address.zip}` : '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-ink-faint" />
                  <div>
                    <dt className="font-medium text-ink-muted">{label}</dt>
                    <dd className="mt-0.5 text-ink">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {patient.allergies && patient.allergies.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-small font-medium text-ink-secondary">
                <AlertTriangle className="h-4 w-4 text-warn" />
                Allergies
              </h3>
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((a, i) => (
                  <span key={i} className="rounded-pill bg-warn/10 border border-warn/20 px-3 py-1 text-micro font-medium text-warn">
                    {a.substance} — {a.reaction}
                  </span>
                ))}
              </div>
            </div>
          )}

          {patient.problem_list && patient.problem_list.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-small font-medium text-ink-secondary">
                <Heart className="h-4 w-4 text-danger" />
                Problem List
              </h3>
              <ul className="list-inside list-disc space-y-1 text-small text-ink-muted">
                {patient.problem_list.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {activeTab === 'encounters' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
                <FileText className="h-4 w-4 text-accent" />
                Encounter Timeline
              </h2>
              <div className="flex flex-wrap gap-2">
                {(encounterTemplates?.data ?? []).map((template) => (
                  <button key={template.id} onClick={() => createEncounterMutation.mutate(template.id)} className="border border-border bg-canvas-sunk rounded-sm px-2 py-1 text-micro font-medium text-ink-secondary hover:bg-canvas-raised transition-colors">
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {encounterRows.map((encounter) => (
              <div key={encounter.id} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_14rem]">
                <div className="font-mono text-micro text-ink-muted">{formatDateOnly(encounter.created_at)}</div>
                <div>
                  <div className="text-small font-medium text-ink">{encounter.encounter_type}</div>
                  <div className="mt-1 text-small text-ink-secondary">{encounter.summary ?? 'No summary entered.'}</div>
                  <div className="mt-1 text-micro text-ink-muted">{encounter.provider_name ?? 'No provider assigned'}</div>
                  {(encounter.assessment || encounter.plan) && (
                    <div className="mt-2 grid gap-2 text-micro text-ink-secondary md:grid-cols-2">
                      {encounter.assessment && <div><span className="font-medium text-ink">Assessment:</span> {encounter.assessment}</div>}
                      {encounter.plan && <div><span className="font-medium text-ink">Plan:</span> {encounter.plan}</div>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  <Badge intent="muted">{formatClinicalStatus(encounter.status)}</Badge>
                  {encounter.status === 'provider_review' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => updateEncounterMutation.mutate({ encounterId: encounter.id, status: 'signed' })}
                    >
                      Sign
                    </Button>
                  )}
                  {encounter.status === 'signed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => chargeCaptureMutation.mutate(encounter.id)}
                    >
                      Charge
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {encounterRows.length === 0 && (
              <div className="px-4 py-8 text-center text-small text-ink-faint">No encounters have been added to this chart.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <FolderOpen className="h-4 w-4 text-accent" />
              Outside Documents
            </h2>
            <p className="mt-1 text-micro text-ink-muted">Faxed, scanned, and imported records from outside offices</p>
          </div>
          <div className="divide-y divide-border">
            {documentAccessMessage && (
              <div className="border-b border-accent-soft bg-accent-soft px-4 py-2 text-small text-accent">
                {documentAccessMessage}
              </div>
            )}
            {documentsLoading && (
              <div className="px-4 py-6 text-small text-ink-muted">Loading outside documents...</div>
            )}
            {documentsError && (
              <div className="px-4 py-6 text-small text-danger">Unable to load outside documents.</div>
            )}
            {!documentsLoading && !documentsError && documentRows.length === 0 && (
              <div className="px-4 py-6 text-small text-ink-muted">No outside documents have been attached to this chart yet.</div>
            )}
            {!documentsLoading && !documentsError && documentRows.map((document) => {
              const reviewForm = formForDocumentReview(document);
              return (
              <div key={document.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_13rem_10rem_6rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-small font-medium text-ink">{document.title}</span>
                    <Badge intent="muted">{document.document_type}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-micro text-ink-muted">
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{document.source}</span>
                    <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{formatDateTime(document.received_at)}</span>
                    <span>{document.pages} pages</span>
                    {document.matched_by && <span>Matched by {document.matched_by}</span>}
                  </div>
                  <div className="mt-2 grid gap-2 text-micro text-ink-muted md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-border bg-canvas-sunk px-2 py-1">
                      <div className="font-medium text-ink-secondary">{document.source_contact ?? 'Source contact not set'}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {document.source_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{document.source_phone}</span>}
                        {document.source_fax && <span>Fax {document.source_fax}</span>}
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-canvas-sunk px-2 py-1">
                      <div className="font-medium text-ink-secondary">Reference</div>
                      <div className="mt-0.5">{document.source_reference ?? 'Not provided'}</div>
                    </div>
                    <div className="rounded-md border border-border bg-canvas-sunk px-2 py-1">
                      <div className="font-medium text-ink-secondary">Requested by</div>
                      <div className="mt-0.5">{document.requested_by ?? 'Not tracked'}</div>
                    </div>
                    <div className="rounded-md border border-border bg-canvas-sunk px-2 py-1">
                      <div className="font-medium text-ink-secondary">Routing</div>
                      <div className="mt-0.5">{document.routed_to_role ?? 'Unrouted'} · {document.review_priority ?? 'normal'}</div>
                    </div>
                  </div>
                  {document.summary && <p className="mt-2 max-w-3xl text-small text-ink-secondary">{document.summary}</p>}
                  {document.review_note && (
                    <p className="mt-2 max-w-3xl rounded-md border border-accent-soft bg-accent-soft px-2 py-1.5 text-micro text-accent">
                      {document.review_note} {document.reviewed_by ? `- ${document.reviewed_by}` : ''} {document.reviewed_at ? `(${formatDateTime(document.reviewed_at)})` : ''}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-micro font-medium text-ink-muted">
                    <Badge intent="muted">{document.upload_status.replace('_', ' ')}</Badge>
                    <Badge intent="muted">OCR {document.ocr_status.replace('_', ' ')}</Badge>
                    {document.classification && <Badge intent="warn">{document.classification.replace('_', ' ')}</Badge>}
                  </div>
                  <div className="mt-3 grid gap-2 rounded-md border border-border bg-canvas p-2 md:grid-cols-[8.5rem_8.5rem_8.5rem_9rem_minmax(0,1fr)_5rem]">
                    <select
                      value={reviewForm.status}
                      onChange={(event) => updateDocumentReviewForm(document, { status: event.target.value as PatientDocument['status'] })}
                      className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                    >
                      <option value="received">Received</option>
                      <option value="needs_review">Needs review</option>
                      <option value="filed">Filed</option>
                      <option value="reconciled">Reconciled</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <input
                      value={reviewForm.routed_to_role}
                      onChange={(event) => updateDocumentReviewForm(document, { routed_to_role: event.target.value })}
                      placeholder="Route role"
                      className="min-w-0 bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                    />
                    <select
                      value={reviewForm.review_priority}
                      onChange={(event) => updateDocumentReviewForm(document, { review_priority: event.target.value })}
                      className="bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <input
                      value={reviewForm.reviewed_by}
                      onChange={(event) => updateDocumentReviewForm(document, { reviewed_by: event.target.value })}
                      placeholder="Reviewer"
                      className="min-w-0 bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                    />
                    <input
                      value={reviewForm.review_note}
                      onChange={(event) => updateDocumentReviewForm(document, { review_note: event.target.value })}
                      placeholder="Review note"
                      className="min-w-0 bg-canvas border border-border rounded-sm px-2 py-1.5 text-micro text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => submitDocumentReview(document)}
                      disabled={updateDocumentMutation.isPending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <div className="text-small font-medium text-ink-secondary">{formatDocumentStatus(document.status)}</div>
                <div className="text-small text-ink-muted">{document.file_url ? 'Available in chart' : 'Metadata only'}</div>
                <div className="flex flex-wrap justify-end gap-2">
                  {document.status === 'needs_review' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Check}
                      onClick={() => updateDocumentMutation.mutate({ documentId: document.id, data: { status: 'filed' } })}
                      disabled={updateDocumentMutation.isPending}
                    >
                      File
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Download}
                    onClick={() => {
                      setDocumentAccessRequest(document);
                      setDocumentAccessReason('Clinical chart review');
                    }}
                    disabled={documentAccessMutation.isPending}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => processDocumentMutation.mutate(document.id)}
                    disabled={processDocumentMutation.isPending}
                  >
                    Process
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
          <div className="border-t border-border bg-canvas-sunk px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-meta font-medium text-ink-muted uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              Recent PHI Access
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(accessHistory?.data ?? []).slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-micro">
                  <div className="font-medium text-ink-secondary">{event.event_type.replaceAll('_', ' ')}</div>
                  <div className="mt-1 text-ink-muted">{formatDateTime(event.created_at)}</div>
                  {typeof event.payload?.reason === 'string' && <div className="mt-1 text-ink-secondary">{event.payload.reason}</div>}
                </div>
              ))}
              {(accessHistory?.data ?? []).length === 0 && <div className="text-micro text-ink-faint">No document access events recorded yet.</div>}
            </div>
          </div>
        </div>
      )}

      {documentAccessRequest && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              documentAccessMutation.mutate({ documentId: documentAccessRequest.id, reason: documentAccessReason });
            }}
            className="mx-auto mt-28 max-w-md bg-canvas-raised border border-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-subhead font-medium text-ink">Document Access Reason</h2>
              <button type="button" onClick={() => setDocumentAccessRequest(null)} className="rounded-md p-1 text-ink-muted hover:text-ink hover:bg-canvas-sunk">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="rounded-md border border-border bg-canvas-sunk px-3 py-2 text-small font-medium text-ink">
                {documentAccessRequest.title}
              </div>
              <label className="block text-small font-medium text-ink-secondary">
                Reason
                <textarea
                  required
                  minLength={3}
                  rows={3}
                  value={documentAccessReason}
                  onChange={(event) => setDocumentAccessReason(event.target.value)}
                  className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent-soft focus:outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={() => setDocumentAccessRequest(null)}>Cancel</Button>
              <Button disabled={documentAccessMutation.isPending || documentAccessReason.trim().length < 3}>
                {documentAccessMutation.isPending ? 'Opening...' : 'Open document'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'medications' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <Pill className="h-4 w-4 text-accent" />
              Medication Reconciliation
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border-subtle bg-canvas-sunk text-left">
                <tr>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Medication</th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Dose</th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Directions</th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Source</th>
                  <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {medicationRows.map((medication) => (
                  <tr key={medication.name} className="border-b border-border-subtle hover:bg-canvas-sunk/50 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-ink">{medication.name}</td>
                    <td className="px-4 py-3 text-ink-secondary">{medication.dose ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{medication.directions ?? '—'}</td>
                    <td className="px-4 py-3 text-ink-muted">{medication.source ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge intent="muted">{formatClinicalStatus(medication.status)}</Badge>
                      {medication.status === 'review' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ml-2"
                          onClick={() => updateMedicationMutation.mutate({ medicationId: medication.id, status: 'active' })}
                        >
                          Confirm
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {medicationRows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-small text-ink-faint">No medications have been added to this chart.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'care-plan' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Care Plan And Checkout Needs
            </h2>
          </div>
          <div className="divide-y divide-border">
            {carePlanItems.map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[10rem_1fr_8rem_8rem]">
                <div className="text-small font-medium text-ink-secondary">
                  <select
                    value={item.assigned_to_id ?? ''}
                    onChange={(event) => updateCarePlanMutation.mutate({ itemId: item.id, update: { assigned_to_id: event.target.value || null } })}
                    className="w-full bg-canvas border border-border rounded-sm px-2 py-1 text-micro text-ink-secondary"
                  >
                    <option value="">{item.owner_role}</option>
                    {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                  </select>
                  {item.escalation && <div className="mt-0.5 text-micro text-danger">{formatClinicalStatus(item.escalation)}</div>}
                </div>
                <div className="text-small text-ink">{item.item}</div>
                <div className="text-small text-ink-muted">{item.due ?? 'No due date'}</div>
                <div className="text-small font-medium text-ink-secondary">
                  {formatClinicalStatus(item.status)}
                  {item.status !== 'completed' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-2"
                      onClick={() => updateCarePlanMutation.mutate({ itemId: item.id, update: { status: 'completed' } })}
                    >
                      Done
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {carePlanItems.length === 0 && (
              <div className="px-4 py-8 text-center text-small text-ink-faint">No care-plan items have been added to this chart.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'labs' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <TestTube2 className="h-4 w-4 text-accent" />
              Labs
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-canvas-sunk text-left">
              <tr>
                <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Date</th>
                <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Panel</th>
                <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Result</th>
                <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Flag</th>
                <th className="px-4 py-2.5 text-meta font-medium text-ink-muted uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {labRows.map((lab) => (
                <tr key={lab.id} className="border-b border-border-subtle hover:bg-canvas-sunk/50 transition-colors duration-150">
                  <td className="px-4 py-3 font-mono text-micro text-ink-muted">{lab.collected_at ? formatDateOnly(lab.collected_at) : '—'}</td>
                  <td className="px-4 py-3 font-medium text-ink">{lab.panel}</td>
                  <td className="px-4 py-3 text-ink-secondary">{lab.result}</td>
                  <td className="px-4 py-3">
                    <Badge intent={lab.flag === 'Critical' ? 'danger' : lab.flag === 'High' ? 'warn' : 'muted'}>
                      {lab.flag ?? 'Normal'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatClinicalStatus(lab.status)}
                    {lab.status === 'needs_review' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="ml-2"
                        onClick={() => updateLabMutation.mutate({ labId: lab.id, status: 'reviewed' })}
                      >
                        Reviewed
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {labRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-small text-ink-faint">No lab results have been added to this chart.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-subhead font-medium text-ink">Billing and Eligibility</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => eligibilityMutation.mutate()}
            >
              Check eligibility
            </Button>
          </div>
          <div className="divide-y divide-border">
            {(billingCases?.data ?? []).filter((item) => item.patient_id === patientId).map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_10rem]">
                <div>
                  <div className="text-small font-medium text-ink">{item.payer ?? 'No payer'}</div>
                  <div className="mt-1 text-micro text-ink-muted">CPT {item.cpt_codes.join(', ') || 'not coded'} - DX {item.diagnosis_codes.join(', ') || 'not coded'}</div>
                  {item.notes && <div className="mt-1 text-micro text-ink-secondary">{item.notes}</div>}
                </div>
                <span className="text-small font-medium text-ink-secondary">{item.status}</span>
                <span className="text-small text-ink-muted">{item.eligibility_status}</span>
              </div>
            ))}
            {(billingCases?.data ?? []).filter((item) => item.patient_id === patientId).length === 0 && <div className="px-4 py-8 text-center text-small text-ink-faint">No billing cases for this patient.</div>}
          </div>
          <div className="border-t border-border px-4 py-3">
            <h3 className="text-meta font-medium text-ink-faint uppercase">Eligibility history</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {(eligibilityHistory?.data ?? []).map((event) => (
                <div key={event.id} className="rounded-md bg-canvas-sunk px-3 py-2">
                  <div className="text-micro font-medium text-ink">{String(event.payload.status ?? 'checked')}</div>
                  <div className="mt-1 text-micro text-ink-muted">{String(event.payload.payer ?? 'No payer')} · {new Date(event.created_at).toLocaleString()}</div>
                </div>
              ))}
              {(eligibilityHistory?.data ?? []).length === 0 && <div className="text-small text-ink-faint">No eligibility checks recorded yet.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <ClipboardList className="h-4 w-4 text-accent" />
              Linked Tasks
            </h2>
          </div>
          <div className="divide-y divide-border">
            {openTasks.length === 0 && (
              <div className="px-4 py-6 text-small text-ink-muted">No open tasks are linked to this patient.</div>
            )}
            {openTasks.map((task) => (
              <div key={task.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_8rem_7rem]">
                <div className="text-small font-medium text-ink">{task.title}</div>
                <div className="text-small text-ink-muted">{task.assigned_to_name ?? 'Unassigned'}</div>
                <div className="text-small text-ink-muted">{formatTaskDueDate(task)}</div>
                <div className="text-small font-medium text-ink-secondary">{formatTaskPriority(task.priority)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="border border-border bg-canvas-raised rounded-md">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-subhead font-medium text-ink">
              <MessageSquare className="h-4 w-4 text-accent" />
              Patient Messages
            </h2>
          </div>
          <div className="divide-y divide-border">
            {patientMessages.map((message) => (
              <div key={`${message.from}-${message.at}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-small font-medium text-ink">{message.subject}</div>
                  <div className="text-micro text-ink-muted">{message.at}</div>
                </div>
                <div className="mt-1 text-micro font-medium text-ink-muted">{message.from}</div>
                <p className="mt-2 max-w-3xl text-small text-ink-secondary">{message.body}</p>
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
          onFileDocument={(documentId) => updateDocumentMutation.mutate({ documentId, data: { status: 'filed' } })}
          onConfirmMedication={(medicationId) => updateMedicationMutation.mutate({ medicationId, status: 'active' })}
          onReviewLab={(labId) => updateLabMutation.mutate({ labId, status: 'reviewed' })}
          onCompleteCarePlan={(itemId) => updateCarePlanMutation.mutate({ itemId, update: { status: 'completed' } })}
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
    <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-canvas-raised shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-subhead font-medium text-ink">Checkout Handoff</h2>
            <p className="mt-1 text-micro text-ink-muted">
              {handoff.patient.last_name}, {handoff.patient.first_name} - {handoff.patient.mrn}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close checkout handoff" className="rounded-md p-1 text-ink-muted hover:bg-canvas-sunk hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={`border-b px-4 py-3 text-small ${blocked ? 'border-danger/20 bg-danger/10 text-danger' : 'border-accent-soft bg-accent-soft text-accent'}`}>
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

        <div className="border-t border-border px-5 py-4">
          {checkoutError && <div className="mb-2 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-small text-danger">{checkoutError}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button
              onClick={onCompleteCheckout}
              disabled={blocked || completing || handoff.chart_summary.upcoming_appointments.length === 0}
            >
              {completing ? 'Completing...' : 'Complete Checkout'}
            </Button>
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
    <section className="border-b border-border-subtle">
      <div className="flex items-center justify-between bg-canvas-sunk px-4 py-2">
        <h3 className="text-meta font-medium text-ink-muted">{title}</h3>
        <span className="text-meta font-medium text-ink-muted">{rows.length}</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-small font-medium text-ink">{row.title}</div>
              <div className="mt-0.5 truncate text-micro text-ink-muted">{row.detail}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" icon={ClipboardList} onClick={row.onCreateTask}>
                Task
              </Button>
              <Button variant="secondary" size="sm" onClick={row.onAction}>
                {row.actionLabel}
              </Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-4 text-small text-ink-faint">Clear</div>}
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
