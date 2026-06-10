import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

interface ExpandableCardProps {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  status: 'complete' | 'in-progress' | 'needs-attention' | 'not-started';
  countComplete?: number;
  countPending?: number;
  countUrgent?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}

const statusConfig = {
  complete: {
    dot: 'bg-success',
    icon: CheckCircle2,
  },
  'in-progress': {
    dot: 'bg-warn',
    icon: Clock,
  },
  'needs-attention': {
    dot: 'bg-danger',
    icon: AlertTriangle,
  },
  'not-started': {
    dot: 'bg-ink-faint',
    icon: Circle,
  },
};

export function ExpandableCard({
  title,
  icon: Icon,
  subtitle,
  status,
  countComplete = 0,
  countPending = 0,
  countUrgent = 0,
  defaultExpanded = false,
  children,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="rounded-lg border border-border bg-canvas-raised shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full px-6 py-4 border-b border-border text-left hover:bg-canvas-sunk/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-5 w-5 text-ink-muted" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-subhead font-semibold text-ink">{title}</span>
              <StatusIcon className="h-4 w-4 text-ink-muted" />
            </div>
            {subtitle && <span className="text-small text-ink-muted">{subtitle}</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-small text-ink-muted">
            {countComplete > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-success" />
                {countComplete}
              </span>
            )}
            {countPending > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-warn" />
                {countPending}
              </span>
            )}
            {countUrgent > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-danger" />
                {countUrgent}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-ink-muted" />
          ) : (
            <ChevronRight className="h-5 w-5 text-ink-muted" />
          )}
        </div>
      </button>

      <div
        className={cn(
          'grid transition-all duration-300 ease-in-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
