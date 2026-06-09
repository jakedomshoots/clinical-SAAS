import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSection {
  id: string;
  tabId: string;
  tabLabel: string;
  title: string;
  keywords: string[];
}

const SEARCHABLE_SECTIONS: SearchableSection[] = [
  { id: 'live-use-rehearsal', tabId: 'staff-training', tabLabel: 'Staff & Training', title: 'Live-Use Rehearsal Board', keywords: ['rehearsal', 'practice', 'runthrough', 'gates', 'evidence'] },
  { id: 'staff-training', tabId: 'staff-training', tabLabel: 'Staff & Training', title: 'Staff Training Evidence', keywords: ['training', 'staff', 'onboarding', 'completion', 'certification'] },
  { id: 'role-dry-run', tabId: 'staff-training', tabLabel: 'Staff & Training', title: 'Role Dry-Run Checklists', keywords: ['dry run', 'role', 'checklist', 'workflow', 'validation'] },
  { id: 'dry-run-session', tabId: 'staff-training', tabLabel: 'Staff & Training', title: 'Dry-Run Session Evidence', keywords: ['session', 'evidence', 'dry run', 'log'] },
  { id: 'credential-binder', tabId: 'compliance-security', tabLabel: 'Compliance & Security', title: 'Credential Binder', keywords: ['credentials', 'binder', 'vendor', 'insurance', 'verification'] },
  { id: 'vendor-credential', tabId: 'compliance-security', tabLabel: 'Compliance & Security', title: 'Vendor Credential Packet', keywords: ['vendor', 'credential', 'packet', 'compliance'] },
  { id: 'browser-qa', tabId: 'systems-data', tabLabel: 'Systems & Data', title: 'Browser QA Evidence', keywords: ['browser', 'qa', 'testing', 'chrome', 'safari'] },
  { id: 'system-integration', tabId: 'systems-data', tabLabel: 'Systems & Data', title: 'System Integration', keywords: ['integration', 'adapter', 'api', 'connection', 'sync'] },
  { id: 'document-storage', tabId: 'systems-data', tabLabel: 'Systems & Data', title: 'Document Storage Readiness', keywords: ['storage', 'documents', 'files', 'backup', 's3'] },
  { id: 'production-config', tabId: 'systems-data', tabLabel: 'Systems & Data', title: 'Production Config Audit', keywords: ['config', 'audit', 'production', 'settings', 'environment'] },
  { id: 'operator-health', tabId: 'systems-data', tabLabel: 'Systems & Data', title: 'Operator Health', keywords: ['health', 'status', 'uptime', 'monitoring', 'operator'] },
  { id: 'policy-approval', tabId: 'compliance-security', tabLabel: 'Compliance & Security', title: 'Policy Approval Evidence', keywords: ['policy', 'approval', 'compliance', 'review', 'sign-off'] },
  { id: 'restore-drill', tabId: 'compliance-security', tabLabel: 'Compliance & Security', title: 'Restore Drill Evidence', keywords: ['restore', 'drill', 'disaster', 'recovery', 'backup', 'rto', 'rpo'] },
  { id: 'cutover-readiness', tabId: 'go-live', tabLabel: 'Go-Live', title: 'Cutover Readiness', keywords: ['cutover', 'readiness', 'go-live', 'deployment', 'launch'] },
  { id: 'cutover-runbook', tabId: 'go-live', tabLabel: 'Go-Live', title: 'Cutover Runbook', keywords: ['runbook', 'cutover', 'steps', 'procedure', 'rollback'] },
  { id: 'go-live-packet', tabId: 'go-live', tabLabel: 'Go-Live', title: 'Go-Live Packet', keywords: ['go-live', 'packet', 'launch', 'attestation', 'approval'] },
  { id: 'launch-workplan', tabId: 'go-live', tabLabel: 'Go-Live', title: 'Launch Workplan', keywords: ['workplan', 'launch', 'timeline', 'tasks', 'milestones'] },
  { id: 'production-rehearsal', tabId: 'compliance-security', tabLabel: 'Compliance & Security', title: 'Production Rehearsal', keywords: ['rehearsal', 'production', 'dry run', 'final check'] },
  { id: 'incident-register', tabId: 'post-launch', tabLabel: 'Post-Launch', title: 'Incident Register', keywords: ['incident', 'register', 'issues', 'problems', 'alerts'] },
  { id: 'integration-events', tabId: 'post-launch', tabLabel: 'Post-Launch', title: 'Integration Events', keywords: ['events', 'integration', 'failed', 'errors', 'logs'] },
  { id: 'billing-work-queue', tabId: 'post-launch', tabLabel: 'Post-Launch', title: 'Billing Work Queue', keywords: ['billing', 'claims', 'queue', 'payments', 'invoices'] },
];

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tabId: string, sectionId: string) => void;
}

export function GlobalSearch({ open, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return SEARCHABLE_SECTIONS.filter(
      (section) =>
        section.title.toLowerCase().includes(q) ||
        section.tabLabel.toLowerCase().includes(q) ||
        section.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (filtered.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = filtered[selectedIndex];
        if (item) {
          onNavigate(item.tabId, item.id);
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, filtered, selectedIndex, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            placeholder="Search operations sections..."
            aria-label="Search operations"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.map((section, index) => (
            <button
              key={section.id}
              onClick={() => {
                onNavigate(section.tabId, section.id);
                onClose();
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors duration-150',
                index === selectedIndex ? 'bg-canvas-sunk' : 'hover:bg-canvas-sunk'
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent text-small font-medium">
                {section.tabLabel.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium text-ink">{section.title}</span>
                <span className="block truncate text-micro text-ink-muted">
                  {section.tabLabel} · {section.keywords.slice(0, 3).join(', ')}
                </span>
              </span>
            </button>
          ))}
          {query.trim() && filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-small text-ink-faint">
              No sections match "{query}"
            </div>
          )}
          {!query.trim() && (
            <div className="px-3 py-6 text-center text-small text-ink-faint">
              Type to search across all 20 operations sections
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
