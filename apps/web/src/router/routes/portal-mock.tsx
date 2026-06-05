import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Send } from 'lucide-react';
import { useState } from 'react';
import { ROUTES, type PatientDocumentUploadPrepareResult, type PatientListResponse, type PortalIntakeSubmission, type UserListResponse } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';

export const Route = createFileRoute('/portal-mock')({
  component: PortalMockPage,
});

function PortalMockPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: patients } = useQuery({
    queryKey: [...QUERY_KEYS.PATIENTS, 'portal-mock'],
    queryFn: () => api.get<PatientListResponse>(`${ROUTES.PATIENTS}?page=1&page_size=100`),
  });
  const { data: providers } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'portal-mock-providers'],
    queryFn: () => api.get<UserListResponse>(`${ROUTES.USERS}?role=provider`),
  });
  const [form, setForm] = useState({
    patient_id: '',
    provider_id: '',
    phone: '(312) 555-0199',
    email: 'patient.portal@example.test',
    insurance_provider: 'BlueCross',
    member_id: 'BC-PORTAL-001',
    visit_reason: 'Follow-up request from patient portal',
    appointment_date: '2026-06-05',
    appointment_time: '11:00',
    document_title: 'Outside office consult note',
    document_source: 'Northside Specialty Clinic',
  });
  const [uploadPrep, setUploadPrep] = useState<PatientDocumentUploadPrepareResult | null>(null);

  const submitMutation = useMutation({
    mutationFn: (request_type: string) => api.post<PortalIntakeSubmission>(ROUTES.PORTAL_INTAKE, {
      patient_id: form.patient_id || null,
      source: 'portal_mock',
      request_type,
      submitted_payload: {
        phone: form.phone,
        email: form.email,
        reason: form.visit_reason,
        insurance: { provider: form.insurance_provider, member_id: form.member_id },
        provider_id: form.provider_id || providers?.data[0]?.id,
        start_time: `${form.appointment_date}T${form.appointment_time}:00`,
        end_time: `${form.appointment_date}T${String(Number(form.appointment_time.slice(0, 2)) + 1).padStart(2, '0')}:${form.appointment_time.slice(3)}:00`,
        type: 'Portal request',
        title: form.document_title,
        source: form.document_source,
        document_type: 'Outside record',
        pages: 4,
        summary: 'Patient-submitted document ready for chart review.',
      },
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PORTAL_INTAKE }),
  });
  const uploadPrepMutation = useMutation({
    mutationFn: () => api.post<PatientDocumentUploadPrepareResult>(ROUTES.PATIENT_DOCUMENT_UPLOAD(form.patient_id), {
      filename: `${form.document_title.replaceAll(' ', '-').toLowerCase()}.pdf`,
      content_type: 'application/pdf',
    }),
    onSuccess: (result) => setUploadPrep(result),
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Patient portal simulator</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Portal Mock</h1>
      </header>
      <section className="rounded-md border border-clinic-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <select value={form.patient_id} onChange={(event) => setForm({ ...form, patient_id: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm">
            <option value="">Unmatched patient</option>
            {(patients?.data ?? []).map((patient) => <option key={patient.id} value={patient.id}>{patient.last_name}, {patient.first_name}</option>)}
          </select>
          <select value={form.provider_id} onChange={(event) => setForm({ ...form, provider_id: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm">
            <option value="">Default provider</option>
            {(providers?.data ?? []).map((provider) => <option key={provider.id} value={provider.id}>{provider.display_name}</option>)}
          </select>
          <input value={form.visit_reason} onChange={(event) => setForm({ ...form, visit_reason: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.insurance_provider} onChange={(event) => setForm({ ...form, insurance_provider: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.member_id} onChange={(event) => setForm({ ...form, member_id: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input type="date" value={form.appointment_date} onChange={(event) => setForm({ ...form, appointment_date: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input type="time" value={form.appointment_time} onChange={(event) => setForm({ ...form, appointment_time: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.document_title} onChange={(event) => setForm({ ...form, document_title: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
          <input value={form.document_source} onChange={(event) => setForm({ ...form, document_source: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => submitMutation.mutate('intake_form')} className="inline-flex items-center gap-2 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">
            <Send className="h-4 w-4" />
            Send intake
          </button>
          <button onClick={() => submitMutation.mutate('appointment_request')} className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">Request appointment</button>
          <button onClick={() => submitMutation.mutate('document_upload')} className="inline-flex items-center gap-2 rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">
            <FileUp className="h-4 w-4" />
            Send document
          </button>
          <button disabled={!form.patient_id} onClick={() => uploadPrepMutation.mutate()} className="rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">Prepare upload</button>
        </div>
        {uploadPrep && (
          <div className="mt-4 rounded-md border border-clinic-200 bg-clinic-50 p-3">
            <div className="text-xs font-semibold text-clinic-700">Prepared upload</div>
            <div className="mt-2 break-all font-mono text-xs text-clinic-500">{uploadPrep.file_url}</div>
            <div className="mt-1 text-xs text-clinic-500">Expires {new Date(uploadPrep.expires_at).toLocaleString()}</div>
          </div>
        )}
      </section>
    </div>
  );
}
