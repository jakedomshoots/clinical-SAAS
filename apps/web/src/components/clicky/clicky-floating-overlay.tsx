import { useRouterState } from '@tanstack/react-router';
import {
  Bot,
  Crosshair,
  Maximize2,
  Minimize2,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ClickyCommandPanel } from '@/components/clicky/clicky-command-panel';
import { useClickyAddOn } from '@/lib/clicky-overlay';
import {
  collectClickyVisibleContext,
  snapshotClickyTarget,
  type ClickyTargetSnapshot,
  type ClickyVisibleContext,
} from '@/lib/clicky-targeting';

function TargetCard({ target }: { target: ClickyTargetSnapshot | null }) {
  if (!target) {
    return (
      <div className="rounded-md border border-border bg-canvas px-3 py-2 text-small text-ink-muted">
        No screen target selected.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-accent-soft bg-accent-soft px-3 py-2">
      <div className="flex items-center gap-2 text-micro font-medium uppercase text-accent">
        <MousePointer2 className="h-3.5 w-3.5" />
        Point target
      </div>
      <div className="mt-1 text-small font-semibold text-ink">{target.label}</div>
      <div className="mt-1 line-clamp-2 text-small text-ink-secondary">{target.text}</div>
      <div className="mt-2 font-mono text-[11px] leading-4 text-ink-muted">
        {target.pointTag}
      </div>
    </div>
  );
}

function VisibleContextCard({ context }: { context: ClickyVisibleContext | null }) {
  if (!context) return null;
  return (
    <div className="rounded-md border border-border bg-canvas px-3 py-2">
      <div className="text-micro font-medium uppercase text-ink-faint">Screen context</div>
      <div className="mt-1 text-small font-semibold text-ink">{context.title}</div>
      <div className="mt-1 line-clamp-3 text-small text-ink-secondary">{context.summary}</div>
    </div>
  );
}

export function ClickyFloatingOverlay() {
  const {
    nativeCommandsEnabled,
    overlayEnabled,
    overlayOpen,
    overlayMode,
    openClickyMode,
    setOverlayEnabled,
    setOverlayMode,
    setOverlayOpen,
  } = useClickyAddOn();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [targetPicking, setTargetPicking] = useState(false);
  const [hoverTarget, setHoverTarget] = useState<ClickyTargetSnapshot | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ClickyTargetSnapshot | null>(null);
  const [visibleContext, setVisibleContext] = useState<ClickyVisibleContext | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!nativeCommandsEnabled) return;
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openClickyMode('spotlight');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nativeCommandsEnabled, openClickyMode]);

  useEffect(() => {
    if (!overlayOpen && !targetPicking) return;
    setVisibleContext(collectClickyVisibleContext(document, pathname));
  }, [overlayOpen, pathname, targetPicking]);

  useEffect(() => {
    if (!targetPicking) return;

    document.documentElement.classList.add('clicky-target-picking');

    function onPointerMove(event: PointerEvent) {
      setHoverTarget(snapshotClickyTarget(event.target, pathname));
    }

    function onPointerDown(event: PointerEvent) {
      const snapshot = snapshotClickyTarget(event.target, pathname);
      if (!snapshot) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedTarget(snapshot);
      setHoverTarget(snapshot);
      setTargetPicking(false);
      setOverlayEnabled(true);
      setOverlayOpen(true);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setTargetPicking(false);
        setHoverTarget(null);
      }
    }

    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.documentElement.classList.remove('clicky-target-picking');
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [pathname, setOverlayEnabled, setOverlayOpen, targetPicking]);

  const targetOverlayStyle = useMemo(() => {
    if (!hoverTarget) return undefined;
    return {
      left: `${hoverTarget.rect.x}px`,
      top: `${hoverTarget.rect.y}px`,
      width: `${hoverTarget.rect.width}px`,
      height: `${hoverTarget.rect.height}px`,
    };
  }, [hoverTarget]);

  const startTargetPicking = () => {
    setTargetPicking(true);
    setOverlayOpen(false);
  };

  const overlayControls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={startTargetPicking}
        aria-label="Pick screen target"
        className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-accent"
      >
        <Crosshair className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setOverlayMode(overlayMode === 'spotlight' ? 'dock' : 'spotlight')}
        aria-label={overlayMode === 'spotlight' ? 'Dock Clicky' : 'Expand Clicky'}
        className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
      >
        {overlayMode === 'spotlight' ? (
          <PanelRightOpen className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setOverlayOpen(false)}
        aria-label="Minimize Clicky"
        className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
      >
        <Minimize2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setOverlayEnabled(false)}
        aria-label="Disable Clicky overlay"
        className="grid h-8 w-8 place-items-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-danger"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <>
      {targetPicking && (
        <div
          data-testid="clicky-target-picker"
          data-clicky-overlay="true"
          className="pointer-events-none fixed inset-0 z-[60] print:hidden"
        >
          {targetOverlayStyle && (
            <div
              className="fixed rounded-md border-2 border-accent bg-accent-soft shadow-lg"
              style={targetOverlayStyle}
            />
          )}
          <div className="fixed left-1/2 top-5 -translate-x-1/2 rounded-md border border-accent-soft bg-canvas-raised px-3 py-2 text-small font-medium text-ink shadow-lg">
            Select screen target
          </div>
        </div>
      )}

      {overlayEnabled && !overlayOpen && (
        <button
          type="button"
          data-testid="clicky-orb"
          data-clicky-overlay="true"
          onClick={() => openClickyMode('spotlight')}
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 items-center gap-2 rounded-pill border border-border bg-canvas-raised px-4 text-small font-semibold text-ink shadow-lg hover:border-accent-soft hover:bg-accent-soft print:hidden"
        >
          <Bot className="h-4 w-4 text-accent" />
          Clicky
          <PanelRightOpen className="h-4 w-4 text-ink-muted" />
        </button>
      )}

      {overlayEnabled && overlayOpen && overlayMode === 'dock' && (
        <aside
          data-testid="clicky-floating-overlay"
          data-clicky-overlay="true"
          className="fixed bottom-5 right-5 z-40 flex h-[min(760px,calc(100vh-4rem))] w-[min(520px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-xl print:hidden"
          aria-label="Clicky overlay"
        >
          <div className="flex h-11 items-center justify-between border-b border-border bg-canvas-raised px-3">
            <div className="flex items-center gap-2 text-small font-semibold text-ink">
              <Bot className="h-4 w-4 text-accent" />
              Clicky
            </div>
            {overlayControls}
          </div>
          <ClickyCommandPanel
            nativeCommandsEnabled={nativeCommandsEnabled}
            selectedTarget={selectedTarget}
            visibleContext={visibleContext}
            onPickTarget={startTargetPicking}
            className="min-h-0 flex-1 rounded-none border-0"
            compact
          />
        </aside>
      )}

      {overlayEnabled && overlayOpen && overlayMode === 'spotlight' && (
        <div
          data-testid="clicky-spotlight-overlay"
          data-clicky-overlay="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-ink/35 p-4 backdrop-blur-sm print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Clicky mode"
        >
          <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-3">
            <header className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-canvas-raised px-3 shadow-lg">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-md border border-accent-soft bg-accent-soft">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-small font-semibold text-ink">Clicky Mode</div>
                  <div className="truncate text-micro text-ink-muted">{pathname}</div>
                </div>
              </div>
              {overlayControls}
            </header>

            <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="space-y-3 rounded-md border border-border bg-canvas-raised p-3 shadow-lg">
                <VisibleContextCard context={visibleContext} />
                <TargetCard target={selectedTarget} />
                <button
                  type="button"
                  onClick={() => setOverlayMode('dock')}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-canvas text-small font-semibold text-ink-secondary hover:bg-canvas-sunk"
                >
                  <PanelRightClose className="h-4 w-4" />
                  Dock Clicky
                </button>
              </aside>

              <ClickyCommandPanel
                nativeCommandsEnabled={nativeCommandsEnabled}
                selectedTarget={selectedTarget}
                visibleContext={visibleContext}
                onPickTarget={startTargetPicking}
                className="min-h-[min(760px,calc(100vh-6.5rem))] shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
