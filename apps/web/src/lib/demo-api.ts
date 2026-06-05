import type { Appointment, AuditEvent, Fax, Message, MessageThread, Patient, PatientCarePlanItem, PatientCheckoutHandoff, PatientChartSummary, PatientDocument, PatientEncounter, PatientLabResult, PatientMedication, PatientUpdate, Task, TodayQueue, User, WorkloadSummary } from '@concierge-os/shared';

const DEMO_STORAGE_KEY = 'concierge-os.demo-data.v1';
const now = new Date('2026-06-03T13:30:00-04:00');

function iso(offsetHours = 0) {
  return new Date(now.getTime() + offsetHours * 60 * 60 * 1000).toISOString();
}

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function withDeliveryDefaults(task: Omit<Task, 'delivery_channel' | 'delivery_status' | 'delivery_recipient' | 'delivery_provider_message_id' | 'delivery_error' | 'delivery_attempts' | 'delivered_at'>): Task {
  return {
    ...task,
    delivery_channel: null,
    delivery_status: null,
    delivery_recipient: null,
    delivery_provider_message_id: null,
    delivery_error: null,
    delivery_attempts: 0,
    delivered_at: null,
  };
}

function normalizeDocument(document: PatientDocument): PatientDocument {
  return {
    ...document,
    upload_status: document.upload_status ?? (document.file_url ? 'uploaded' : 'metadata_only'),
    ocr_status: document.ocr_status ?? 'not_started',
    classification: document.classification ?? null,
  };
}

interface DemoStore {
  patients: Patient[];
  tasks: Task[];
  appointments: Appointment[];
  faxes: Fax[];
  patientDocuments?: PatientDocument[];
  patientMedications?: PatientMedication[];
  patientCarePlan?: PatientCarePlanItem[];
  patientLabs?: PatientLabResult[];
  patientEncounters?: PatientEncounter[];
  messages: Message[];
  auditEvents?: AuditEvent[];
  integrationEvents?: IntegrationEvent[];
}

