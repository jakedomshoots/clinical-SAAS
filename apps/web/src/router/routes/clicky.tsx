import { createFileRoute } from '@tanstack/react-router';
import { Bot, Command, PanelRightOpen, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { ClickyCommandPanel } from '@/components/clicky/clicky-command-panel';
import { useClickyAddOn } from '@/lib/clicky-overlay';

const DEMO_PATIENT_ID = '00000000-0000-4000-8000-000000000101';

const CONTEXT_OPTIONS = [
  { label: 'Command center', path: '/' },
  { label: 'Mary Collins chart', path: `/patients/${DEMO_PATIENT_ID}` },
  { label: 'Billing cases', path: '/billing' },
  { label: 'Fax center', path: '/faxes' },
  { label: 'Messages', path: '/messaging' },
  { label: 'Task queue', path: '/tasks' },
  { label: 'Operations', path: '/operations' },
];

function ClickyRoute() {
  const {
    nativeCommandsEnabled,
    overlayEnabled,
    toggleNativeCommands,
    setOverlayEnabled,
    setOverlayOpen,
  } = useClickyAddOn();
  const [selectedContextPath, setSelectedContextPath] = useState(CONTEXT_OPTIONS[0].path);
  const selectedContext =
    CONTEXT_OPTIONS.find((option) => option.path === selectedContextPath) ?? CONTEXT_OPTIONS[0];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4" data-testid="clicky-page">
      <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-meta font-medium uppercase text-accent">
            <Bot className="h-4 w-4" />
            ConciergeOS add-on
          </div>
          <h1 className="mt-1 font-serif text-title text-ink">Clicky Console</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-canvas-raised px-3 text-small text-ink-secondary">
            <span>Context</span>
            <select
              data-testid="clicky-context-select"
              value={selectedContextPath}
              onChange={(event) => setSelectedContextPath(event.target.value)}
              className="bg-transparent text-small font-medium text-ink outline-none"
            >
              {CONTEXT_OPTIONS.map((option) => (
                <option key={option.path} value={option.path}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="clicky-command-toggle"
            onClick={toggleNativeCommands}
            className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-small font-semibold ${
              nativeCommandsEnabled
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-canvas-raised text-ink-muted'
            }`}
          >
            <Command className="h-4 w-4" />
            {nativeCommandsEnabled ? 'Commands on' : 'Commands off'}
          </button>
          <button
            type="button"
            data-testid="clicky-overlay-toggle"
            onClick={() => {
              setOverlayEnabled(!overlayEnabled);
              if (!overlayEnabled) setOverlayOpen(true);
            }}
            className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-small font-semibold ${
              overlayEnabled
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border bg-canvas-raised text-ink-muted'
            }`}
          >
            <PanelRightOpen className="h-4 w-4" />
            {overlayEnabled ? 'Overlay on' : 'Overlay off'}
          </button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-12rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ClickyCommandPanel
          nativeCommandsEnabled={nativeCommandsEnabled}
          contextPath={selectedContext.path}
          contextLabel={selectedContext.label}
          className="min-h-[620px]"
        />

        <aside className="space-y-3">
          <section className="rounded-md border border-border bg-canvas-raised p-4">
            <div className="flex items-center gap-2 text-small font-semibold text-ink">
              <ShieldCheck className="h-4 w-4 text-accent" />
              Action guardrails
            </div>
            <dl className="mt-3 space-y-2 text-small">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">Command engine</dt>
                <dd className="font-medium text-ink">Native</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">Clinical writes</dt>
                <dd className="font-medium text-ink">Proposal first</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">Confirmation</dt>
                <dd className="font-medium text-ink">Required</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-secondary">Audit trail</dt>
                <dd className="font-medium text-ink">Recorded</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border border-border bg-canvas-raised p-4">
            <div className="text-small font-semibold text-ink">Overlay status</div>
            <div className="mt-3 rounded-md border border-border bg-canvas px-3 py-2 text-small text-ink-secondary">
              {overlayEnabled
                ? 'Available across ConciergeOS workspaces.'
                : 'Dedicated workspace only.'}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/clicky')({
  component: ClickyRoute,
});
