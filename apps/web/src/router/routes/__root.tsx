import {
  Link,
  Navigate,
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { ViewModeProvider } from '@/lib/view-mode';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useClinicalAssistantTools, type AssistantAction } from '@/lib/assistant-tools';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ErrorState } from '@/lib/ui-state';
import { ROUTES, type ClinicSettings, type ClinicSettingsUpdate } from '@concierge-os/shared';
import { ToastProvider } from '@/components/toast';
import {
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
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  X,
  Users,
  type LucideIcon,
} from 'lucide-react';

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string | number };

type NavSection = { label: string; items: NavItem[] };

/** Live counts surfaced in the sidebar as red/amber badge dots */
function useNavBadges() {
  const api = useApi();
  const { data: taskData } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'nav-badge'],
    queryFn: () =>
      api.get<{
        data: { priority: string; status: string; notification_acknowledged_at: string | null }[];
        total: number;
      }>('/tasks?page=1&page_size=200'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: threadData } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'nav-badge'],
    queryFn: () => api.get<{ data: { unread_count: number }[] }>('/messages/threads'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const { data: faxData } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'nav-badge'],
    queryFn: () =>
      api.get<{ data: { patient_id: string | null; direction: string }[]; total: number }>(
        '/faxes?direction=inbound&page=1&page_size=100'
      ),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const urgentTasks = (taskData?.data ?? []).filter(
    (t) =>
      (t.priority === 'urgent' || t.priority === 'high') &&
      !t.notification_acknowledged_at &&
      t.status !== 'completed' &&
      t.status !== 'cancelled'
  ).length;
  const unreadMessages = (threadData?.data ?? []).reduce(
    (sum, t) => sum + (t.unread_count ?? 0),
    0
  );
  const unmatchedFaxes = (faxData?.data ?? []).filter(
    (f) => f.direction === 'inbound' && !f.patient_id
  ).length;

  return { urgentTasks, unreadMessages, unmatchedFaxes };
}

