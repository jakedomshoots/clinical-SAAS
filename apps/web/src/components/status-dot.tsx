import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
} from "lucide-react";

interface StatusDotProps {
  status: "complete" | "in-progress" | "needs-attention" | "not-started";
  showLabel?: boolean;
  size?: "sm" | "md";
}

const statusConfig = {
  complete: {
    dot: "bg-success",
    icon: CheckCircle2,
    label: "Complete",
  },
  "in-progress": {
    dot: "bg-warn",
    icon: Clock,
    label: "In Progress",
  },
  "needs-attention": {
    dot: "bg-danger",
    icon: AlertTriangle,
    label: "Needs Attention",
  },
  "not-started": {
    dot: "bg-ink-faint",
    icon: Circle,
    label: "Not Started",
  },
};

export function StatusDot({
  status,
  showLabel = true,
  size = "md",
}: StatusDotProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("rounded-full", dotSizes[size], config.dot)} />
      <Icon className={cn(iconSizes[size], "text-ink-muted")} />
      {showLabel && (
        <span className="text-small text-ink-secondary">{config.label}</span>
      )}
    </span>
  );
}
