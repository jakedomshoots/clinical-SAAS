import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@concierge-os/shared';
import type { Fax } from '@concierge-os/shared';
import { Send, Loader2, ArrowDownToLine, ArrowUpFromLine, FileText, Check, Search } from 'lucide-react';

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

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, tab, page],
    queryFn: () => {
      const direction = tab === 'inbox' ? 'inbound' : 'outbound';
      return api.get<FaxListResponse>(`/faxes?direction=${direction}&page=${page}&page_size=20`);
    },
  });

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-clinic-800">Fax Center</h1>
          <button className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
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
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-clinic-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-clinic-200 bg-white">
            <table className="w-full text-sm">
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
                        {fax.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-clinic-600">{fax.from_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-clinic-600">{fax.to_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[fax.status]}`}>
                        {fax.status}
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
                    <td colSpan={7} className="px-4 py-12 text-center text-clinic-400">
                      No faxes in {tab}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedFax && (
        <div className="w-80 shrink-0 rounded-lg border border-clinic-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-clinic-700">
            <FileText className="h-4 w-4" />
            Fax Detail
          </h3>
          <dl className="space-y-2 text-sm">
            {[
              ['From', selectedFax.from_number],
              ['To', selectedFax.to_number],
              ['Status', selectedFax.status],
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
              <button className="flex w-full items-center justify-center gap-2 rounded-md border border-clinic-300 py-1.5 text-xs text-clinic-600 hover:bg-clinic-100">
                <Search className="h-3.5 w-3.5" />
                Match to Patient
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
