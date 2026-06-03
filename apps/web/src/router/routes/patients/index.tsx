import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Patient } from '@concierge-os/shared';
import { Search, Plus, X } from 'lucide-react';

interface PatientListResponse {
  data: Patient[];
  total: number;
  page: number;
  page_size: number;
}

export const Route = createFileRoute('/patients/')({
  component: PatientListPage,
});

function PatientListPage() {
  const api = useApi();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, search, page],
    queryFn: () => api.get<PatientListResponse>(`/patients?search=${encodeURIComponent(search)}&page=${page}&page_size=20`),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Patient>('/patients', newPatient),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
      setShowNewPatient(false);
      setNewPatient({ first_name: '', last_name: '', dob: '', gender: '', phone: '', email: '' });
      navigate({ to: '/patients/$patientId', params: { patientId: patient.id } });
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Patients</h1>
        <button onClick={() => setShowNewPatient(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          <Plus className="h-4 w-4" />
          New Patient
        </button>
      </div>

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
              {[
                ['first_name', 'First name', 'text'],
                ['last_name', 'Last name', 'text'],
                ['dob', 'Date of birth', 'date'],
                ['gender', 'Gender', 'text'],
                ['phone', 'Phone', 'tel'],
                ['email', 'Email', 'email'],
              ].map(([key, label, type]) => (
                <label key={key} className="text-sm font-medium text-clinic-700">
                  {label}
                  <input
                    type={type}
                    required={['first_name', 'last_name', 'dob', 'gender'].includes(key)}
                    value={newPatient[key as keyof typeof newPatient]}
                    onChange={(event) => setNewPatient({ ...newPatient, [key]: event.target.value })}
                    className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </label>
              ))}
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
