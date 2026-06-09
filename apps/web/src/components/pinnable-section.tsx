import { useState, useCallback } from 'react';
import { Pin, PinOff, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPinnedSections, setPinnedSections, getHiddenSections, setHiddenSections } from '@/lib/persistence';
import type { UserRole } from '@/lib/view-mode';

interface PinnableSectionProps {
  sectionId: string;
  role: UserRole;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export function PinnableSection({ sectionId, role, children, headerExtra }: PinnableSectionProps) {
  const [pinned, setPinned] = useState(() => getPinnedSections(role).includes(sectionId));
  const [hidden, setHidden] = useState(() => getHiddenSections(role).includes(sectionId));

  const togglePin = useCallback(() => {
    const current = getPinnedSections(role);
    const next = pinned ? current.filter((id) => id !== sectionId) : [...current, sectionId];
    setPinnedSections(role, next);
    setPinned(!pinned);
  }, [sectionId, role, pinned]);

  const toggleHide = useCallback(() => {
    const current = getHiddenSections(role);
    const next = hidden ? current.filter((id) => id !== sectionId) : [...current, sectionId];
    setHiddenSections(role, next);
    setHidden(!hidden);
  }, [sectionId, role, hidden]);

  if (hidden) return null;

  return (
    <div className={cn('relative', pinned && 'order-first')}>
      <div className="absolute right-14 top-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={togglePin}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            pinned ? 'text-accent bg-accent-soft' : 'text-ink-faint hover:text-accent hover:bg-canvas-sunk'
          )}
          title={pinned ? 'Unpin section' : 'Pin section'}
          aria-label={pinned ? 'Unpin section' : 'Pin section'}
        >
          {pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={toggleHide}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint hover:text-danger hover:bg-danger/10 transition-colors"
          title="Hide section"
          aria-label="Hide section"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}

interface HiddenSectionsButtonProps {
  role: UserRole;
  onUnhide: (sectionId: string) => void;
}

export function HiddenSectionsButton({ role, onUnhide }: HiddenSectionsButtonProps) {
  const hidden = getHiddenSections(role);
  if (hidden.length === 0) return null;

  return (
    <div className="flex items-center justify-center py-4">
      <button
        className="inline-flex items-center gap-2 rounded-md border border-border bg-canvas-raised px-4 py-2 text-small text-ink-muted hover:text-ink hover:bg-canvas-sunk transition-colors"
      >
        <Eye className="h-4 w-4" />
        Show hidden sections ({hidden.length})
      </button>
    </div>
  );
}
