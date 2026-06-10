import { useState, useEffect } from 'react';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getOnboardingState,
  setOnboardingCompleted,
  incrementOnboardingSession,
} from '@/lib/persistence';

interface OnboardingTourProps {
  onComplete: () => void;
  onDismiss: () => void;
}

export function OnboardingTour({ onComplete, onDismiss }: OnboardingTourProps) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const state = getOnboardingState();
    if (state.completed) {
      setDismissed(true);
      return;
    }
    // Show welcome on first session
    if (state.sessions === 0) {
      setShowWelcome(true);
    }
    incrementOnboardingSession();
  }, []);

  if (dismissed) return null;

  const tips = [
    {
      title: 'Expandable Cards',
      body: 'Click any card to expand it and see full details. You can open multiple cards at once to compare data.',
    },
    {
      title: 'Phase Tabs',
      body: 'Use the tabs at the top to switch between work areas: Staff, Systems, Compliance, Go-Live, and Post-Launch.',
    },
    {
      title: 'Critical Actions',
      body: 'The strip below tabs shows what needs your attention right now. Red = urgent, amber = in progress.',
    },
    {
      title: 'View Modes',
      body: 'Switch between Simple, Standard, and Power views using the mode selector in the top bar.',
    },
  ];

  const handleDismiss = () => {
    setDismissed(true);
    setOnboardingCompleted();
    onDismiss();
  };

  const handleComplete = () => {
    setDismissed(true);
    setOnboardingCompleted();
    onComplete();
  };

  if (showWelcome) {
    return (
      <div
        className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm flex items-center justify-center"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-canvas-raised shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <h2 className="text-headline font-semibold text-ink">Welcome to ConciergeOS</h2>
            </div>
            <button
              onClick={handleDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-body text-ink-secondary leading-relaxed">
            You're viewing the <strong>Standard</strong> dashboard. Here's what's happening today —
            and what needs your attention.
          </p>
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={handleDismiss}
              className="text-small text-ink-muted hover:text-ink transition-colors"
            >
              Don't show again
            </button>
            <button
              onClick={() => {
                setShowWelcome(false);
                setCurrentTip(0);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-small font-medium text-accent-on hover:bg-accent-hover transition-colors"
            >
              Get Started
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show one tip per session (not all at once)
  const sessionCount = getOnboardingState().sessions;
  if (sessionCount > 4) {
    return null;
  }

  const tipIndex = Math.min(sessionCount - 1, tips.length - 1);
  const tip = tips[tipIndex];
  if (!tip) return null;

  return (
    <div className="mb-4 rounded-lg border border-accent-soft bg-accent-soft/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-small font-semibold text-accent">{tip.title}</h3>
          <p className="text-small text-ink-secondary mt-1">{tip.body}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk"
          aria-label="Dismiss tip"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {tips.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full transition-colors',
              i === tipIndex ? 'w-4 bg-accent' : 'w-1.5 bg-accent/30'
            )}
          />
        ))}
      </div>
    </div>
  );
}
