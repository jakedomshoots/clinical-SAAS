import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES, QUERY_KEYS } from '@concierge-os/shared';
import type { Patient, PatientUpdate } from '@concierge-os/shared';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Check,
  X,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Heart,
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

function PatientChartPage() {
  const { patientId } = Route.useParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('demographics');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const { data: patient, isLoading } = useQuery({
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
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-clinic-400" />
      </div>
    );
  }

  if (!patient) {
    return <div className="py-12 text-center text-clinic-500">Patient not found</div>;
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
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Check className="h-4 w-4" />
                  Save
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

      {activeTab !== 'demographics' && (
        <div className="rounded-lg border border-clinic-200 bg-white p-6">
          <p className="text-center text-clinic-400 py-8">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} module coming soon
          </p>
        </div>
      )}
    </div>
  );
}
