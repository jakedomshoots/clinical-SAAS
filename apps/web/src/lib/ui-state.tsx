import { AlertTriangle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function friendlyErrorDetail(detail?: string) {
  if (!detail) return undefined;
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("file not found") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("not found")
  ) {
    return "The clinic API or demo data is not available from this workspace. Retry when the backend is running, or open Setup to seed/check the pilot workspace.";
  }
  return detail;
}

export function humanizeWorkflowLabel(value?: string | null) {
  if (!value) return "";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-small text-ink-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
  icon: Icon,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {Icon && (
        <Icon className="mb-3 h-8 w-8 text-ink-faint" />
      )}
      <div className="text-subhead font-medium text-ink">{title}</div>
      {detail && (
        <div className="mx-auto mt-1 max-w-md text-small text-ink-muted">
          {detail}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function OperationalEmptyState({
  title,
  detail,
  primaryAction,
  secondaryAction,
  icon: Icon,
}: {
  title: string;
  detail: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      {Icon && (
        <Icon className="mb-3 h-8 w-8 text-ink-faint" />
      )}
      <div className="text-subhead font-medium text-ink">{title}</div>
      {detail && (
        <div className="mx-auto mt-1 max-w-md text-small text-ink-muted">
          {detail}
        </div>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function ClinicNeedsStrip() {
  return null;
}

export function ErrorState({
  title = "Something went wrong",
  detail,
  action,
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-small text-danger">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-medium">{title}</div>
          {detail && (
            <div className="mt-1 text-danger/80">
              {friendlyErrorDetail(detail)}
            </div>
          )}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
