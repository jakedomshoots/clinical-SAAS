import { Link, Navigate, Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import {useAuth} from '@/lib/auth';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicalAssistantTools, type AssistantAction } from '@/lib/assistant-tools';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ErrorState } from '@/lib/ui-state';
import { ROUTES, type ClinicSettings, type ClinicSettingsUpdate } from '@concierge-os/shared';
import {
  Activity,
  BarChart3,
  Bot,
  Calendar,
  CreditCard,
  Check,
  ClipboardList,
  Command,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PlugZap,
  Printer,
  Search,
  Sparkles,
  Settings,
  ShieldCheck,
  X,
  Users,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string };

type NavSection = { label: string; items: NavItem[] };

function SideNav() {
  const { user, logout } = useAuth();

  const navSections: NavSection[] = [
    {
      label: 'Daily Work',
      items: [
        { to: '/', label: 'Command', icon: Gauge },
        { to: '/roles', label: 'Role Views', icon: LayoutDashboard },
        { to: '/scheduling', label: 'Schedule', icon: Calendar },
        { to: '/tasks', label: 'Tasks', icon: ClipboardList },
        { to: '/messaging', label: 'Messages', icon: MessageSquare },
        { to: '/faxes', label: 'Faxes', icon: Printer },
        { to: '/portal-intake', label: 'Intake', icon: ClipboardList },
      ],
    },
    {
      label: 'Records',
      items: [
        { to: '/patients', label: 'Patients', icon: Users },
        { to: '/staff', label: 'Staff', icon: ShieldCheck },
        { to: '/billing', label: 'Billing', icon: CreditCard },
      ],
    },
    {
      label: 'Oversight',
      items: [
        { to: '/reports', label: 'Reports', icon: BarChart3 },
        { to: '/assistant-review', label: 'Assistant Log', icon: Bot },
        { to: '/operations', label: 'Operations', icon: ShieldCheck },
      ],
    },
    {
      label: 'Admin',
      items: [
        { to: '/setup', label: 'Setup', icon: Settings },
        { to: '/integrations', label: 'Integrations', icon: PlugZap },
        { to: '/portal-mock', label: 'Portal Mock', icon: ClipboardList, badge: 'Demo' },
      ],
    },
  ].map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (['/staff', '/operations', '/integrations', '/assistant-review', '/setup', '/portal-mock'].includes(item.to)) return user?.role === 'admin' || user?.role === 'manager';
      if (item.to === '/billing') return user?.role !== 'front_desk';
      return true;
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-canvas-raised md:flex">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-ink font-serif text-lg font-medium text-canvas-raised">
          C
        </div>
        <span className="font-serif text-base font-medium text-ink">ConciergeOS</span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-1 pt-4 text-meta font-medium text-ink-faint">{section.label}</div>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, badge }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-small text-ink-muted transition-colors duration-150 hover:bg-canvas-sunk hover:text-ink [&.active]:border-l-2 [&.active]:border-accent [&.active]:bg-accent-soft [&.active]:text-accent"
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge && <span className="ml-auto rounded-pill bg-accent-soft px-1.5 py-0.5 text-micro text-accent">{badge}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-1 text-meta text-ink-faint">{user?.display_name}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-small text-ink-muted hover:bg-canvas-sunk hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  density,
  onDensityChange,
  onCommandOpen,
  onSettingsOpen,
  onMenuOpen,
  onAssistantOpen,
}: {
  density: 'comfortable' | 'compact';
  onDensityChange: () => void;
  onCommandOpen: () => void;
  onSettingsOpen: () => void;
  onMenuOpen: () => void;
  onAssistantOpen: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-canvas-raised px-5">
      <button onClick={onMenuOpen} aria-label="Open navigation" className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk md:hidden">
        <Menu className="h-4 w-4" />
      </button>
      <button onClick={onCommandOpen} className="flex h-9 w-full max-w-xl flex-1 items-center gap-3 rounded-pill border border-border bg-canvas px-4 py-2 text-left text-small text-ink-muted hover:border-border-strong hover:bg-canvas-raised">
        <Search className="h-4 w-4 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate">Search patients, tasks, faxes, messages</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-canvas-raised px-1.5 py-0.5 text-meta text-ink-muted">
          <Command className="h-3 w-3" />
          K
        </span>
      </button>
      <div className="ml-4 flex items-center gap-2">
        <button onClick={onAssistantOpen} aria-label="Open clinical assistant" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk xl:hidden">
          <Bot className="h-4 w-4" />
        </button>
        <button onClick={onDensityChange} className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 text-meta text-ink-muted hover:bg-canvas-sunk sm:inline-flex">
          Density
          <span className="rounded-md border border-border bg-canvas px-1.5 py-0.5 text-small text-ink">{density === 'comfortable' ? 'Comfort' : 'Compact'}</span>
        </button>
        <button onClick={onSettingsOpen} aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const navItems = [
    { to: '/', label: 'Command', icon: Gauge },
    { to: '/roles', label: 'Role Views', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/staff', label: 'Staff', icon: ShieldCheck },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/scheduling', label: 'Schedule', icon: Calendar },
    { to: '/portal-intake', label: 'Intake', icon: ClipboardList },
    { to: '/portal-mock', label: 'Portal Mock', icon: ClipboardList },
    { to: '/billing', label: 'Billing', icon: CreditCard },
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messaging', label: 'Messages', icon: MessageSquare },
    { to: '/integrations', label: 'Integrations', icon: PlugZap },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/assistant-review', label: 'Assistant Log', icon: Bot },
    { to: '/operations', label: 'Operations', icon: ShieldCheck },
    { to: '/setup', label: 'Setup', icon: Settings },
  ].filter((item) => {
    if (['/staff', '/operations', '/integrations', '/assistant-review', '/setup'].includes(item.to)) return user?.role === 'admin' || user?.role === 'manager';
    if (item.to === '/billing') return user?.role !== 'front_desk';
    return true;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 md:hidden">
      <div className="flex h-full w-72 max-w-[86vw] flex-col border-r border-border bg-canvas-raised shadow-lg">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-ink font-serif text-lg font-medium text-canvas-raised">
              C
            </div>
            <span className="font-serif text-base font-medium text-ink">ConciergeOS</span>
          </div>
          <button onClick={onClose} aria-label="Close navigation" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-small text-ink-muted transition-colors duration-150 hover:bg-canvas-sunk hover:text-ink [&.active]:border-l-2 [&.active]:border-accent [&.active]:bg-accent-soft [&.active]:text-accent"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-1 text-meta text-ink-faint">{user?.display_name}</div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-small text-ink-muted hover:bg-canvas-sunk hover:text-danger"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({
  open,
  density,
  onDensityChange,
  onClose,
}: {
  open: boolean;
  density: 'comfortable' | 'compact';
  onDensityChange: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [settingsForm, setSettingsForm] = useState<ClinicSettingsUpdate>({});
  const canManageSettings = user?.role === 'admin' || user?.role === 'manager';
  const { data: clinicSettings } = useQuery({
    queryKey: QUERY_KEYS.SETTINGS,
    queryFn: () => api.get<ClinicSettings>(ROUTES.SETTINGS),
  });
  const settingsMutation = useMutation({
    mutationFn: (update: ClinicSettingsUpdate) => api.patch<ClinicSettings>(ROUTES.SETTINGS, update),
    onSuccess: async () => {
      setSettingsForm({});
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTINGS });
    },
  });
  if (!open) return null;
  const effectiveSettings = { ...clinicSettings, ...settingsForm } as ClinicSettings;
  const offsets = (effectiveSettings.reminder_offsets_minutes ?? []).join(', ');

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="ml-auto h-full max-w-md overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-subhead font-medium text-ink">Settings</h2>
            <p className="text-meta text-ink-muted">Local frontend preferences and supervisor status</p>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <section>
            <h3 className="text-meta font-medium uppercase text-ink-faint">Reminder Rules</h3>
            <div className="mt-2 space-y-3 rounded-md border border-border bg-canvas p-3">
              <label className="block text-small font-medium text-ink-secondary">
                Timing offsets
                <input
                  disabled={!canManageSettings}
                  value={offsets}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_offsets_minutes: event.target.value.split(',').map((value) => Number(value.trim())).filter(Number.isFinite) })}
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Sender identity
                <input
                  disabled={!canManageSettings}
                  value={effectiveSettings.sender_identity ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, sender_identity: event.target.value })}
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                SMS template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_sms_template ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_sms_template: event.target.value })}
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Email template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_email_template ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_email_template: event.target.value })}
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-small font-medium text-ink-secondary">
                  Audit retention days
                  <input
                    disabled={!canManageSettings}
                    type="number"
                    value={effectiveSettings.audit_retention_days ?? ''}
                    onChange={(event) => setSettingsForm({ ...settingsForm, audit_retention_days: Number(event.target.value) })}
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                  />
                </label>
                <label className="block text-small font-medium text-ink-secondary">
                  PHI re-auth minutes
                  <input
                    disabled={!canManageSettings}
                    type="number"
                    value={effectiveSettings.phi_reauth_minutes ?? ''}
                    onChange={(event) => setSettingsForm({ ...settingsForm, phi_reauth_minutes: Number(event.target.value) })}
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                  />
                </label>
              </div>
              <button
                disabled={!canManageSettings || Object.keys(settingsForm).length === 0 || settingsMutation.isPending}
                onClick={() => settingsMutation.mutate(settingsForm)}
                className="rounded-md bg-accent px-3 py-2 text-small font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50"
              >
                {settingsMutation.isPending ? 'Saving...' : 'Save reminder settings'}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-meta font-medium uppercase text-ink-faint">Workspace</h3>
            <div className="mt-2 rounded-md border border-border bg-canvas p-3 text-small">
              <div className="flex items-center justify-between">
                <span className="text-ink-secondary">Mode</span>
                <span className="font-medium text-ink">Demo fallback</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-ink-secondary">API</span>
                <span className="font-medium text-warn">Waiting for backend infra</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-ink-secondary">Persistence</span>
                <span className="font-medium text-ink">Local browser storage</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-meta font-medium uppercase text-ink-faint">Density</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['comfortable', 'compact'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    if (option !== density) onDensityChange();
                  }}
                  className={`rounded-md border px-3 py-2 text-small font-medium capitalize ${
                    density === option
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-ink-secondary hover:bg-canvas-sunk'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-meta font-medium uppercase text-ink-faint">Status</h3>
            <ul className="mt-2 space-y-2 text-small text-ink-secondary">
              {['React shell ready', 'Demo API fallback ready', 'Command palette ready', 'Backend infra not required for frontend review'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-meta font-medium uppercase text-ink-faint">Demo Data</h3>
            <button
              onClick={() => {
                window.localStorage.removeItem('concierge-os.demo-data.v1');
                window.location.reload();
              }}
              className="mt-2 rounded-md border border-border px-3 py-2 text-small font-medium text-ink-secondary hover:bg-canvas-sunk"
            >
              Reset demo workspace
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const actions = useMemo(
    () => [
      { label: 'Open Command Center', detail: 'Clinic dashboard and live work', to: '/', icon: Gauge },
      { label: 'Role Views', detail: 'Front desk, nursing, provider, manager lanes', to: '/roles', icon: LayoutDashboard },
      { label: 'Find Patients', detail: 'Search charts and demographics', to: '/patients', icon: Users },
      { label: 'Task Queue', detail: 'Open, assigned, and urgent tasks', to: '/tasks', icon: ClipboardList },
      { label: 'Schedule', detail: 'Clinic week and visit states', to: '/scheduling', icon: Calendar },
      { label: 'Fax Center', detail: 'Inbound, outbound, matching, OCR', to: '/faxes', icon: Printer },
      { label: 'Messages', detail: 'Patient and staff conversations', to: '/messaging', icon: MessageSquare },
    ],
    [],
  );
  const filtered = actions.filter((action) =>
    `${action.label} ${action.detail}`.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-lg">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            placeholder="Search commands, patients, queues..."
          />
          <button onClick={onClose} aria-label="Close command palette" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.map(({ label, detail, to, icon: Icon }) => (
            <button
              key={to}
              onClick={() => {
                navigate({ to });
                onClose();
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors duration-150 hover:bg-canvas-sunk"
            >
              <Icon className="h-4 w-4 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium text-ink">{label}</span>
                <span className="block truncate text-micro text-ink-muted">{detail}</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-8 text-center text-small text-ink-faint">No matching commands</div>}
        </div>
      </div>
    </div>
  );
}

function ClinicalAssistantPanel({
  pathname,
  className = 'hidden w-[280px] shrink-0 border-l border-border bg-canvas-raised xl:block',
}: {
  pathname: string;
  className?: string;
}) {
  const [completedAction, setCompletedAction] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AssistantAction | null>(null);
  const { contextChips, suggestions } = useClinicalAssistantTools({
    pathname,
    onCompleted: (message) => {
      setCompletedAction(message);
      setPendingAction(null);
    },
  });

  return (
    <aside className={className}>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-accent-soft bg-accent-soft">
            <Bot className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="text-subhead font-medium text-ink">Suggestions</h2>
            <p className="text-meta text-ink-muted">Actions based on current view</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 text-meta font-medium text-ink-muted">Context</div>
        <div className="flex flex-wrap gap-1.5">
          {contextChips.map((chip) => (
            <span key={chip} className="rounded-sm bg-canvas-sunk px-2 py-1 text-micro text-ink-secondary">
              {chip}
            </span>
          ))}
        </div>
      </div>

      {completedAction && (
        <div className="border-b border-accent-soft bg-accent-soft px-4 py-3 text-small text-accent">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {completedAction}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="border-b border-warn/20 bg-warn/10 px-4 py-3">
          <div className="text-meta font-medium text-warn">Confirm action</div>
          <div className="mt-1 text-small font-medium text-ink">{pendingAction.title}</div>
          <p className="mt-1 text-small leading-5 text-ink-secondary">{pendingAction.detail}</p>
          <details className="mt-2 rounded-sm border border-warn/20 bg-canvas-raised px-2 py-1 text-micro text-ink-muted">
            <summary className="cursor-pointer font-medium text-ink-secondary">Audit detail</summary>
            <div className="mt-1 font-mono">{pendingAction.toolId}</div>
          </details>
          <div className="mt-3 flex gap-2">
            <button
              onClick={pendingAction.run}
              disabled={pendingAction.pending}
              className="inline-flex h-8 items-center rounded-md bg-ink px-2.5 text-small font-medium text-canvas-raised hover:bg-ink-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction.pending ? 'Working...' : pendingAction.confirmLabel}
            </button>
            <button
              onClick={() => setPendingAction(null)}
              disabled={pendingAction.pending}
              className="inline-flex h-8 items-center rounded-md border border-border bg-canvas-raised px-2.5 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-border">
        {suggestions.map(({ label, detail, tone, actionLabel, action, pending }) => (
          <div key={`${label}-${detail}`} className="px-4 py-3">
            <div className="text-meta font-medium text-ink-muted">{label}</div>
            <div className="mt-0.5 text-small text-ink-secondary">{detail}</div>
            <button
              onClick={() => setPendingAction(action)}
              disabled={pending}
              className="mt-2 inline-flex h-8 items-center rounded-md border border-border bg-canvas-raised px-2.5 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? 'Working...' : actionLabel}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

function AssistantDrawer({ open, pathname, onClose }: { open: boolean; pathname: string; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 xl:hidden" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-80 max-w-[92vw] flex-col border-l border-border bg-canvas-raised shadow-lg">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 text-small font-medium text-ink">
            <Bot className="h-4 w-4 text-accent" />
            Suggestions
          </div>
          <button onClick={onClose} aria-label="Close clinical assistant" className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ClinicalAssistantPanel pathname={pathname} className="block min-h-0 flex-1 overflow-y-auto bg-canvas-raised" />
      </div>
    </div>
  );
}

function RootLayout() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (pathname === '/login' || pathname === '/patient-portal') {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-canvas ${density === 'compact' ? 'text-[0.9375rem]' : ''}`}>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          density={density}
          onDensityChange={() => setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'))}
          onCommandOpen={() => setCommandOpen(true)}
          onSettingsOpen={() => setSettingsOpen(true)}
          onMenuOpen={() => setMobileNavOpen(true)}
          onAssistantOpen={() => setAssistantOpen(true)}
        />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto">
            <div className={density === 'compact' ? 'p-3' : 'p-5'}>
              <Outlet />
            </div>
          </main>
          <ClinicalAssistantPanel pathname={pathname} />
        </div>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <AssistantDrawer open={assistantOpen} pathname={pathname} onClose={() => setAssistantOpen(false)} />
      <SettingsPanel
        open={settingsOpen}
        density={density}
        onDensityChange={() => setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'))}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-canvas p-6">
      <ErrorState title="The frontend hit a runtime error" detail={error.message} />
    </div>
  ),
});
