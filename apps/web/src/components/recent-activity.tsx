import { Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { OperationsIncidentList } from '@concierge-os/shared';

interface RecentActivityItem {
  id: string;
  icon: 'incident' | 'success' | 'warning' | 'event';
  message: string;
  time: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface RecentActivityProps {
  incidents?: OperationsIncidentList;
  className?: string;
}

export function RecentActivity({ incidents, className }: RecentActivityProps) {
  const [expanded, setExpanded] = useState(true);

  const items: RecentActivityItem[] = [];

  if (incidents?.data) {
    incidents.data.slice(0, 3).forEach((incident) => {
      items.push({
        id: `incident-${incident.key}`,
        icon: incident.severity === 'critical' ? 'incident' : 'warning',
        message: `${incident.title} — ${incident.status}`,
        time: incidents.generated_at ? formatRelativeTime(incidents.generated_at) : 'recent',
      });
    });
  }

  const newCount = items.filter((i) => i.time.includes('m ago') || i.time === 'just now').length;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('rounded-lg border border-border bg-canvas-raised', className)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 hover:bg-canvas-sunk/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <span className="text-small font-medium text-ink">Recent Activity</span>
          {newCount > 0 && (
            <span className="rounded-pill bg-accent-soft px-1.5 py-0.5 text-micro text-accent font-medium">
              {newCount} new
            </span>
          )}
        </div>
        <span className="text-micro text-ink-muted">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-5 py-3">
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5">
                {item.icon === 'incident' && (
                  <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                )}
                {item.icon === 'warning' && (
                  <AlertTriangle className="h-4 w-4 text-warn shrink-0 mt-0.5" />
                )}
                {item.icon === 'success' && (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                )}
                {item.icon === 'event' && (
                  <Clock className="h-4 w-4 text-ink-muted shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-small text-ink-secondary leading-snug">{item.message}</p>
                  <p className="text-micro text-ink-faint mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
