import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/toast';
import { useState, useMemo } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';
import { Badge } from '@/components/badge';
import type { Fax } from '@concierge-os/shared';
import { Send, ArrowDownToLine, ArrowUpFromLine, FileText, Search, X, Printer } from 'lucide-react';

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

function FaxStatusBadge({ fax }: { fax: Fax }) {
  if (fax.status === 'failed') {
    return <Badge intent="danger">{humanizeWorkflowLabel(fax.status)}</Badge>;
  }
  if (fax.direction === 'inbound') {
    return <Badge intent="muted">{humanizeWorkflowLabel(fax.status)}</Badge>;
  }
  return (
    <span className="inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-medium bg-accent/10 text-accent">
      {humanizeWorkflowLabel(fax.status)}
    </span>
  );
}

export const Route = createFileRoute('/faxes/')({
  component: FaxCenterPage,
});

import { useDocumentTitle } from '@/hooks/use-document-title';

function FaxCenterPage() {
  useDocumentTitle('Fax Center');
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'inbox' | 'outbox'>('inbox');
  const [selectedFax, setSelectedFax] = useState<Fax | null>(null);
  const [showSendFax, setShowSendFax] = useState(false);
  const [matchPatient, setMatchPatient] = useState('');
  const [sendFax, setSendFax] = useState({
    to_number: '',
    patient_name: '',
    pages: '1',
    ocr_text: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [matchFilter, setMatchFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, tab],
    queryFn: () => {
      const direction = tab === 'inbox' ? 'inbound' : 'outbound';
      return api.get<FaxListResponse>(`/faxes?direction=${direction}&page=1&page_size=100`);
    },
  });

  const filteredFaxes = useMemo(() => {
    if (!data?.data) return [];
    return data.data.filter((fax) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const fromNum = (fax.from_number || '').toLowerCase();
        const toNum = (fax.to_number || '').toLowerCase();
        const patName = (fax.patient_name || '').toLowerCase();
        if (!fromNum.includes(query) && !toNum.includes(query) && !patName.includes(query)) {
          return false;
        }
      }
      if (matchFilter === 'matched' && !fax.patient_id) return false;
      if (matchFilter === 'unmatched' && fax.patient_id) return false;
      if (dateFilter !== 'all') {
        const faxDate = new Date(fax.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - faxDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dateFilter === 'today') {
          const todayStr = now.toISOString().split('T')[0];
          const faxStr = faxDate.toISOString().split('T')[0];
          if (todayStr !== faxStr) return false;
        } else if (dateFilter === '7d' && diffDays > 7) {
          return false;
        } else if (dateFilter === '30d' && diffDays > 30) {
          return false;
        }
      }
      return true;
    });
  }, [data?.data, searchQuery, matchFilter, dateFilter]);

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<Fax>('/faxes', {
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
      toast.success(`Fax to ${fax.to_number} queued for sending`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to send fax');
    },
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, patient_name }: { id: string; patient_name: string }) =>
      api.patch<Fax>(`/faxes/${id}`, { patient_name, matched_by: 'manual' }),
    onSuccess: (fax, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES });
      setSelectedFax(fax);
      setMatchPatient('');
      toast.success(`Fax matched to patient "${variables.patient_name}"`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to match fax');
    },
  });

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-display text-ink">Faxes</h1>
            <p className="mt-1 text-small text-ink-muted">
              Match inbound documents to charts, queue outbound faxes, and keep uncertain matches
              staged for staff review.
            </p>
          </div>
          <button onClick={() => setShowSendFax(true)} className="btn btn-primary">
            <Send className="h-4 w-4" />
            Send Fax
          </button>
        </div>

        <div className="mb-4 flex items-center gap-0 border-b border-border">
          {(['inbox', 'outbox'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSelectedFax(null);
              }}
              className={`shrink-0 px-4 py-2.5 text-small font-medium transition-colors ${
                tab === t ? 'border-b-2 border-accent text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {t === 'inbox' ? 'Inbox' : 'Outbox'}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-3 bg-canvas-raised border border-border p-3 rounded-md">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by number or patient name..."
              className="w-full bg-canvas border border-border rounded-md pl-9 pr-8 py-1.5 text-small text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-micro font-medium text-ink-muted">Match Status:</span>
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value as any)}
              className="h-8 rounded-md border border-border bg-canvas px-2.5 text-small text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-micro font-medium text-ink-muted">Date:</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-8 rounded-md border border-border bg-canvas px-2.5 text-small text-ink focus:border-accent focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingState label="Loading faxes" />
        ) : isError ? (
          <ErrorState
            title="Unable to load faxes"
            detail={error instanceof Error ? error.message : 'The fax queue could not be loaded.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-canvas-sunk border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase w-8"></th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Direction
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    From
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    To
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFaxes.map((fax) => (
                  <tr
                    key={fax.id}
                    onClick={() => setSelectedFax(fax)}
                    className={`cursor-pointer border-b border-border-subtle transition-colors duration-150 hover:bg-canvas-sunk/50 ${selectedFax?.id === fax.id ? 'bg-canvas-sunk' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <FileText className="h-4 w-4 text-ink-faint" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-small text-ink-muted">
                        {DIRECTION_ICONS[fax.direction]}
                        {humanizeWorkflowLabel(fax.direction)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-micro text-ink-secondary">
                      {fax.from_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-micro text-ink-secondary">
                      {fax.to_number}
                    </td>
                    <td className="px-4 py-3">
                      <FaxStatusBadge fax={fax} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {fax.patient_id ? (
                          <Badge intent="success">Matched</Badge>
                        ) : (
                          <Badge intent="warn">Unmatched</Badge>
                        )}
                        <span className="text-small text-ink-secondary">
                          {fax.patient_name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-micro text-ink-faint">
                      {new Date(fax.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {filteredFaxes.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title={searchQuery || matchFilter !== 'all' || dateFilter !== 'all' ? 'No matching faxes found' : `No faxes in ${tab}`}
                        detail={
                          searchQuery || matchFilter !== 'all' || dateFilter !== 'all'
                            ? 'Try clearing some search keywords or status/date filter parameters.'
                            : tab === 'inbox'
                              ? 'Inbound documents will appear here for OCR review and chart matching. If this is a demo, open Setup to seed documents.'
                              : 'Outbound fax activity will appear here after sending. Queue a fax when the clinical packet is ready.'
                        }
                        icon={Printer}
                        action={
                          !(searchQuery || matchFilter !== 'all' || dateFilter !== 'all') ? (
                            tab === 'inbox' ? (
                              <Link
                                to="/setup"
                                className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk"
                              >
                                Seed demo data
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setShowSendFax(true)}
                                className="btn btn-primary"
                              >
                                Queue fax
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setMatchFilter('all');
                                setDateFilter('all');
                              }}
                              className="btn btn-secondary"
                            >
                              Reset filters
                            </button>
                          )
                        }
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
        <div className="w-full shrink-0 border border-border bg-canvas-raised p-4 xl:w-80">
          <h3 className="mb-3 flex items-center gap-2 text-subhead font-medium text-ink">
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
                <dt className="text-small text-ink-muted">{label}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {selectedFax.ocr_text && (
            <div className="mt-4">
              <h4 className="mb-1 text-meta font-medium text-ink-muted">OCR Preview</h4>
              <p className="rounded-sm bg-canvas-sunk p-2 text-small text-ink-secondary max-h-32 overflow-y-auto">
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
                className="mb-2 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
              />
              <button
                onClick={() => {
                  if (!selectedFax || !matchPatient) return;
                  matchMutation.mutate({ id: selectedFax.id, patient_name: matchPatient });
                }}
                disabled={matchMutation.isPending || !matchPatient}
                className="btn btn-secondary w-full"
              >
                <Search className="h-3.5 w-3.5" />
                {matchMutation.isPending ? 'Matching...' : 'Match to Patient'}
              </button>
            </div>
          )}
        </div>
      )}

      {showSendFax && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg bg-canvas-raised border border-border rounded-lg shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-subhead font-medium text-ink">Send Fax</h2>
              <button
                type="button"
                onClick={() => setShowSendFax(false)}
                className="rounded-md p-1 text-ink-muted hover:text-ink hover:bg-canvas-sunk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-small font-medium text-ink-secondary">
                  To number
                  <input
                    required
                    value={sendFax.to_number}
                    onChange={(event) => setSendFax({ ...sendFax, to_number: event.target.value })}
                    className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                    placeholder="+13125550123"
                  />
                </label>
                <label className="text-small font-medium text-ink-secondary">
                  Pages
                  <input
                    required
                    type="number"
                    min="1"
                    value={sendFax.pages}
                    onChange={(event) => setSendFax({ ...sendFax, pages: event.target.value })}
                    className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                  />
                </label>
              </div>
              <label className="block text-small font-medium text-ink-secondary">
                Patient
                <input
                  value={sendFax.patient_name}
                  onChange={(event) => setSendFax({ ...sendFax, patient_name: event.target.value })}
                  className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Cover note
                <textarea
                  value={sendFax.ocr_text}
                  onChange={(event) => setSendFax({ ...sendFax, ocr_text: event.target.value })}
                  rows={3}
                  className="mt-1 w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setShowSendFax(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button disabled={sendMutation.isPending} className="btn btn-primary">
                {sendMutation.isPending ? 'Sending...' : 'Queue fax'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
