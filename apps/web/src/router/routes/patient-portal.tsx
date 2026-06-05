import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Activity, CalendarClock, FileUp, Send } from 'lucide-react';
import { ROUTES, type PatientDocument, type PatientDocumentUploadPrepareResult, type PortalIntakeSubmission } from '@concierge-os/shared';
import { DEMO_MODE_ENABLED, createApiClient } from '@/lib/api-client';

export const Route = createFileRoute('/patient-portal')({
  component: PatientPortalPage,
});

interface PortalPatient {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  organization_id: string;
}

interface PortalLoginResponse {
  access_token: string;
  token_type: string;
  patient: PortalPatient;
}

function PatientPortalPage() {
  const [token, setToken] = useState('');
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [loginForm, setLoginForm] = useState({
    email: DEMO_MODE_ENABLED ? 'mary.collins@example.test' : '',
    dob: DEMO_MODE_ENABLED ? '1961-04-18' : '',
    access_code: DEMO_MODE_ENABLED ? 'demo-portal-code' : '',
  });
  const [request, setRequest] = useState({
    reason: 'I need help reviewing an outside note.',
    appointment_date: '2026-06-05',
    appointment_time: '11:00',
    document_title: 'Outside consult note',
    document_source: 'Northside Specialty Clinic',
  });
  const [lastAction, setLastAction] = useState('');
  const api = createApiClient(token || null);

  const loginMutation = useMutation({
    mutationFn: () => createApiClient(null).post<PortalLoginResponse>(ROUTES.PORTAL_AUTH_LOGIN, loginForm),
    onSuccess: (result) => {
      setToken(result.access_token);
      setPatient(result.patient);
      setLastAction('Signed in to patient portal.');
    },
  });

  const intakeMutation = useMutation({
    mutationFn: (request_type: 'intake_form' | 'appointment_request') => {
      const start = `${request.appointment_date}T${request.appointment_time}:00`;
      const endHour = String(Number(request.appointment_time.slice(0, 2)) + 1).padStart(2, '0');
      return api.post<PortalIntakeSubmission>(ROUTES.PORTAL_PATIENT_INTAKE, {
        request_type,
        submitted_payload: {
          reason: request.reason,
          start_time: start,
          end_time: `${request.appointment_date}T${endHour}:${request.appointment_time.slice(3)}:00`,
          type: 'Patient portal request',
        },
      });
    },
    onSuccess: (_, type) => setLastAction(type === 'appointment_request' ? 'Appointment request sent.' : 'Intake update sent.'),
  });

  const documentMutation = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error('Portal patient missing');
      const prepared = await api.post<PatientDocumentUploadPrepareResult>(ROUTES.PORTAL_PATIENT_DOCUMENT_UPLOAD, {
        filename: `${request.document_title.replaceAll(' ', '-').toLowerCase()}.pdf`,
        content_type: 'application/pdf',
      });
      return api.post<PatientDocument>(ROUTES.PORTAL_PATIENT_DOCUMENT_UPLOAD_CONFIRM, {
        title: request.document_title,
        source: request.document_source,
        document_type: 'Outside record',
        file_url: prepared.file_url,
        filename: `${request.document_title.replaceAll(' ', '-').toLowerCase()}.pdf`,
        content_type: 'application/pdf',
        checksum: `portal-${Date.now()}`,
        pages: 4,
        upload_token: prepared.upload_token,
      });
    },
    onSuccess: () => setLastAction('Document uploaded for review.'),
  });

  return (
    <div className="min-h-screen bg-clinic-50">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-accent-200 bg-accent-50">
            <Activity className="h-5 w-5 text-accent-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-clinic-900">Patient Portal</h1>
            <p className="text-sm text-clinic-500">{patient ? `${patient.first_name} ${patient.last_name}` : 'Secure patient access'}</p>
          </div>
        </header>

        {!patient ? (
          <form onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }} className="rounded-md border border-clinic-200 bg-white p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              <input type="date" value={loginForm.dob} onChange={(event) => setLoginForm({ ...loginForm, dob: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              <input type="password" value={loginForm.access_code} onChange={(event) => setLoginForm({ ...loginForm, access_code: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" placeholder="Access code" />
            </div>
            <button className="mt-3 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">Sign in</button>
          </form>
        ) : (
          <section className="space-y-4">
            <div className="rounded-md border border-clinic-200 bg-white p-4">
              <textarea value={request.reason} onChange={(event) => setRequest({ ...request, reason: event.target.value })} className="min-h-24 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => intakeMutation.mutate('intake_form')} className="inline-flex items-center gap-2 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">
                  <Send className="h-4 w-4" />
                  Send update
                </button>
              </div>
            </div>
            <div className="rounded-md border border-clinic-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input type="date" value={request.appointment_date} onChange={(event) => setRequest({ ...request, appointment_date: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                <input type="time" value={request.appointment_time} onChange={(event) => setRequest({ ...request, appointment_time: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={() => intakeMutation.mutate('appointment_request')} className="mt-3 inline-flex items-center gap-2 rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">
                <CalendarClock className="h-4 w-4" />
                Request appointment
              </button>
            </div>
            <div className="rounded-md border border-clinic-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={request.document_title} onChange={(event) => setRequest({ ...request, document_title: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                <input value={request.document_source} onChange={(event) => setRequest({ ...request, document_source: event.target.value })} className="rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </div>
              <button onClick={() => documentMutation.mutate()} className="mt-3 inline-flex items-center gap-2 rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-white">
                <FileUp className="h-4 w-4" />
                Upload document
              </button>
            </div>
            {lastAction && <div className="rounded-md border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-medium text-accent-800">{lastAction}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
