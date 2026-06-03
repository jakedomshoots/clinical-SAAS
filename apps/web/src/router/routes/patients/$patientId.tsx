import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared'
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Patient, PatientUpdate } from '@concierge-os/shared';
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Heart,
  ClipboardList,
  FileText,
  MessageSquare,
  TestTube2,
} from 'lucide-react';

export const Route = createFileRoute('/patients/$patientId')({
  component: PatientChartPage,
});

type Tab = 'demographics' | 'encounters' | 'labs' | 'tasks' | 'messages';
const TABS: { key: Tab; label: string }[] = [
  { key: 'demographics', label: 'Demographics' },
  { key: 'encounters', label: 'Encounters' },
  { key: 'labs', label: 'Labs' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'messages', label: 'Messages' },
];

const encounterRows = [
  { date: '2026-06-03', type: 'Annual wellness', provider: 'Dr. Nora Ellis', status: 'Open note', summary: 'Preventive visit, medication reconciliation, chronic condition review.' },
  { date: '2026-03-14', type: 'Follow-up', provider: 'Dr. Nora Ellis', status: 'Signed', summary: 'Blood pressure improved after dose adjustment.' },
  { date: '2025-12-08', type: 'Telehealth', provider: 'Dr. Omar Singh', status: 'Signed', summary: 'Reviewed home glucose readings and nutrition plan.' },
];

const labRows = [
  { date: '2026-06-03', panel: 'CMP', result: 'Potassium 5.9 mmol/L', flag: 'Critical', status: 'Needs review' },
  { date: '2026-06-03', panel: 'A1c', result: '7.4%', flag: 'High', status: 'Discuss today' },
  { date: '2026-03-12', panel: 'Lipid panel', result: 'LDL 92 mg/dL', flag: 'Normal', status: 'Filed' },
];

const patientTasks = [
  { title: 'Call with potassium result', owner: 'Maya Chen, MA', due: 'Today 2:00 PM', priority: 'Urgent' },
  { title: 'Reconcile medication list', owner: 'Dr. Nora Ellis', due: 'Before checkout', priority: 'High' },
  { title: 'Schedule 3 month follow-up', owner: 'Front desk', due: 'Today', priority: 'Normal' },
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
  const [activeTab, setActiveTab] = useState<Tab>('demographics');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: patient, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.PATIENT(patientId),
    queryFn: () => api.get<Patient>(ROUTES.PATIENT(patientId)),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PatientUpdate) => api.patch<Patient>(ROUTES.PATIENT(patientId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENT(patientId) });
      setEditing(false);
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

      <div className="mb-6 flex gap-0 border-b border-clinic-200">
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
              <div key={`${encounter.date}-${encounter.type}`} className="grid gap-3 px-4 py-3 md:grid-cols-[8rem_1fr_10rem]">
                <div className="font-mono text-xs text-clinic-500">{encounter.date}</div>
                <div>
                  <div className="text-sm font-semibold text-clinic-900">{encounter.type}</div>
                  <div className="mt-1 text-sm text-clinic-600">{encounter.summary}</div>
                  <div className="mt-1 text-xs text-clinic-500">{encounter.provider}</div>
                </div>
                <div>
                  <span className="inline-flex rounded-md border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">
                    {encounter.status}
                  </span>
                </div>
              </div>
            ))}
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
                <tr key={`${lab.date}-${lab.panel}`} className="border-b border-clinic-100 last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-clinic-500">{lab.date}</td>
                  <td className="px-4 py-3 font-medium text-clinic-900">{lab.panel}</td>
                  <td className="px-4 py-3 text-clinic-700">{lab.result}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${lab.flag === 'Critical' ? 'bg-red-100 text-red-700' : lab.flag === 'High' ? 'bg-amber-100 text-amber-700' : 'bg-accent-100 text-accent-700'}`}>
                      {lab.flag}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-clinic-600">{lab.status}</td>
                </tr>
              ))}
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
            {patientTasks.map((task) => (
              <div key={task.title} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_10rem_8rem_7rem]">
                <div className="text-sm font-medium text-clinic-900">{task.title}</div>
                <div className="text-sm text-clinic-600">{task.owner}</div>
                <div className="text-sm text-clinic-600">{task.due}</div>
                <div className="text-sm font-medium text-clinic-700">{task.priority}</div>
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
    </div>
  );
}
