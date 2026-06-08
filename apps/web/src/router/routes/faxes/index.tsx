import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';
import type { Fax } from '@concierge-os/shared';
import { Send, ArrowDownToLine, ArrowUpFromLine, FileText, Search, X } from 'lucide-react';

interface FaxListResponse {
  data: Fax[];
  total: number;
  page: number;
  page_size: number;
}

const DIRECTION_ICONS: Record<string, React.ReactNode> = {
  inbound: <ArrowDownToLine className="h-3.5 w-3.5" />,
  outbound: <ArrowUpFromLine className="h-3.5 w-3.5" />,
};

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-amber-100 text-amber-700',
  pending: 'bg-amber-100 text-amber-700',
  sending: 'bg-sky-100 text-sky-700',
  sent: 'bg-sky-100 text-sky-700',
  failed: 'bg-red-100 text-red-700',
};

export const Route = createFileRoute('/faxes/')({
  component: FaxCenterPage,
});

function FaxCenterPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');
  const [page, setPage] = useState(1);
  const [selectedFax, setSelectedFax] = useState<Fax | null>(null);
  const [showSendFax, setShowSendFax] = useState(false);
  const [matchPatient, setMatchPatient] = useState('');
  const [sendFax, setSendFax] = useState({ to_number: '', patient_name: '', pages: '1', ocr_text: '' });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, tab, page],
    queryFn: () => {
      const direction = tab === 'inbox' ? 'inbound' : 'outbound';
      return api.get<FaxListResponse>(`/faxes?direction=${direction}&page=${page}&page_size=20`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => api.post<Fax>('/faxes', {
      to_number: sendFax.to_number,
      patient_name: sendFax.patient_name || null,
      pages: Number(sendFax.pages) || 1,
      ocr_text: sendFax.ocr_text || 'Queued outbound fax.',
    }),
    onSuccess: (fax) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES });
      setTab('outbox');
      setSelectedFax(fax);
      setShowSendFax(false);
      setSendFax({ to_number: '', patient_name: '', pages: '1', ocr_text: '' });
    },
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, patient_name }: { id: string; patient_name: string }) =>
      api.patch<Fax>(`/faxes/${id}`, { patient_name, matched_by: 'manual' }),
    onSuccess: (fax) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES });
      setSelectedFax(fax);
      setMatchPatient('');
    },
  });

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-clinic-800">Fax Center</h1>
            <p className="mt-1 text-sm text-clinic-500">Match inbound documents to charts, queue outbound faxes, and keep uncertain matches staged for staff review.</p>
          </div>
          <button onClick={() => setShowSendFax(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
            <Send className="h-4 w-4" />
            Send Fax
          </button>
        </div>

        <div className="mb-4 flex gap-0 border-b border-clinic-200">
          {(['inbox', 'outbox'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); setSelectedFax(null); }}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-accent-600 text-accent-700'
                  : 'text-clinic-500 hover:text-clinic-700'
              }`}
            >
              {t === 'inbox' ? 'Inbox' : 'Outbox'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingState label="Loading faxes" />
        ) : isError ? (
          <ErrorState title="Unable to load faxes" detail={error instanceof Error ? error.message : 'The fax queue could not be loaded.'} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-clinic-200 bg-white">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="border-b border-clinic-200 bg-clinic-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500 w-8"></th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Direction</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">From</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">To</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-clinic-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((fax) => (
                  <tr
                    key={fax.id}
                    onClick={() => setSelectedFax(fax)}
                    className={`cursor-pointer border-b border-clinic-100 transition-colors hover:bg-clinic-50 ${selectedFax?.id === fax.id ? 'bg-clinic-100' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <FileText className="h-4 w-4 text-clinic-400" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-clinic-500">
                        {DIRECTION_ICONS[fax.direction]}
                        {humanizeWorkflowLabel(fax.direction)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clinic-600">{fax.from_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-clinic-600">{fax.to_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[fax.status]}`}>
                        {humanizeWorkflowLabel(fax.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-clinic-600">{fax.patient_name || 'Unmatched'}</td>
                    <td className="px-4 py-3 text-xs text-clinic-500">
                      {new Date(fax.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title={`No faxes in ${tab}`}
                        detail={tab === 'inbox' ? 'Inbound documents will appear here for OCR review and chart matching. If this is a demo, open Setup to seed documents.' : 'Outbound fax activity will appear here after sending. Queue a fax when the clinical packet is ready.'}
                        action={tab === 'inbox'
                          ? <Link to="/setup" className="rounded-md border border-clinic-300 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50">Seed demo data</Link>
                          : <button type="button" onClick={() => setShowSendFax(true)} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">Queue fax</button>}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedFax && (
        <div className="w-full shrink-0 rounded-lg border border-clinic-200 bg-white p-4 xl:w-80">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-700">
            <FileText className="h-4 w-4" />
            Fax Detail
          </h3>
          <dl className="space-y-2 text-sm">
            {[
              ['From', selectedFax.from_number],
              ['To', selectedFax.to_number],
              ['Status', humanizeWorkflowLabel(selectedFax.status)],
              ['Pages', String(selectedFax.pages)],
              ['Matched by', selectedFax.matched_by || '—'],
              ['Patient', selectedFax.patient_name || 'Unmatched'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-clinic-500">{label}</dt>
                <dd className="font-medium text-clinic-800">{value}</dd>
              </div>
            ))}
          </dl>
          {selectedFax.ocr_text && (
            <div className="mt-4">
              <h4 className="mb-1 text-xs font-medium text-clinic-500">OCR Preview</h4>
              <p className="rounded-md bg-clinic-50 p-2 text-xs text-clinic-600 max-h-32 overflow-y-auto">
                {selectedFax.ocr_text}
              </p>
            </div>
          )}
          {!selectedFax.patient_id && (
            <div className="mt-4">
              <input
                value={matchPatient}
                onChange={(event) => setMatchPatient(event.target.value)}
                placeholder="Patient name"
                className="mb-2 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm"
              />
              <button
                onClick={() => {
                  if (!selectedFax || !matchPatient) return;
                  matchMutation.mutate({ id: selectedFax.id, patient_name: matchPatient });
                }}
                disabled={matchMutation.isPending || !matchPatient}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-clinic-300 py-1.5 text-xs text-clinic-600 hover:bg-clinic-100"
              >
                <Search className="h-3.5 w-3.5" />
                {matchMutation.isPending ? 'Matching...' : 'Match to Patient'}
              </button>
            </div>
          )}
        </div>
      )}

      {showSendFax && (
        <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg rounded-md border border-clinic-300 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-900">Send Fax</h2>
              <button type="button" onClick={() => setShowSendFax(false)} className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-clinic-700">
                  To number
                  <input required value={sendFax.to_number} onChange={(event) => setSendFax({ ...sendFax, to_number: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" placeholder="+13125550123" />
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Pages
                  <input required type="number" min="1" value={sendFax.pages} onChange={(event) => setSendFax({ ...sendFax, pages: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block text-sm font-medium text-clinic-700">
                Patient
                <input value={sendFax.patient_name} onChange={(event) => setSendFax({ ...sendFax, patient_name: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-clinic-700">
                Cover note
                <textarea value={sendFax.ocr_text} onChange={(event) => setSendFax({ ...sendFax, ocr_text: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setShowSendFax(false)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">Cancel</button>
              <button disabled={sendMutation.isPending} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                {sendMutation.isPending ? 'Sending...' : 'Queue fax'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
