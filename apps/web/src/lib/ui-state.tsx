import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';

function friendlyErrorDetail(detail?: string) {
  if (!detail) return undefined;
  const normalized = detail.toLowerCase();
  if (normalized.includes('file not found') || normalized.includes('failed to fetch') || normalized.includes('not found')) {
    return 'The clinic API or demo data is not available from this workspace. Retry when the backend is running, or open Setup to seed/check the pilot workspace.';
  }
  return detail;
}

export function humanizeWorkflowLabel(value?: string | null) {
  if (!value) return '';
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-clinic-500">
      <Loader2 className="h-5 w-5 animate-spin text-clinic-400" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="text-sm font-medium text-clinic-700">{title}</div>
      {detail && <div className="mx-auto mt-1 max-w-md text-sm text-clinic-500">{detail}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function OperationalEmptyState({
  title,
  detail,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  detail: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-clinic-200 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent-50 text-accent-700">
        <Workflow className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-clinic-900">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-sm leading-6 text-clinic-500">{detail}</div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function ClinicNeedsStrip() {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {[
        { label: 'Confidence', detail: 'Show whether data, API, sync, and integrations are usable before staff starts work.', icon: CheckCircle2 },
        { label: 'Direction', detail: 'Surface the next best action instead of leaving teams on blank queues.', icon: Workflow },
        { label: 'Protection', detail: 'Keep PHI and AI-assisted actions confirmation-gated, auditable, and reversible where possible.', icon: ShieldCheck },
      ].map(({ label, detail, icon: Icon }) => (
        <div key={label} className="rounded-md border border-clinic-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
            <Icon className="h-4 w-4 text-accent-700" />
            {label}
          </div>
          <p className="mt-1 text-xs leading-5 text-clinic-500">{detail}</p>
        </div>
      ))}
    </section>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  detail,
  action,
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div className="font-semibold">{title}</div>
          {detail && <div className="mt-1 text-red-700">{friendlyErrorDetail(detail)}</div>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