interface IntegrationEvent {
  id: string;
  organization_id: string;
  integration: string;
  direction: string;
  action: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  idempotency_key: string | null;
  attempts: number;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

let demoUsers: User[] = [
  { id: uuid(1), email: 'admin@clinic.example.com', display_name: 'Clinic Admin', role: 'admin', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
  { id: uuid(2), email: 'nora.ellis@clinic.example.com', display_name: 'Dr. Nora Ellis', role: 'provider', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
  { id: uuid(3), email: 'maya.chen@clinic.example.com', display_name: 'Maya Chen, MA', role: 'ma', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
  { id: uuid(4), email: 'riley.morgan@clinic.example.com', display_name: 'Riley Morgan', role: 'manager', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
  { id: uuid(5), email: 'sam.rivera@clinic.example.com', display_name: 'Sam Rivera', role: 'front_desk', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
  { id: uuid(6), email: 'omar.singh@clinic.example.com', display_name: 'Dr. Omar Singh', role: 'provider', organization_id: uuid(900), is_active: true, created_at: iso(-720), updated_at: iso(-24) },
];

let patients: Patient[] = [
  {
    id: uuid(101),
    mrn: 'MRN-10492',
    first_name: 'Mary',
    last_name: 'Collins',
    dob: '1961-04-18',
    gender: 'Female',
    phone: '(312) 555-0184',
    email: 'mary.collins@example.test',
    address: { street: '412 Prairie Ave', city: 'Chicago', state: 'IL', zip: '60616' },
    emergency_contact: { name: 'Evan Collins', relationship: 'Spouse', phone: '(312) 555-0119' },
    insurance: { provider: 'BlueCross', plan: 'PPO', member_id: 'BC-884221', group_number: '1037' },
    allergies: [{ substance: 'Penicillin', reaction: 'Hives', severity: 'moderate' }],
    problem_list: ['Hypertension', 'Type 2 diabetes', 'Hyperlipidemia'],
    is_active: true,
    created_at: iso(-240),
    updated_at: iso(-1),
  },
  {
    id: uuid(102),
    mrn: 'MRN-11807',
    first_name: 'Andre',
    last_name: 'Miller',
    dob: '1978-10-02',
    gender: 'Male',
    phone: '(312) 555-0128',
    email: 'andre.miller@example.test',
    address: { street: '88 Lake Shore Dr', city: 'Chicago', state: 'IL', zip: '60611' },
    emergency_contact: null,
    insurance: { provider: 'Aetna', plan: 'HMO', member_id: 'AET-442901', group_number: '8812' },
    allergies: [],
    problem_list: ['Asthma', 'GERD'],
    is_active: true,
    created_at: iso(-180),
    updated_at: iso(-2),
  },
  {
    id: uuid(103),
    mrn: 'MRN-12138',
    first_name: 'Sofia',
    last_name: 'Nguyen',
    dob: '1989-01-25',
    gender: 'Female',
    phone: '(312) 555-0173',
    email: 'sofia.nguyen@example.test',
    address: { street: '1700 W Division St', city: 'Chicago', state: 'IL', zip: '60622' },
    emergency_contact: { name: 'Minh Nguyen', relationship: 'Brother', phone: '(312) 555-0144' },
    insurance: null,
    allergies: [{ substance: 'Sulfa', reaction: 'Rash', severity: 'mild' }],
    problem_list: ['Hypothyroidism'],
    is_active: true,
    created_at: iso(-90),
    updated_at: iso(-5),
  },
  {
    id: uuid(104),
    mrn: 'MRN-12881',
    first_name: 'James',
    last_name: 'Patel',
    dob: '1994-07-11',
    gender: 'Male',
    phone: '(312) 555-0190',
    email: 'james.patel@example.test',
    address: null,
    emergency_contact: null,
    insurance: { provider: 'United Healthcare', plan: 'Choice Plus', member_id: 'UHC-099321', group_number: '5501' },
    allergies: [],
    problem_list: [],
    is_active: true,
    created_at: iso(-72),
    updated_at: iso(-6),
  },
  {
    id: uuid(105),
    mrn: 'MRN-13644',
    first_name: 'Lena',
    last_name: 'Brooks',
    dob: '1955-11-09',
    gender: 'Female',
    phone: '(312) 555-0107',
    email: 'lena.brooks@example.test',
    address: { street: '205 Oak St', city: 'Oak Park', state: 'IL', zip: '60302' },
    emergency_contact: { name: 'Theo Brooks', relationship: 'Son', phone: '(312) 555-0133' },
    insurance: { provider: 'Medicare', plan: 'Part B', member_id: 'MCR-72118', group_number: '' },
    allergies: [{ substance: 'Latex', reaction: 'Contact dermatitis', severity: 'mild' }],
    problem_list: ['Atrial fibrillation', 'Osteoarthritis'],
    is_active: true,
    created_at: iso(-48),
    updated_at: iso(-3),
  },
];

let tasks: Task[] = [
  withDeliveryDefaults({ id: uuid(201), title: 'Call Mary Collins with potassium result', description: 'Critical lab callback and medication reconciliation.', priority: 'urgent', status: 'open', due_date: iso(1), assigned_to_id: uuid(3), assigned_to_name: 'Maya Chen, MA', patient_id: uuid(101), patient_name: 'Mary Collins', source_type: null, source_id: null, creator_id: uuid(1), created_at: iso(-8), updated_at: iso(-1) }),
  withDeliveryDefaults({ id: uuid(202), title: 'Room Andre Miller', description: 'Update medication list and repeat blood pressure.', priority: 'high', status: 'in_progress', due_date: iso(0.5), assigned_to_id: uuid(3), assigned_to_name: 'Maya Chen, MA', patient_id: uuid(102), patient_name: 'Andre Miller', source_type: null, source_id: null, creator_id: uuid(1), created_at: iso(-2), updated_at: iso(-0.5) }),
  withDeliveryDefaults({ id: uuid(203), title: 'Prepare referral packet', description: 'Cardiology referral packet for Lena Brooks.', priority: 'normal', status: 'open', due_date: iso(24), assigned_to_id: uuid(4), assigned_to_name: 'Riley Morgan', patient_id: uuid(105), patient_name: 'Lena Brooks', source_type: null, source_id: null, creator_id: uuid(1), created_at: iso(-20), updated_at: iso(-4) }),
  withDeliveryDefaults({ id: uuid(204), title: 'Scan new patient forms', description: 'Attach intake and privacy forms to chart.', priority: 'normal', status: 'completed', due_date: iso(-1), assigned_to_id: uuid(5), assigned_to_name: 'Sam Rivera', patient_id: uuid(104), patient_name: 'James Patel', source_type: null, source_id: null, creator_id: uuid(1), created_at: iso(-28), updated_at: iso(-2) }),
  withDeliveryDefaults({ id: uuid(205), title: 'Verify insurance eligibility', description: 'Sofia Nguyen coverage is missing from chart.', priority: 'high', status: 'open', due_date: iso(3), assigned_to_id: uuid(5), assigned_to_name: 'Sam Rivera', patient_id: uuid(103), patient_name: 'Sofia Nguyen', source_type: null, source_id: null, creator_id: uuid(1), created_at: iso(-10), updated_at: iso(-2) }),
];

let appointments: Appointment[] = [
  { id: uuid(301), patient_id: uuid(101), patient_name: 'Mary Collins', provider_id: uuid(2), provider_name: 'Dr. Nora Ellis', start_time: '2026-06-03T08:30:00-04:00', end_time: '2026-06-03T09:00:00-04:00', type: 'Annual wellness', status: 'checked_in', notes: 'Vitals complete.', created_at: iso(-120), updated_at: iso(-4) },
  { id: uuid(302), patient_id: uuid(102), patient_name: 'Andre Miller', provider_id: uuid(2), provider_name: 'Dr. Nora Ellis', start_time: '2026-06-03T09:00:00-04:00', end_time: '2026-06-03T09:30:00-04:00', type: 'Follow-up', status: 'in_progress', notes: 'Medication list needs review.', created_at: iso(-110), updated_at: iso(-1) },
  { id: uuid(303), patient_id: uuid(103), patient_name: 'Sofia Nguyen', provider_id: uuid(2), provider_name: 'Dr. Nora Ellis', start_time: '2026-06-03T09:30:00-04:00', end_time: '2026-06-03T10:00:00-04:00', type: 'Lab review', status: 'scheduled', notes: null, created_at: iso(-100), updated_at: iso(-12) },
  { id: uuid(304), patient_id: uuid(104), patient_name: 'James Patel', provider_id: uuid(6), provider_name: 'Dr. Omar Singh', start_time: '2026-06-03T10:00:00-04:00', end_time: '2026-06-03T10:45:00-04:00', type: 'New patient', status: 'scheduled', notes: 'Forms pending.', created_at: iso(-98), updated_at: iso(-9) },
  { id: uuid(305), patient_id: uuid(105), patient_name: 'Lena Brooks', provider_id: uuid(6), provider_name: 'Dr. Omar Singh', start_time: '2026-06-04T10:30:00-04:00', end_time: '2026-06-04T11:00:00-04:00', type: 'Medication check', status: 'scheduled', notes: null, created_at: iso(-80), updated_at: iso(-7) },
];

let faxes: Fax[] = [
  { id: uuid(401), direction: 'inbound', status: 'received', from_number: '+13125550100', to_number: '+13125550999', pages: 4, file_url: null, patient_id: uuid(101), patient_name: 'Mary Collins', matched_by: 'MRN detected', ocr_text: 'LabCorp final report. Potassium 5.9 mmol/L. Please review urgently.', created_at: iso(-1.4) },
  { id: uuid(402), direction: 'inbound', status: 'processing', from_number: '+13125550177', to_number: '+13125550999', pages: 2, file_url: null, patient_id: null, patient_name: null, matched_by: null, ocr_text: 'Referral authorization notice. Patient name partially obscured.', created_at: iso(-2.5) },
  { id: uuid(403), direction: 'outbound', status: 'sent', from_number: '+13125550999', to_number: '+13125550122', pages: 7, file_url: null, patient_id: uuid(105), patient_name: 'Lena Brooks', matched_by: 'manual', ocr_text: 'Cardiology referral packet and medication history.', created_at: iso(-24) },
  { id: uuid(404), direction: 'outbound', status: 'failed', from_number: '+13125550999', to_number: '+13125550188', pages: 3, file_url: null, patient_id: uuid(103), patient_name: 'Sofia Nguyen', matched_by: 'manual', ocr_text: 'Insurance appeal documentation.', created_at: iso(-5) },
];

let patientDocuments: PatientDocument[] = [
  {
    id: uuid(451),
    patient_id: uuid(101),
    title: 'LabCorp final report',
    source: 'LabCorp Chicago Central',
    document_type: 'Lab result',
    status: 'needs_review',
    matched_by: 'MRN detected',
    pages: 4,
    file_url: null,
    summary: 'CMP and A1c received. Potassium is flagged critical and requires same-day review.',
    received_at: '2026-06-03T10:42:00-04:00',
    created_at: iso(-1.4),
    updated_at: iso(-1.4),
  },
  {
    id: uuid(452),
    patient_id: uuid(101),
    title: 'Cardiology consult note',
    source: 'North Shore Cardiology',
    document_type: 'Consult note',
    status: 'filed',
    matched_by: 'manual',
    pages: 7,
    file_url: null,
    summary: 'Medication recommendations and follow-up EKG plan after cardiology evaluation.',
    received_at: '2026-05-28T15:16:00-04:00',
    created_at: iso(-140),
    updated_at: iso(-140),
  },
  {
    id: uuid(453),
    patient_id: uuid(101),
    title: 'Hospital discharge summary',
    source: 'Mercy Medical Center',
    document_type: 'Discharge',
    status: 'reconciled',
    matched_by: 'patient DOB + name',
    pages: 11,
    file_url: null,
    summary: 'Observation stay summary, medication changes, and discharge instructions.',
    received_at: '2026-05-22T09:04:00-04:00',
    created_at: iso(-280),
    updated_at: iso(-280),
  },
  {
    id: uuid(454),
    patient_id: uuid(105),
    title: 'Cardiology referral response',
    source: 'Lakeview Heart Group',
    document_type: 'Referral',
    status: 'received',
    matched_by: 'manual',
    pages: 3,
    file_url: null,
    summary: 'Referral accepted with suggested anticoagulation follow-up window.',
    received_at: '2026-06-02T14:20:00-04:00',
    created_at: iso(-23),
    updated_at: iso(-23),
  },
].map((document) => normalizeDocument(document as PatientDocument));

let patientMedications: PatientMedication[] = [
  { id: uuid(461), patient_id: uuid(101), name: 'Lisinopril', dose: '20 mg', directions: '1 tablet daily', source: 'Active med list', status: 'active', note: null, created_at: iso(-20), updated_at: iso(-2) },
  { id: uuid(462), patient_id: uuid(101), name: 'Metformin ER', dose: '500 mg', directions: '2 tablets with dinner', source: 'Active med list', status: 'review', note: 'Review A1c during visit.', created_at: iso(-20), updated_at: iso(-2) },
  { id: uuid(463), patient_id: uuid(101), name: 'Atorvastatin', dose: '40 mg', directions: '1 tablet nightly', source: 'Cardiology note', status: 'active', note: null, created_at: iso(-120), updated_at: iso(-120) },
  { id: uuid(464), patient_id: uuid(101), name: 'Potassium chloride', dose: '10 mEq', directions: 'Historical supplement', source: 'Discharge summary', status: 'held', note: 'Hold pending provider review.', created_at: iso(-240), updated_at: iso(-1) },
];

let patientCarePlan: PatientCarePlanItem[] = [
  { id: uuid(471), patient_id: uuid(101), assigned_to_id: uuid(2), assigned_to_name: 'Dr. Nora Ellis', owner_role: 'Provider', item: 'Review critical potassium and decide medication changes before checkout.', due: 'Today', status: 'open', escalation: 'same_day', note: null, created_at: iso(-2), updated_at: iso(-2) },
  { id: uuid(472), patient_id: uuid(101), assigned_to_id: uuid(3), assigned_to_name: 'Maya Chen, MA', owner_role: 'MA', item: 'Repeat blood pressure and reconcile outside medication list.', due: 'Before provider', status: 'in_progress', escalation: null, note: null, created_at: iso(-2), updated_at: iso(-1) },
  { id: uuid(473), patient_id: uuid(101), assigned_to_id: null, assigned_to_name: null, owner_role: 'Front desk', item: 'Schedule 3 month chronic care follow-up and confirm preferred pharmacy.', due: 'Checkout', status: 'open', escalation: null, note: null, created_at: iso(-2), updated_at: iso(-2) },
  { id: uuid(474), patient_id: uuid(101), assigned_to_id: null, assigned_to_name: null, owner_role: 'Care coordinator', item: 'Confirm cardiology follow-up was completed and request missing EKG if needed.', due: 'This week', status: 'open', escalation: null, note: null, created_at: iso(-2), updated_at: iso(-2) },
];

let patientLabs: PatientLabResult[] = [
  { id: uuid(481), patient_id: uuid(101), collected_at: '2026-06-03T08:00:00-04:00', panel: 'CMP', result: 'Potassium 5.9 mmol/L', flag: 'Critical', status: 'needs_review', source: 'LabCorp', note: null, created_at: iso(-4), updated_at: iso(-4) },
  { id: uuid(482), patient_id: uuid(101), collected_at: '2026-06-03T08:00:00-04:00', panel: 'A1c', result: '7.4%', flag: 'High', status: 'needs_review', source: 'LabCorp', note: null, created_at: iso(-4), updated_at: iso(-4) },
  { id: uuid(483), patient_id: uuid(101), collected_at: '2026-03-12T08:00:00-04:00', panel: 'Lipid panel', result: 'LDL 92 mg/dL', flag: 'Normal', status: 'filed', source: 'LabCorp', note: null, created_at: iso(-500), updated_at: iso(-500) },
];

let patientEncounters: PatientEncounter[] = [
  {
    id: uuid(491),
    patient_id: uuid(101),
    appointment_id: uuid(301),
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    encounter_type: 'Annual wellness',
    status: 'provider_review',
    summary: 'Preventive visit, medication reconciliation, and chronic condition review.',
    subjective: 'Patient reports feeling well overall with questions about recent lab alert.',
    objective: 'Vitals reviewed. Outside CMP and A1c available in chart.',
    assessment: 'Hypertension, diabetes, hyperlipidemia with potassium requiring review.',
    plan: 'Review potassium supplement, call patient with medication plan, follow up in 3 months.',
    signed_at: null,
    created_at: iso(-3),
    updated_at: iso(-1),
  },
  {
    id: uuid(492),
    patient_id: uuid(101),
    appointment_id: null,
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    encounter_type: 'Follow-up',
    status: 'signed',
    summary: 'Blood pressure improved after dose adjustment.',
    subjective: null,
    objective: null,
    assessment: null,
    plan: 'Continue medication and home BP monitoring.',
    signed_at: iso(-190),
    created_at: iso(-200),
    updated_at: iso(-190),
  },
];

let messages: Message[] = [
  { id: uuid(501), sender_id: uuid(101), sender_name: 'Mary Collins', recipient_id: uuid(1), recipient_name: 'Clinic Admin', subject: 'Lab result question', body: 'I saw a lab alert in the portal. Should I change anything before my visit?', thread_id: uuid(601), is_read: false, created_at: iso(-2) },
  { id: uuid(502), sender_id: uuid(1), sender_name: 'Clinic Admin', recipient_id: uuid(101), recipient_name: 'Mary Collins', subject: 'Lab result question', body: 'We received it and the provider is reviewing. We will call you this afternoon.', thread_id: uuid(601), is_read: true, created_at: iso(-1.5) },
  { id: uuid(503), sender_id: uuid(103), sender_name: 'Sofia Nguyen', recipient_id: uuid(1), recipient_name: 'Clinic Admin', subject: 'Medication refill', body: 'Can you send my thyroid medication refill to the usual pharmacy?', thread_id: uuid(602), is_read: false, created_at: iso(-4) },
  { id: uuid(504), sender_id: uuid(5), sender_name: 'Sam Rivera', recipient_id: uuid(1), recipient_name: 'Clinic Admin', subject: 'Front desk handoff', body: 'James Patel forms are missing insurance card images.', thread_id: uuid(603), is_read: true, created_at: iso(-6) },
];

let auditEvents: AuditEvent[] = [
  {
    id: uuid(801),
    actor_id: uuid(1),
    event_type: 'demo.workspace_ready',
    entity_type: 'workspace',
    entity_id: uuid(1),
    payload: { summary: 'Demo workspace initialized for frontend review' },
    created_at: iso(-0.25),
  },
];

let integrationEvents: IntegrationEvent[] = [
  {
    id: uuid(850),
    organization_id: 'default',
    integration: 'fax_provider',
    direction: 'outbound',
    action: 'send_document',
    status: 'failed',
    entity_type: 'fax',
    entity_id: uuid(404),
    idempotency_key: 'demo-fax-send-404',
    attempts: 1,
    error: 'Demo provider unavailable',
    payload: { to_number: '+13125550188' },
    created_at: iso(-3),
    updated_at: iso(-3),
  },
  {
    id: uuid(851),
    organization_id: 'default',
    integration: 'portal',
    direction: 'inbound',
    action: 'message.received',
    status: 'succeeded',
    entity_type: 'message',
    entity_id: uuid(501),
    idempotency_key: 'demo-portal-message-501',
    attempts: 1,
    error: null,
    payload: { subject: 'Lab result question' },
    created_at: iso(-2),
    updated_at: iso(-2),
  },
];

function readStoredDemoData(): DemoStore | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoStore) : null;
  } catch {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
    return null;
  }
}

function saveDemoData() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    DEMO_STORAGE_KEY,
    JSON.stringify({ patients, tasks, appointments, faxes, patientDocuments, patientMedications, patientCarePlan, patientLabs, patientEncounters, messages, auditEvents, integrationEvents }),
  );
}

function findDemoHandoffSource(patientId: string, sourceType: string, sourceId: string) {
  if (sourceType === 'document') {
    const source = patientDocuments.find((item) => item.patient_id === patientId && item.id === sourceId && item.status === 'needs_review');
    return source ? { title: `Review document: ${source.title}`, description: `${source.document_type} from ${source.source}; status ${source.status}.` } : null;
  }
  if (sourceType === 'medication') {
    const source = patientMedications.find((item) => item.patient_id === patientId && item.id === sourceId && ['review', 'held'].includes(item.status));
    return source ? { title: `Resolve medication: ${source.name}`, description: `${source.name} requires checkout reconciliation; status ${source.status}.` } : null;
  }
  if (sourceType === 'lab') {
    const source = patientLabs.find((item) => item.patient_id === patientId && item.id === sourceId && ['new', 'needs_review'].includes(item.status));
    return source ? { title: `Review lab: ${source.panel}`, description: `${source.panel}: ${source.result}; status ${source.status}.` } : null;
  }
  if (sourceType === 'care_plan') {
    const source = patientCarePlan.find((item) => item.patient_id === patientId && item.id === sourceId && ['open', 'in_progress', 'blocked'].includes(item.status));
    return source ? { title: source.item, description: source.note ?? `${source.owner_role} checkout work item; status ${source.status}.`, assigned_to_id: source.assigned_to_id, assigned_to_name: source.assigned_to_name } : null;
  }
  const source = patientEncounters.find((item) => item.patient_id === patientId && item.id === sourceId && ['draft', 'provider_review'].includes(item.status));
  return source ? { title: `Sign encounter: ${source.encounter_type}`, description: source.summary ?? `${source.encounter_type} is ${source.status}.`, assigned_to_id: source.provider_id, assigned_to_name: source.provider_name } : null;
}

const storedDemoData = readStoredDemoData();
if (storedDemoData) {
  patients = storedDemoData.patients;
  tasks = storedDemoData.tasks.map((task) => ({
    ...task,
    source_type: task.source_type ?? null,
    source_id: task.source_id ?? null,
    delivery_channel: task.delivery_channel ?? null,
    delivery_status: task.delivery_status ?? null,
    delivery_recipient: task.delivery_recipient ?? null,
    delivery_provider_message_id: task.delivery_provider_message_id ?? null,
    delivery_error: task.delivery_error ?? null,
    delivery_attempts: task.delivery_attempts ?? 0,
    delivered_at: task.delivered_at ?? null,
  }));
  appointments = storedDemoData.appointments;
  faxes = storedDemoData.faxes;
  patientDocuments = (storedDemoData.patientDocuments ?? patientDocuments).map(normalizeDocument);
  patientMedications = storedDemoData.patientMedications ?? patientMedications;
  patientCarePlan = storedDemoData.patientCarePlan ?? patientCarePlan;
  patientLabs = storedDemoData.patientLabs ?? patientLabs;
  patientEncounters = storedDemoData.patientEncounters ?? patientEncounters;
  messages = storedDemoData.messages;
  auditEvents = storedDemoData.auditEvents ?? auditEvents;
  integrationEvents = storedDemoData.integrationEvents ?? integrationEvents;
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function threads(): MessageThread[] {
  const grouped = new Map<string, Message[]>();
  for (const message of messages) {
    const threadId = message.thread_id ?? message.id;
    grouped.set(threadId, [...(grouped.get(threadId) ?? []), message]);
  }

  return [...grouped.entries()].map(([id, items]) => {
    const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const lastMessage = sorted[sorted.length - 1];
    const participants = new Map<string, string>();
    for (const item of sorted) {
      participants.set(item.sender_id, item.sender_name);
      participants.set(item.recipient_id, item.recipient_name);
    }
    return {
      id,
      subject: lastMessage.subject,
      participants: [...participants.entries()].map(([participantId, name]) => ({ id: participantId, name })),
      last_message: lastMessage,
      unread_count: sorted.filter((item) => !item.is_read).length,
    };
  }).sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
}

function logDemoEvent(event: Omit<AuditEvent, 'id' | 'actor_id' | 'created_at'> & { actor_id?: string | null }) {
  auditEvents = [
    {
      id: uuid(1000 + auditEvents.length),
      actor_id: event.actor_id ?? uuid(1),
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      payload: event.payload,
      created_at: new Date().toISOString(),
    },
    ...auditEvents,
  ].slice(0, 100);
}

export async function demoRequest<T>(method: string, rawPath: string, body?: unknown): Promise<T | undefined> {
  const url = new URL(rawPath, 'http://demo.local');
  const path = url.pathname.replace(/^\/api/, '');
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');

  if (method === 'GET' && path === '/health') return { status: 'ok', version: 'demo' } as T;
  if (method === 'GET' && path === '/ready') {
    return {
      status: 'ok',
      operational_status: 'degraded',
      environment: 'demo',
      checks: {
        database: { ok: true },
        redis: { ok: true },
        object_storage: { ok: true, bucket: 'concierge-os' },
      },
      integrations: {
        ehr: { ok: false, configured: false, env_var: 'EHR_API_BASE_URL', mode: 'demo' },
        fax_provider: { ok: false, configured: false, env_var: 'FAX_PROVIDER_API_KEY', mode: 'demo' },
        portal: { ok: false, configured: false, env_var: 'PORTAL_API_BASE_URL', mode: 'demo' },
        calendar: { ok: false, configured: false, env_var: 'CALENDAR_API_BASE_URL', mode: 'demo' },
        copilotkit: { ok: false, configured: false, env_var: 'COPILOTKIT_RUNTIME_URL', mode: 'demo' },
      },
    } as T;
  }

  if (method === 'GET' && path === '/integrations/events') {
    return {
      data: paginate(integrationEvents, page, pageSize),
      total: integrationEvents.length,
      page,
      page_size: pageSize,
    } as T;
  }

  if (method === 'GET' && path === '/patients/workload/checkout') {
    const openItems = patientCarePlan.filter((item) => ['open', 'in_progress', 'blocked'].includes(item.status));
    const buckets = new Map<string, WorkloadSummary['data'][number]>();
    for (const item of openItems) {
      const key = `${item.owner_role}:${item.assigned_to_id ?? 'unassigned'}`;
      const bucket = buckets.get(key) ?? {
        owner_role: item.owner_role,
        assigned_to_id: item.assigned_to_id,
        assigned_to_name: item.assigned_to_name,
        open_items: 0,
        blocked_items: 0,
        escalated_items: 0,
        source_linked_tasks: 0,
        urgent_tasks: 0,
      };
      bucket.open_items += 1;
      if (item.status === 'blocked') bucket.blocked_items += 1;
      if (item.escalation) bucket.escalated_items += 1;
      buckets.set(key, bucket);
    }
    const sourceTasks = tasks.filter((task) => task.source_type?.startsWith('checkout_handoff:') && ['open', 'in_progress'].includes(task.status));
    for (const task of sourceTasks) {
      const key = `Checkout tasks:${task.assigned_to_id ?? 'unassigned'}`;
      const bucket = buckets.get(key) ?? {
        owner_role: 'Checkout tasks',
        assigned_to_id: task.assigned_to_id,
        assigned_to_name: task.assigned_to_name,
        open_items: 0,
        blocked_items: 0,
        escalated_items: 0,
        source_linked_tasks: 0,
        urgent_tasks: 0,
      };
      bucket.source_linked_tasks += 1;
      if (task.priority === 'urgent') bucket.urgent_tasks += 1;
      buckets.set(key, bucket);
    }
    return {
      data: [...buckets.values()],
      total_open_items: openItems.length,
      unassigned_items: openItems.filter((item) => !item.assigned_to_id).length,
      source_linked_tasks: sourceTasks.length,
      urgent_tasks: sourceTasks.filter((task) => task.priority === 'urgent').length,
    } satisfies WorkloadSummary as T;
  }

  const integrationRetryMatch = path.match(/^\/integrations\/events\/([^/]+)\/retry$/);
  if (method === 'POST' && integrationRetryMatch) {
    integrationEvents = integrationEvents.map((event) =>
      event.id === integrationRetryMatch[1]
        ? { ...event, status: 'retrying', attempts: event.attempts + 1, updated_at: new Date().toISOString() }
        : event,
    );
    saveDemoData();
    return integrationEvents.find((event) => event.id === integrationRetryMatch[1]) as T;
  }

  if (method === 'GET' && path === '/audit') {
    return { data: paginate(auditEvents, page, pageSize), total: auditEvents.length, page, page_size: pageSize } as T;
  }

  if (method === 'GET' && path === '/users') {
    const role = url.searchParams.get('role');
    const data = role ? demoUsers.filter((user) => user.role === role) : demoUsers;
    return { data, total: data.length } as T;
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === 'PATCH') {
    demoUsers = demoUsers.map((user) =>
      user.id === userMatch[1]
        ? { ...user, ...(body as Partial<User>), updated_at: new Date().toISOString() }
        : user,
    );
    return demoUsers.find((user) => user.id === userMatch[1]) as T;
  }

  if (path === '/assistant/actions/follow-up-task' && method === 'POST') {
    const incoming = body as { context: string; title?: string; priority?: Task['priority']; patient_id?: string | null; due_date?: string | null };
    const patient = patients.find((item) => item.id === incoming.patient_id);
    const task: Task = withDeliveryDefaults({
      id: uuid(920 + tasks.length),
      title: incoming.title ?? `Assistant follow-up: ${patient ? `${patient.first_name} ${patient.last_name}` : incoming.context}`,
      description: `Assistant staged this from: ${incoming.context}. Confirm chart context before outreach.`,
      priority: incoming.priority ?? 'high',
      status: 'open',
      due_date: incoming.due_date ?? null,
      assigned_to_id: null,
      assigned_to_name: 'Clinic Admin',
      patient_id: incoming.patient_id ?? null,
      patient_name: patient ? `${patient.last_name}, ${patient.first_name}` : null,
      source_type: null,
      source_id: null,
      creator_id: uuid(1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    tasks = [task, ...tasks];
    logDemoEvent({
      event_type: 'assistant.task_created',
      entity_type: 'task',
      entity_id: task.id,
      payload: { title: task.title, patient_name: task.patient_name, priority: task.priority, source: 'clinical-assistant' },
    });
    saveDemoData();
    return task as T;
  }

  if (path === '/assistant/actions/portal-reply-draft' && method === 'POST') {
    const incoming = body as { recipient_id: string; subject: string; body: string; thread_id?: string; context: string };
    const message: Message = {
      id: uuid(700 + messages.length),
      sender_id: uuid(1),
      sender_name: 'Clinic Admin',
      recipient_id: incoming.recipient_id,
      recipient_name: 'Care Team',
      subject: incoming.subject,
      body: incoming.body,
      thread_id: incoming.thread_id ?? uuid(800 + messages.length),
      is_read: true,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, message];
    logDemoEvent({
      event_type: 'assistant.message_drafted',
      entity_type: 'message',
      entity_id: message.id,
      payload: { subject: message.subject, recipient_id: message.recipient_id, thread_id: message.thread_id, context: incoming.context, source: 'clinical-assistant' },
    });
    saveDemoData();
    return message as T;
  }

  if (path === '/assistant/actions/fax-match' && method === 'POST') {
    const incoming = body as { fax_id: string; patient_id: string; context: string };
    const patient = patients.find((item) => item.id === incoming.patient_id);
    faxes = faxes.map((fax) =>
      fax.id === incoming.fax_id
        ? {
            ...fax,
            patient_id: incoming.patient_id,
            patient_name: patient ? `${patient.last_name}, ${patient.first_name}` : fax.patient_name,
            matched_by: 'assistant suggested, user confirmed',
          }
        : fax,
    );
    const updated = faxes.find((fax) => fax.id === incoming.fax_id);
    if (!updated) throw new Error('Fax not found');
    logDemoEvent({
      event_type: 'assistant.fax_match_staged',
      entity_type: 'fax',
      entity_id: updated.id,
      payload: { patient_name: updated.patient_name, matched_by: updated.matched_by, pages: updated.pages, context: incoming.context, source: 'clinical-assistant' },
    });
    saveDemoData();
    return updated as T;
  }

  if (path === '/patients') {
    if (method === 'POST') {
      const incoming = body as Partial<Patient>;
      const patient: Patient = {
        id: uuid(900 + patients.length),
        mrn: `MRN-${14000 + patients.length}`,
        first_name: incoming.first_name ?? 'New',
        last_name: incoming.last_name ?? 'Patient',
        dob: incoming.dob ?? '1980-01-01',
        gender: incoming.gender ?? 'Unknown',
        phone: incoming.phone ?? null,
        email: incoming.email ?? null,
        address: null,
        emergency_contact: null,
        insurance: null,
        allergies: [],
        problem_list: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      patients = [patient, ...patients];
      logDemoEvent({
        event_type: 'patient.created',
        entity_type: 'patient',
        entity_id: patient.id,
        payload: { patient_name: `${patient.first_name} ${patient.last_name}`, source: 'demo-ui' },
      });
      saveDemoData();
      return patient as T;
    }
    const search = (url.searchParams.get('search') ?? '').toLowerCase().trim();
    const filtered = search
      ? patients.filter((patient) =>
          [patient.mrn, patient.first_name, patient.last_name, patient.email, patient.phone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        )
      : patients;
    return { data: paginate(filtered, page, pageSize), total: filtered.length, page, page_size: pageSize } as T;
  }

  const patientMatch = path.match(/^\/patients\/([^/]+)$/);
  if (patientMatch) {
    const patient = patients.find((item) => item.id === patientMatch[1]);
    if (!patient) throw new Error('Patient not found');
    if (method === 'PATCH') {
      patients = patients.map((item) =>
        item.id === patient.id ? { ...item, ...(body as PatientUpdate), updated_at: new Date().toISOString() } : item,
      );
      logDemoEvent({
        event_type: 'patient.updated',
        entity_type: 'patient',
        entity_id: patient.id,
        payload: { patient_name: `${patient.first_name} ${patient.last_name}`, source: 'demo-ui' },
      });
      saveDemoData();
      return patients.find((item) => item.id === patient.id) as T;
    }
    return patient as T;
  }

  const patientDocumentsMatch = path.match(/^\/patients\/([^/]+)\/documents$/);
  if (patientDocumentsMatch) {
    const patientId = patientDocumentsMatch[1];
    if (!patients.some((patient) => patient.id === patientId)) throw new Error('Patient not found');
    if (method === 'POST') {
      const incoming = body as Partial<PatientDocument>;
      const document: PatientDocument = normalizeDocument({
        id: uuid(980 + patientDocuments.length),
        patient_id: patientId,
        title: incoming.title ?? 'Outside document',
        source: incoming.source ?? 'Outside office',
        document_type: incoming.document_type ?? 'Clinical record',
        status: incoming.status ?? 'received',
        matched_by: incoming.matched_by ?? 'manual',
        pages: incoming.pages ?? 1,
        file_url: incoming.file_url ?? null,
        summary: incoming.summary ?? null,
        received_at: incoming.received_at ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        upload_status: incoming.upload_status ?? (incoming.file_url ? 'uploaded' : 'metadata_only'),
        ocr_status: incoming.ocr_status ?? 'not_started',
        classification: incoming.classification ?? null,
        updated_at: new Date().toISOString(),
      });
      patientDocuments = [document, ...patientDocuments];
      logDemoEvent({
        event_type: 'patient_document.created',
        entity_type: 'patient_document',
        entity_id: document.id,
        payload: { patient_id: patientId, title: document.title, source: document.source, source_mode: 'demo-ui' },
      });
      saveDemoData();
      return document as T;
    }
    const filtered = patientDocuments
      .filter((document) => document.patient_id === patientId)
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    return { data: paginate(filtered, page, pageSize), total: filtered.length, page, page_size: pageSize } as T;
  }

  const patientDocumentMatch = path.match(/^\/patients\/([^/]+)\/documents\/([^/]+)$/);
  if (patientDocumentMatch && method === 'PATCH') {
    const [patientId, documentId] = [patientDocumentMatch[1], patientDocumentMatch[2]];
    const existing = patientDocuments.find((document) => document.patient_id === patientId && document.id === documentId);
    if (!existing) throw new Error('Document not found');
    patientDocuments = patientDocuments.map((document) =>
      document.id === documentId
        ? { ...document, ...(body as Partial<PatientDocument>), updated_at: new Date().toISOString() }
        : document,
    );
    const updated = patientDocuments.find((document) => document.id === documentId);
    if (updated) {
      logDemoEvent({
        event_type: 'patient_document.updated',
        entity_type: 'patient_document',
        entity_id: updated.id,
        payload: { patient_id: patientId, title: updated.title, status: updated.status, source_mode: 'demo-ui' },
      });
    }
    saveDemoData();
    return updated as T;
  }

  const patientDocumentAccessMatch = path.match(/^\/patients\/([^/]+)\/documents\/([^/]+)\/access$/);
  if (patientDocumentAccessMatch && method === 'GET') {
    const [patientId, documentId] = [patientDocumentAccessMatch[1], patientDocumentAccessMatch[2]];
    const document = patientDocuments.find((item) => item.patient_id === patientId && item.id === documentId);
    if (!document) throw new Error('Document not found');
    return {
      document_id: document.id,
      available: Boolean(document.file_url),
      url: document.file_url,
      expires_at: document.file_url ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      reason: document.file_url ? null : 'No file URL is attached to this document yet.',
      preview_supported: Boolean(document.file_url?.toLowerCase().endsWith('.pdf')),
      content_type: document.file_url?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : null,
      viewer_mode: document.file_url ? 'inline' : 'metadata',
    } as T;
  }

  const patientDocumentProcessMatch = path.match(/^\/patients\/([^/]+)\/documents\/([^/]+)\/process$/);
  if (patientDocumentProcessMatch && method === 'POST') {
    const [patientId, documentId] = [patientDocumentProcessMatch[1], patientDocumentProcessMatch[2]];
    const document = patientDocuments.find((item) => item.patient_id === patientId && item.id === documentId);
    if (!document) throw new Error('Document not found');
    const classification = document.document_type.toLowerCase().includes('lab') ? 'lab_result' : 'clinical_record';
    patientDocuments = patientDocuments.map((item) =>
      item.id === documentId
        ? {
            ...item,
            status: 'needs_review',
            upload_status: item.file_url ? 'uploaded' : 'metadata_only',
            ocr_status: item.file_url ? 'completed' : 'not_available',
            classification,
            summary: item.summary ?? `${item.document_type} from ${item.source} was processed and needs chart review.`,
            updated_at: new Date().toISOString(),
          }
        : item,
    );
    const updated = patientDocuments.find((item) => item.id === documentId) as PatientDocument;
    saveDemoData();
    return { document: updated, created_task_id: null } as T;
  }

  const patientChartSummaryMatch = path.match(/^\/patients\/([^/]+)\/chart-summary$/);
  if (patientChartSummaryMatch && method === 'GET') {
    const patientId = patientChartSummaryMatch[1];
    if (!patients.some((patient) => patient.id === patientId)) throw new Error('Patient not found');
    const documents = patientDocuments
      .filter((document) => document.patient_id === patientId)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 5);
    const openTasks = tasks
      .filter((task) => task.patient_id === patientId && ['open', 'in_progress'].includes(task.status))
      .slice(0, 5);
    const recentFaxes = faxes
      .filter((fax) => fax.patient_id === patientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
    const upcomingAppointments = appointments
      .filter((appointment) => patientId === appointment.patient_id && ['scheduled', 'checked_in', 'in_progress'].includes(appointment.status))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 5);
    const documentsNeedingReview = patientDocuments.filter((document) => document.patient_id === patientId && document.status === 'needs_review').length;
    const urgentTasks = tasks.filter((task) => task.patient_id === patientId && task.priority === 'urgent' && ['open', 'in_progress'].includes(task.status)).length;
    const unsignedEncounters = patientEncounters.filter((encounter) => encounter.patient_id === patientId && ['draft', 'provider_review'].includes(encounter.status)).length;
    const summary: PatientChartSummary = {
      patient_id: patientId,
      checkout_readiness: documentsNeedingReview || urgentTasks || unsignedEncounters ? 'blocked' : 'ready',
      blockers: [
        ...(documentsNeedingReview ? [`${documentsNeedingReview} outside document needs review`] : []),
        ...(urgentTasks ? [`${urgentTasks} urgent task is still open`] : []),
        ...(unsignedEncounters ? [`${unsignedEncounters} encounter note needs sign-off`] : []),
      ],
      counts: {
        documents_total: patientDocuments.filter((document) => document.patient_id === patientId).length,
        documents_needing_review: documentsNeedingReview,
        open_tasks: openTasks.length,
        urgent_tasks: urgentTasks,
        recent_faxes: recentFaxes.length,
        upcoming_appointments: upcomingAppointments.length,
        unsigned_encounters: unsignedEncounters,
      },
      documents,
      open_tasks: openTasks,
      recent_faxes: recentFaxes,
      upcoming_appointments: upcomingAppointments,
    };
    return summary as T;
  }

  const patientCheckoutHandoffMatch = path.match(/^\/patients\/([^/]+)\/checkout-handoff$/);
  if (patientCheckoutHandoffMatch && method === 'GET') {
    const patientId = patientCheckoutHandoffMatch[1];
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) throw new Error('Patient not found');
    const chartSummary = await demoRequest<PatientChartSummary>('GET', `/patients/${patientId}/chart-summary`);
    if (!chartSummary) throw new Error('Chart summary not found');
    const handoff: PatientCheckoutHandoff = {
      patient,
      chart_summary: chartSummary,
      documents_needing_review: patientDocuments.filter((document) => document.patient_id === patientId && document.status === 'needs_review'),
      medications_needing_review: patientMedications.filter((medication) => medication.patient_id === patientId && ['review', 'held'].includes(medication.status)),
      labs_needing_review: patientLabs.filter((lab) => lab.patient_id === patientId && ['new', 'needs_review'].includes(lab.status)),
      care_plan_open_items: patientCarePlan.filter((item) => item.patient_id === patientId && ['open', 'in_progress', 'blocked'].includes(item.status)),
      unsigned_encounters: patientEncounters.filter((encounter) => encounter.patient_id === patientId && ['draft', 'provider_review'].includes(encounter.status)),
    };
    return handoff as T;
  }

  const patientCheckoutHandoffTaskMatch = path.match(/^\/patients\/([^/]+)\/checkout-handoff\/tasks$/);
  if (patientCheckoutHandoffTaskMatch && method === 'POST') {
    const patientId = patientCheckoutHandoffTaskMatch[1];
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) throw new Error('Patient not found');
    const incoming = body as Partial<Task> & { source_type?: string; source_id?: string };
    if (!incoming.source_type || !incoming.source_id) throw new Error('Checkout handoff source not found');
    const sourceType = `checkout_handoff:${incoming.source_type}`;
    const existing = tasks.find((task) =>
      task.patient_id === patientId
      && task.source_type === sourceType
      && task.source_id === incoming.source_id
      && ['open', 'in_progress'].includes(task.status),
    );
    if (existing) return existing as T;
    const source = findDemoHandoffSource(patientId, incoming.source_type, incoming.source_id);
    if (!source) throw new Error('Checkout handoff source not found');
    const task: Task = withDeliveryDefaults({
      id: uuid(920 + tasks.length),
      title: incoming.title ?? source.title,
      description: incoming.description ?? source.description,
      priority: incoming.priority ?? 'high',
      status: 'open',
      due_date: null,
      assigned_to_id: source.assigned_to_id ?? null,
      assigned_to_name: source.assigned_to_name ?? null,
      patient_id: patientId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      source_type: sourceType,
      source_id: incoming.source_id,
      creator_id: uuid(1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    tasks = [task, ...tasks];
    logDemoEvent({
      event_type: 'checkout_handoff.task_created',
      entity_type: 'task',
      entity_id: task.id,
      payload: { patient_id: patientId, source_type: incoming.source_type, source_id: incoming.source_id },
    });
    saveDemoData();
    return task as T;
  }

  const patientEncountersMatch = path.match(/^\/patients\/([^/]+)\/encounters$/);
  if (patientEncountersMatch && method === 'GET') {
    const patientId = patientEncountersMatch[1];
    const data = patientEncounters.filter((encounter) => encounter.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientEncounterMatch = path.match(/^\/patients\/([^/]+)\/encounters\/([^/]+)$/);
  if (patientEncounterMatch && method === 'PATCH') {
    const [patientId, encounterId] = [patientEncounterMatch[1], patientEncounterMatch[2]];
    patientEncounters = patientEncounters.map((encounter) =>
      encounter.patient_id === patientId && encounter.id === encounterId
        ? {
            ...encounter,
            ...(body as Partial<PatientEncounter>),
            signed_at: (body as Partial<PatientEncounter>).status === 'signed' ? new Date().toISOString() : encounter.signed_at,
            updated_at: new Date().toISOString(),
          }
        : encounter,
    );
    saveDemoData();
    return patientEncounters.find((encounter) => encounter.id === encounterId) as T;
  }

  const patientMedicationsMatch = path.match(/^\/patients\/([^/]+)\/medications$/);
  if (patientMedicationsMatch && method === 'GET') {
    const patientId = patientMedicationsMatch[1];
    const data = patientMedications.filter((medication) => medication.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientMedicationMatch = path.match(/^\/patients\/([^/]+)\/medications\/([^/]+)$/);
  if (patientMedicationMatch && method === 'PATCH') {
    const [patientId, medicationId] = [patientMedicationMatch[1], patientMedicationMatch[2]];
    patientMedications = patientMedications.map((medication) =>
      medication.patient_id === patientId && medication.id === medicationId
        ? { ...medication, ...(body as Partial<PatientMedication>), updated_at: new Date().toISOString() }
        : medication,
    );
    saveDemoData();
    return patientMedications.find((medication) => medication.id === medicationId) as T;
  }

  const patientCarePlanMatch = path.match(/^\/patients\/([^/]+)\/care-plan$/);
  if (patientCarePlanMatch && method === 'GET') {
    const patientId = patientCarePlanMatch[1];
    const data = patientCarePlan.filter((item) => item.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientCarePlanItemMatch = path.match(/^\/patients\/([^/]+)\/care-plan\/([^/]+)$/);
  if (patientCarePlanItemMatch && method === 'PATCH') {
    const [patientId, itemId] = [patientCarePlanItemMatch[1], patientCarePlanItemMatch[2]];
    patientCarePlan = patientCarePlan.map((item) =>
      item.patient_id === patientId && item.id === itemId
        ? { ...item, ...(body as Partial<PatientCarePlanItem>), updated_at: new Date().toISOString() }
        : item,
    );
    saveDemoData();
    return patientCarePlan.find((item) => item.id === itemId) as T;
  }

  const patientLabsMatch = path.match(/^\/patients\/([^/]+)\/labs$/);
  if (patientLabsMatch && method === 'GET') {
    const patientId = patientLabsMatch[1];
    const data = patientLabs.filter((lab) => lab.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientLabMatch = path.match(/^\/patients\/([^/]+)\/labs\/([^/]+)$/);
  if (patientLabMatch && method === 'PATCH') {
    const [patientId, labId] = [patientLabMatch[1], patientLabMatch[2]];
    patientLabs = patientLabs.map((lab) =>
      lab.patient_id === patientId && lab.id === labId
        ? { ...lab, ...(body as Partial<PatientLabResult>), updated_at: new Date().toISOString() }
        : lab,
    );
    saveDemoData();
    return patientLabs.find((lab) => lab.id === labId) as T;
  }

  if (path === '/tasks') {
    if (method === 'POST') {
      const incoming = body as Partial<Task>;
      const task: Task = withDeliveryDefaults({
        id: uuid(920 + tasks.length),
        title: incoming.title ?? 'New task',
        description: incoming.description ?? null,
        priority: incoming.priority ?? 'normal',
        status: incoming.status ?? 'open',
        due_date: incoming.due_date ?? null,
        assigned_to_id: null,
        assigned_to_name: incoming.assigned_to_name ?? 'Clinic Admin',
        patient_id: incoming.patient_id ?? null,
        patient_name: incoming.patient_name ?? null,
        source_type: incoming.source_type ?? null,
        source_id: incoming.source_id ?? null,
        creator_id: uuid(1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      tasks = [task, ...tasks];
      logDemoEvent({
        event_type: incoming.description?.includes('Assistant staged') ? 'assistant.task_created' : 'task.created',
        entity_type: 'task',
        entity_id: task.id,
        payload: {
          title: task.title,
          patient_name: task.patient_name,
          priority: task.priority,
          source: incoming.description?.includes('Assistant staged') ? 'clinical-assistant' : 'demo-ui',
        },
      });
      saveDemoData();
      return task as T;
    }
    const status = url.searchParams.get('status');
    const filtered = status ? tasks.filter((task) => task.status === status) : tasks;
    return { data: paginate(filtered, page, pageSize), total: filtered.length, page, page_size: pageSize } as T;
  }

  const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
  const taskOutreachMatch = path.match(/^\/tasks\/([^/]+)\/patient-outreach$/);
  if (taskOutreachMatch && method === 'POST') {
    const task = tasks.find((item) => item.id === taskOutreachMatch[1]);
    const patient = patients.find((item) => item.id === task?.patient_id);
    if (!task || !patient) throw new Error('Patient task not found');
    return {
      task_id: task.id,
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_email: patient.email,
      patient_phone: patient.phone,
      subject: `Follow-up from your care team: ${task.title}`,
      body: `Hi ${patient.first_name},\n\nYour care team is following up on an item from your visit. We are reviewing: ${task.title}.\n\nPlease contact the office if you have new symptoms, medication changes, or questions before we reach you.\n\nThank you,\nYour care team`,
    } as T;
  }

  const taskOutreachDeliverMatch = path.match(/^\/tasks\/([^/]+)\/patient-outreach\/deliver$/);
  if (taskOutreachDeliverMatch && method === 'POST') {
    const task = tasks.find((item) => item.id === taskOutreachDeliverMatch[1]);
    const patient = patients.find((item) => item.id === task?.patient_id);
    if (!task || !patient) throw new Error('Patient task not found');
    const incoming = body as { channel: 'sms' | 'email'; subject: string; body: string };
    const recipient = incoming.channel === 'sms' ? patient.phone : patient.email;
    const deliveryStatus = recipient ? 'queued' : 'blocked';
    tasks = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            delivery_channel: incoming.channel,
            delivery_status: deliveryStatus,
            delivery_recipient: recipient,
            delivery_provider_message_id: `pending-${task.id}`,
            delivery_error: recipient ? null : `No ${incoming.channel} recipient is available for this patient.`,
            delivery_attempts: item.delivery_attempts + 1,
            updated_at: new Date().toISOString(),
          }
        : item,
    );
    logDemoEvent({
      event_type: 'patient_outreach.staged',
      entity_type: 'task',
      entity_id: task.id,
      payload: { patient_id: patient.id, channel: incoming.channel, recipient, subject: incoming.subject, delivery_status: deliveryStatus },
    });
    saveDemoData();
    return {
      task_id: task.id,
      patient_id: patient.id,
      channel: incoming.channel,
      delivery_status: deliveryStatus,
      recipient,
      subject: incoming.subject,
      provider_message_id: `pending-${task.id}`,
      attempts: task.delivery_attempts + 1,
    } as T;
  }

  if (taskMatch && method === 'PATCH') {
    const previous = tasks.find((task) => task.id === taskMatch[1]);
    const incoming = body as Partial<Task>;
    const assignee = incoming.assigned_to_id === null
      ? null
      : incoming.assigned_to_id
        ? demoUsers.find((user) => user.id === incoming.assigned_to_id)
        : undefined;
    tasks = tasks.map((task) =>
      task.id === taskMatch[1]
        ? {
            ...task,
            ...incoming,
            assigned_to_name: assignee === null ? null : assignee?.display_name ?? task.assigned_to_name,
            updated_at: new Date().toISOString(),
          }
        : task,
    );
    const updated = tasks.find((task) => task.id === taskMatch[1]);
    if (updated) {
      logDemoEvent({
        event_type: 'task.updated',
        entity_type: 'task',
        entity_id: updated.id,
        payload: { title: updated.title, previous_status: previous?.status, status: updated.status, source: 'demo-ui' },
      });
    }
    saveDemoData();
    return tasks.find((task) => task.id === taskMatch[1]) as T;
  }

  if (path === '/schedule/appointments') {
    return { data: appointments, total: appointments.length } as T;
  }

  if (path === '/schedule/today-queue') {
    const data = appointments.map((appointment) => {
      const documentsNeedingReview = patientDocuments.filter((document) => document.patient_id === appointment.patient_id && document.status === 'needs_review').length;
      const openTasks = tasks.filter((task) => task.patient_id === appointment.patient_id && ['open', 'in_progress'].includes(task.status));
      const urgentTasks = openTasks.filter((task) => task.priority === 'urgent').length;
      const unsignedEncounters = patientEncounters.filter((encounter) => encounter.patient_id === appointment.patient_id && ['draft', 'provider_review'].includes(encounter.status)).length;
      return {
        appointment,
        checkout_readiness: (documentsNeedingReview || urgentTasks || unsignedEncounters ? 'blocked' : 'ready') as TodayQueue['data'][number]['checkout_readiness'],
        blockers: [
          ...(documentsNeedingReview ? [`${documentsNeedingReview} outside document needs review`] : []),
          ...(urgentTasks ? [`${urgentTasks} urgent task is still open`] : []),
          ...(unsignedEncounters ? [`${unsignedEncounters} encounter note needs sign-off`] : []),
        ],
        documents_needing_review: documentsNeedingReview,
        open_tasks: openTasks.length,
        urgent_tasks: urgentTasks,
        unsigned_encounters: unsignedEncounters,
      };
    });
    return {
      data,
      total: data.length,
      checked_in: data.filter((item) => ['checked_in', 'roomed', 'provider_review', 'checkout', 'in_progress'].includes(item.appointment.status)).length,
      blocked: data.filter((item) => item.checkout_readiness === 'blocked').length,
    } satisfies TodayQueue as T;
  }

  if ((path === '/schedule' || path === '/schedule/appointments') && method === 'POST') {
    const appointment = {
      id: uuid(940),
      patient_id: uuid(104),
      patient_name: 'New Patient',
      provider_id: uuid(2),
      provider_name: 'Dr. Nora Ellis',
      start_time: '2026-06-05T11:00:00-04:00',
      end_time: '2026-06-05T11:30:00-04:00',
      type: 'Office visit',
      status: 'scheduled',
      notes: null,
      ...(body as Partial<Appointment>),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Appointment;
    appointments = [...appointments, appointment];
    logDemoEvent({
      event_type: 'appointment.created',
      entity_type: 'appointment',
      entity_id: appointment.id,
      payload: { patient_name: appointment.patient_name, start_time: appointment.start_time, source: 'demo-ui' },
    });
    saveDemoData();
    return appointment as T;
  }

  const appointmentMatch = path.match(/^\/schedule\/appointments\/([^/]+)$/);
  if (appointmentMatch && method === 'PATCH') {
    const incoming = body as Partial<Appointment>;
    const appointment = appointments.find((item) => item.id === appointmentMatch[1]);
    if (appointment && incoming.status === 'completed') {
      const documentsNeedingReview = patientDocuments.filter((document) => document.patient_id === appointment.patient_id && document.status === 'needs_review').length;
      const urgentTasks = tasks.filter((task) => task.patient_id === appointment.patient_id && task.priority === 'urgent' && ['open', 'in_progress'].includes(task.status)).length;
      const unsignedEncounters = patientEncounters.filter((encounter) => encounter.patient_id === appointment.patient_id && ['draft', 'provider_review'].includes(encounter.status)).length;
      if (documentsNeedingReview || urgentTasks || unsignedEncounters) {
        throw new Error('Chart blockers must be resolved before completion');
      }
    }
    appointments = appointments.map((appointment) =>
      appointment.id === appointmentMatch[1]
        ? { ...appointment, ...incoming, updated_at: new Date().toISOString() }
        : appointment,
    );
    saveDemoData();
    return appointments.find((appointment) => appointment.id === appointmentMatch[1]) as T;
  }

  if (path === '/faxes') {
    if (method === 'POST') {
      const incoming = body as Partial<Fax>;
      const fax: Fax = {
        id: uuid(960 + faxes.length),
        direction: 'outbound',
        status: 'pending',
        from_number: '+13125550999',
        to_number: incoming.to_number ?? '+13125550000',
        pages: incoming.pages ?? 1,
        file_url: null,
        patient_id: incoming.patient_id ?? null,
        patient_name: incoming.patient_name ?? null,
        matched_by: incoming.patient_id ? 'manual' : null,
        ocr_text: incoming.ocr_text ?? 'Queued outbound fax.',
        created_at: new Date().toISOString(),
      };
      faxes = [fax, ...faxes];
      logDemoEvent({
        event_type: 'fax.created',
        entity_type: 'fax',
        entity_id: fax.id,
        payload: { direction: fax.direction, patient_name: fax.patient_name, pages: fax.pages, source: 'demo-ui' },
      });
      saveDemoData();
      return fax as T;
    }
    const direction = url.searchParams.get('direction');
    const filtered = direction ? faxes.filter((fax) => fax.direction === direction) : faxes;
    return { data: paginate(filtered, page, pageSize), total: filtered.length, page, page_size: pageSize } as T;
  }

  const faxMatch = path.match(/^\/faxes\/([^/]+)$/);
  if (faxMatch && method === 'PATCH') {
    faxes = faxes.map((fax) =>
      fax.id === faxMatch[1] ? { ...fax, ...(body as Partial<Fax>) } : fax,
    );
    const updated = faxes.find((fax) => fax.id === faxMatch[1]);
    if (updated) {
      logDemoEvent({
        event_type: updated.matched_by?.includes('assistant') ? 'assistant.fax_match_staged' : 'fax.updated',
        entity_type: 'fax',
        entity_id: updated.id,
        payload: {
          patient_name: updated.patient_name,
          matched_by: updated.matched_by,
          pages: updated.pages,
          source: updated.matched_by?.includes('assistant') ? 'clinical-assistant' : 'demo-ui',
        },
      });
    }
    saveDemoData();
    return faxes.find((fax) => fax.id === faxMatch[1]) as T;
  }

  if (path === '/messages/threads') {
    const data = threads();
    return { data, total: data.length } as T;
  }

  const threadMatch = path.match(/^\/messages\/threads\/([^/]+)$/);
  if (threadMatch) {
    return messages.filter((message) => message.thread_id === threadMatch[1]) as T;
  }

  if (path === '/messages' && method === 'POST') {
    const incoming = body as { recipient_id: string; subject: string; body: string; thread_id?: string };
    const message: Message = {
      id: uuid(700 + messages.length),
      sender_id: uuid(1),
      sender_name: 'Clinic Admin',
      recipient_id: incoming.recipient_id,
      recipient_name: 'Care Team',
      subject: incoming.subject,
      body: incoming.body,
      thread_id: incoming.thread_id ?? uuid(800 + messages.length),
      is_read: true,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, message];
    logDemoEvent({
      event_type: incoming.body.includes('your care team is reviewing') ? 'assistant.message_drafted' : 'message.created',
      entity_type: 'message',
      entity_id: message.id,
      payload: {
        subject: message.subject,
        recipient_id: message.recipient_id,
        thread_id: message.thread_id,
        source: incoming.body.includes('your care team is reviewing') ? 'clinical-assistant' : 'demo-ui',
      },
    });
    saveDemoData();
    return message as T;
  }

  return undefined;
}
