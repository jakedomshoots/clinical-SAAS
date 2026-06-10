import { Bot, Minimize2, PanelRightOpen, X } from 'lucide-react';
import { ClickyCommandPanel } from '@/components/clicky/clicky-command-panel';
import { useClickyAddOn } from '@/lib/clicky-overlay';

export function ClickyFloatingOverlay() {
  const {
    nativeCommandsEnabled,
    overlayEnabled,
    overlayOpen,
    setOverlayEnabled,
    setOverlayOpen,
  } = useClickyAddOn();

  if (!overlayEnabled) return null;

  if (!overlayOpen) {
    return (
      <button
        type="button"
        data-testid="clicky-overlay-minimized"
        onClick={() => setOverlayOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex h-11 items-center gap-2 rounded-md border border-border bg-canvas-raised px-3 text-small font-semibold text-ink shadow-lg hover:bg-canvas-sunk print:hidden"
      >
        <Bot className="h-4 w-4 text-accent" />
        Clicky
        <PanelRightOpen className="h-4 w-4 text-ink-muted" />
      </button>
    );
  }

  return (
    <aside
      data-testid="clicky-floating-overlay"
      className="fixed bottom-5 right-5 z-40 flex h-[min(680px,calc(100vh-6rem))] w-[min(460px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-xl print:hidden"
      aria-label="Clicky overlay"
    >
      <div className="flex h-11 items-center justify-between border-b border-border bg-canvas-raised px-3">
        <div className="flex items-center gap-2 text-small font-semibold text-ink">
          <Bot className="h-4 w-4 text-accent" />
          Clicky overlay
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOverlayOpen(false)}
            aria-label="Minimize Clicky overlay"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOverlayEnabled(false)}
            aria-label="Disable Clicky overlay"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ClickyCommandPanel
        nativeCommandsEnabled={nativeCommandsEnabled}
        className="min-h-0 flex-1 rounded-none border-0"
        compact
      />
    </aside>
  );
}
