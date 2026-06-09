import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";

interface CriticalAction {
  label: string;
  count: number;
  status: "complete" | "in-progress" | "needs-attention";
  tabId: string;
  sectionId?: string;
}

interface CriticalActionsStripProps {
  actions: CriticalAction[];
  onActionClick?: (action: CriticalAction) => void;
}

export function CriticalActionsStrip({
  actions,
  onActionClick,
}: CriticalActionsStripProps) {
  const urgentActions = actions.filter((a) => a.status === "needs-attention");

  if (urgentActions.length === 0) {
    return (
      <div className="flex items-center gap-4 px-6 py-3 bg-canvas-sunk border-b border-border">
        <span className="text-small text-ink-muted">
          All caught up — nothing needs your attention right now.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-6 py-3 bg-canvas-sunk border-b border-border">
      {urgentActions.map((action) => (
        <button
          key={`${action.tabId}-${action.sectionId ?? action.label}`}
          type="button"
          onClick={() => onActionClick?.(action)}
          className={cn(
            "inline-flex items-center gap-2 text-small text-ink-secondary",
            "hover:text-ink transition-colors cursor-pointer"
          )}
        >
          <StatusDot status={action.status} showLabel={false} size="sm" />
          <span className="font-medium">{action.count}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