function SideNav({ theme, onThemeToggle }: { theme: 'light' | 'dark'; onThemeToggle: () => void }) {
  const { user, logout } = useAuth();
  const { urgentTasks, unreadMessages, unmatchedFaxes } = useNavBadges();

  const navSections: NavSection[] = [
    {
      label: 'Daily Work',
      items: [
        { to: '/', label: 'Command', icon: Gauge },
        { to: '/roles', label: 'Role Views', icon: LayoutDashboard },
        { to: '/scheduling', label: 'Schedule', icon: Calendar },
        { to: '/tasks', label: 'Tasks', icon: ClipboardList, badge: urgentTasks || undefined },
        {
          to: '/messaging',
          label: 'Messages',
          icon: MessageSquare,
          badge: unreadMessages || undefined,
        },
        { to: '/faxes', label: 'Faxes', icon: Printer, badge: unmatchedFaxes || undefined },
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
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (
          [
            '/staff',
            '/operations',
            '/integrations',
            '/assistant-review',
            '/setup',
            '/portal-mock',
          ].includes(item.to)
        )
          return user?.role === 'admin' || user?.role === 'manager';
        if (item.to === '/billing') return user?.role !== 'front_desk';
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-canvas-raised md:flex print:hidden">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-ink font-serif text-lg font-medium text-canvas-raised">
          C
        </div>
        <span className="font-serif text-base font-medium text-ink">ConciergeOS</span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {navSections.map((section) => (
          <div key={section.label}>
            <div className="px-3 pb-1 pt-4 text-meta font-medium text-ink-faint">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, badge }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-small text-ink-muted transition-colors duration-150 hover:bg-canvas-sunk hover:text-ink [&.active]:border-l-2 [&.active]:border-accent [&.active]:bg-accent-soft [&.active]:text-accent"
                >
                  <Icon className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge !== undefined &&
                    (typeof badge === 'number' ? (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    ) : (
                      <span className="ml-auto rounded-pill bg-accent-soft px-1.5 py-0.5 text-micro text-accent">
                        {badge}
                      </span>
                    ))}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-meta text-ink-faint">{user?.display_name}</span>
          <button
            onClick={onThemeToggle}
            aria-label="Toggle theme"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-canvas text-ink hover:bg-canvas-sunk active:scale-[0.95] transition-all cursor-pointer"
          >
            {theme === 'light' ? <Moon className="h-3.5 w-3.5 text-ink-secondary" /> : <Sun className="h-3.5 w-3.5 text-accent" />}
          </button>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-small text-ink-muted hover:bg-canvas-sunk hover:text-danger cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function TopBar({
  onCommandOpen,
  onSettingsOpen,
  onMenuOpen,
  onAssistantOpen,
}: {
  onCommandOpen: () => void;
  onSettingsOpen: () => void;
  onMenuOpen: () => void;
  onAssistantOpen: () => void;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-canvas-raised px-5 print:hidden">
      <button
        onClick={onMenuOpen}
        aria-label="Open navigation"
        className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk md:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <button
        onClick={onCommandOpen}
        className="flex h-9 w-full max-w-xl flex-1 items-center gap-3 rounded-pill border border-border bg-canvas px-4 py-2 text-left text-small text-ink-muted hover:border-border-strong hover:bg-canvas-raised"
      >
        <Search className="h-4 w-4 text-ink-faint" />
        <span className="min-w-0 flex-1 truncate">Search or ask ConciergeOS</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-canvas-raised px-1.5 py-0.5 text-meta text-ink-muted">
          <Command className="h-3 w-3" />K
        </span>
      </button>
      <div className="ml-4 flex items-center gap-2">
        <button
          onClick={onAssistantOpen}
          aria-label="Open clinical assistant"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk xl:hidden"
        >
          <Bot className="h-4 w-4" />
        </button>
        <button
          onClick={onSettingsOpen}
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function MobileNav({ open, onClose, theme, onThemeToggle }: { open: boolean; onClose: () => void; theme: 'light' | 'dark'; onThemeToggle: () => void }) {
  const { user, logout } = useAuth();
  const { urgentTasks, unreadMessages, unmatchedFaxes } = useNavBadges();
  const navItems = [
    { to: '/', label: 'Command', icon: Gauge },
    { to: '/roles', label: 'Role Views', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/staff', label: 'Staff', icon: ShieldCheck },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList, badge: urgentTasks || undefined },
    { to: '/scheduling', label: 'Schedule', icon: Calendar },
    { to: '/portal-intake', label: 'Intake', icon: ClipboardList },
    { to: '/portal-mock', label: 'Portal Mock', icon: ClipboardList, badge: 'Demo' },
    { to: '/billing', label: 'Billing', icon: CreditCard },
    { to: '/faxes', label: 'Faxes', icon: Printer, badge: unmatchedFaxes || undefined },
    { to: '/messaging', label: 'Messages', icon: MessageSquare, badge: unreadMessages || undefined },
    { to: '/integrations', label: 'Integrations', icon: PlugZap },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/assistant-review', label: 'Assistant Log', icon: Bot },
    { to: '/operations', label: 'Operations', icon: ShieldCheck },
    { to: '/setup', label: 'Setup', icon: Settings },
  ].filter((item) => {
    if (['/staff', '/operations', '/integrations', '/assistant-review', '/setup', '/portal-mock'].includes(item.to))
      return user?.role === 'admin' || user?.role === 'manager';
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
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map(({ to, label, icon: Icon, badge }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-small text-ink-muted transition-colors duration-150 hover:bg-canvas-sunk hover:text-ink [&.active]:border-l-2 [&.active]:border-accent [&.active]:bg-accent-soft [&.active]:text-accent"
            >
              <Icon className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {badge !== undefined &&
                (typeof badge === 'number' ? (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : (
                  <span className="ml-auto rounded-pill bg-accent-soft px-1.5 py-0.5 text-micro text-accent">
                    {badge}
                  </span>
                ))}
            </Link>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-meta text-ink-faint">{user?.display_name}</span>
            <button
              onClick={onThemeToggle}
              aria-label="Toggle theme"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-canvas text-ink hover:bg-canvas-sunk active:scale-[0.95] transition-all cursor-pointer"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5 text-ink-secondary" /> : <Sun className="h-3.5 w-3.5 text-accent" />}
            </button>
          </div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-small text-ink-muted hover:bg-canvas-sunk hover:text-danger cursor-pointer"
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
    mutationFn: (update: ClinicSettingsUpdate) =>
      api.patch<ClinicSettings>(ROUTES.SETTINGS, update),
    onSuccess: async () => {
      setSettingsForm({});
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SETTINGS });
    },
  });
  if (!open) return null;
  const effectiveSettings = { ...clinicSettings, ...settingsForm } as ClinicSettings;
  const offsets = (effectiveSettings.reminder_offsets_minutes ?? []).join(', ');

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="ml-auto h-full max-w-md overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-subhead font-medium text-ink">Settings</h2>
            <p className="text-meta text-ink-muted">
              Local frontend preferences and supervisor status
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
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
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      reminder_offsets_minutes: event.target.value
                        .split(',')
                        .map((value) => Number(value.trim()))
                        .filter(Number.isFinite),
                    })
                  }
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Sender identity
                <input
                  disabled={!canManageSettings}
                  value={effectiveSettings.sender_identity ?? ''}
                  onChange={(event) =>
                    setSettingsForm({ ...settingsForm, sender_identity: event.target.value })
                  }
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                SMS template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_sms_template ?? ''}
                  onChange={(event) =>
                    setSettingsForm({ ...settingsForm, reminder_sms_template: event.target.value })
                  }
                  className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Email template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_email_template ?? ''}
                  onChange={(event) =>
                    setSettingsForm({
                      ...settingsForm,
                      reminder_email_template: event.target.value,
                    })
                  }
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
                    onChange={(event) =>
                      setSettingsForm({
                        ...settingsForm,
                        audit_retention_days: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                  />
                </label>
                <label className="block text-small font-medium text-ink-secondary">
                  PHI re-auth minutes
                  <input
                    disabled={!canManageSettings}
                    type="number"
                    value={effectiveSettings.phi_reauth_minutes ?? ''}
                    onChange={(event) =>
                      setSettingsForm({
                        ...settingsForm,
                        phi_reauth_minutes: Number(event.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft disabled:bg-canvas-sunk disabled:opacity-60"
                  />
                </label>
              </div>
              <button
                disabled={
                  !canManageSettings ||
                  Object.keys(settingsForm).length === 0 ||
                  settingsMutation.isPending
                }
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
              {[
                'React shell ready',
                'Demo API fallback ready',
                'Backend infra not required for frontend review',
              ].map((item) => (
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
  const api = useApi();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const { data: patientResults } = useQuery({
    queryKey: ['command-palette-patients', debouncedQuery],
    queryFn: () =>
      api.get<{ data: { id: string; first_name: string; last_name: string; mrn: string }[] }>(
        `/patients?search=${encodeURIComponent(debouncedQuery)}&page=1&page_size=5`
      ),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const { data: taskResults } = useQuery({
    queryKey: ['command-palette-tasks', debouncedQuery],
    queryFn: () =>
      api.get<{ data: { id: string; title: string; status: string; priority: string }[] }>(
        `/tasks?search=${encodeURIComponent(debouncedQuery)}&page=1&page_size=5`
      ),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const navActions = useMemo(
    () => [
      {
        label: 'Open Command Center',
        detail: 'Clinic dashboard and live work',
        to: '/',
        icon: Gauge,
      },
      {
        label: 'Role Views',
        detail: 'Front desk, nursing, provider, manager lanes',
        to: '/roles',
        icon: LayoutDashboard,
      },
      {
        label: 'Find Patients',
        detail: 'Search charts and demographics',
        to: '/patients',
        icon: Users,
      },
      {
        label: 'Task Queue',
        detail: 'Open, assigned, and urgent tasks',
        to: '/tasks',
        icon: ClipboardList,
      },
      {
        label: 'Schedule',
        detail: 'Clinic week and visit states',
        to: '/scheduling',
        icon: Calendar,
      },
      {
        label: 'Fax Center',
        detail: 'Inbound, outbound, matching, OCR',
        to: '/faxes',
        icon: Printer,
      },
      {
        label: 'Messages',
        detail: 'Patient and staff conversations',
        to: '/messaging',
        icon: MessageSquare,
      },
    ],
    []
  );

  const filteredNav = navActions.filter((action) =>
    `${action.label} ${action.detail}`.toLowerCase().includes(query.toLowerCase())
  );

  const patients = patientResults?.data ?? [];
  const tasks = taskResults?.data ?? [];
  const hasLiveResults = patients.length > 0 || tasks.length > 0;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebouncedQuery('');
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-lg border border-border bg-canvas-raised shadow-lg">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            placeholder="Search patients, tasks, or navigate..."
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close command palette"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {/* Live patient results */}
          {patients.length > 0 && (
            <div>
              <div className="px-4 py-2 text-meta font-medium uppercase text-ink-faint">
                Patients
              </div>
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    navigate({ to: '/patients/$patientId', params: { patientId: p.id } });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-canvas-sunk"
                >
                  <Users className="h-4 w-4 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-medium text-ink">
                      {p.last_name}, {p.first_name}
                    </span>
                    <span className="block text-micro text-ink-muted font-mono">{p.mrn}</span>
                  </span>
                  <span className="text-micro text-ink-faint">Open chart →</span>
                </button>
              ))}
            </div>
          )}
          {/* Live task results */}
          {tasks.length > 0 && (
            <div>
              <div className="px-4 py-2 text-meta font-medium uppercase text-ink-faint">Tasks</div>
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    navigate({ to: '/tasks' });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-canvas-sunk"
                >
                  <ClipboardList className="h-4 w-4 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-medium text-ink">{t.title}</span>
                    <span className="block text-micro text-ink-muted capitalize">
                      {t.status.replace('_', ' ')} · {t.priority} priority
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* Nav actions */}
          {(!hasLiveResults || query.length < 2) && (
            <div>
              {hasLiveResults && (
                <div className="px-4 py-2 text-meta font-medium uppercase text-ink-faint">
                  Navigate
                </div>
              )}
              {filteredNav.map(({ label, detail, to, icon: Icon }) => (
                <button
                  key={to}
                  onClick={() => {
                    navigate({ to });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas-sunk"
                >
                  <Icon className="h-4 w-4 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-medium text-ink">{label}</span>
                    <span className="block truncate text-micro text-ink-muted">{detail}</span>
                  </span>
                </button>
              ))}
              {filteredNav.length === 0 && !hasLiveResults && (
                <div className="px-4 py-8 text-center text-small text-ink-faint">
                  No matching results
                </div>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-border px-4 py-2 flex items-center gap-4">
          <span className="text-micro text-ink-faint">
            Type 2+ characters to search patients and tasks
          </span>
          <span className="ml-auto text-micro text-ink-faint">
            <kbd className="font-mono">↵</kbd> to open · <kbd className="font-mono">Esc</kbd> to
            close
          </span>
        </div>
      </div>
    </div>
  );
}

function ClinicalAssistantPanel({
  pathname,
  className = 'hidden w-[280px] shrink-0 border-l border-border bg-canvas-raised xl:block print:hidden',
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
            <span
              key={chip}
              className="rounded-sm bg-canvas-sunk px-2 py-1 text-micro text-ink-secondary"
            >
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
            <summary className="cursor-pointer font-medium text-ink-secondary">
              Audit detail
            </summary>
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
        {suggestions.map(({ label, detail, actionLabel, action, pending }) => (
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

function AssistantDrawer({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 xl:hidden" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-80 max-w-[92vw] flex-col border-l border-border bg-canvas-raised shadow-lg">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2 text-small font-medium text-ink">
            <Bot className="h-4 w-4 text-accent" />
            Suggestions
          </div>
          <button
            onClick={onClose}
            aria-label="Close clinical assistant"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-canvas-sunk hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ClinicalAssistantPanel
          pathname={pathname}
          className="block min-h-0 flex-1 overflow-y-auto bg-canvas-raised"
        />
      </div>
    </div>
  );
}

function RouteTitle({ pathname }: { pathname: string }) {
  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Command Center',
      '/roles': 'Role Views',
      '/patients': 'Patients',
      '/scheduling': 'Schedule',
      '/tasks': 'Tasks',
      '/messaging': 'Messages',
      '/faxes': 'Faxes',
      '/portal-intake': 'Intake',
      '/billing': 'Billing',
      '/staff': 'Staff',
      '/reports': 'Reports',
      '/assistant-review': 'Assistant Log',
      '/operations': 'Operations',
      '/setup': 'Setup',
      '/integrations': 'Integrations',
    };
    const match = Object.keys(titles).find(
      (key) => pathname === key || (key !== '/' && pathname.startsWith(key))
    );
    document.title = match ? `${titles[match]} — ConciergeOS` : 'ConciergeOS';
  }, [pathname]);
  return null;
}

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col justify-center gap-4">
      <div>
        <p className="text-meta font-medium uppercase text-ink-faint">Page unavailable</p>
        <h1 className="mt-2 font-serif text-title text-ink">This workspace page is not available</h1>
        <p className="mt-2 text-body text-ink-muted">
          Return to the command center to continue clinic work.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex w-fit items-center justify-center rounded-md bg-accent px-4 py-2 text-small font-medium text-accent-on hover:bg-accent-hover"
      >
        Open Command Center
      </Link>
    </div>
  );
}

function AuthenticatedShell({ pathname }: { pathname: string }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

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

  return (
    <>
      <RouteTitle pathname={pathname} />
      <div
        className={`flex h-screen overflow-hidden bg-canvas ${density === 'compact' ? 'text-[0.9375rem]' : ''} print:h-auto print:overflow-visible`}
      >
        <SideNav theme={theme} onThemeToggle={toggleTheme} />
        <div className="flex min-w-0 flex-1 flex-col print:h-auto print:overflow-visible">
          <TopBar
            onCommandOpen={() => setCommandOpen(true)}
            onSettingsOpen={() => setSettingsOpen(true)}
            onMenuOpen={() => setMobileNavOpen(true)}
            onAssistantOpen={() => setAssistantOpen(true)}
          />
          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-auto print:h-auto print:overflow-visible">
              <div className={`${density === 'compact' ? 'p-3' : 'p-5'} print:p-0`}>
                <Outlet />
              </div>
            </main>
            <ClinicalAssistantPanel pathname={pathname} />
          </div>
        </div>
        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
        <MobileNav
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          theme={theme}
          onThemeToggle={toggleTheme}
        />
        <AssistantDrawer
          open={assistantOpen}
          pathname={pathname}
          onClose={() => setAssistantOpen(false)}
        />
        <SettingsPanel
          open={settingsOpen}
          density={density}
          onDensityChange={() =>
            setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'))
          }
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    </>
  );
}

function RootLayout() {
  const { isAuthenticated } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === '/login' || pathname === '/patient-portal') {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <ToastProvider>
      <ViewModeProvider>
        <AuthenticatedShell pathname={pathname} />
      </ViewModeProvider>
    </ToastProvider>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-canvas p-6">
      <ErrorState title="The frontend hit a runtime error" detail={error.message} />
    </div>
  ),
});
