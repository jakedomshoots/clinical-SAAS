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
  Bot,
  Calendar,
  Check,
  ClipboardList,
  Command,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Printer,
  Search,
  Sparkles,
  Settings,
  ShieldCheck,
  X,
  Users,
} from 'lucide-react';

function SideNav() {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Command', icon: Gauge },
    { to: '/roles', label: 'Role Views', icon: LayoutDashboard },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/staff', label: 'Staff', icon: ShieldCheck },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/scheduling', label: 'Schedule', icon: Calendar },
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messaging', label: 'Messages', icon: MessageSquare },
    { to: '/operations', label: 'Operations', icon: ShieldCheck },
  ];

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-clinic-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-clinic-200 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-accent-200 bg-accent-50">
          <Activity className="h-4 w-4 text-accent-700" />
        </div>
        <div>
          <span className="block text-sm font-semibold text-clinic-900">ConciergeOS</span>
          <span className="block text-xs text-clinic-500">Clinic operations</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-clinic-600 transition-colors hover:bg-clinic-100 hover:text-clinic-900 [&.active]:bg-clinic-100 [&.active]:text-clinic-900"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-3 mb-3 rounded-md border border-clinic-200 bg-clinic-50 p-3">
        <div className="flex items-center justify-between text-xs font-medium text-clinic-600">
          <span>Supervisor</span>
          <span className="inline-flex items-center gap-1 text-accent-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
            Online
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-clinic-500">
          <span>API healthy</span>
          <span>Sync current</span>
          <span>Backups on</span>
          <span>Fax ready</span>
        </div>
      </div>

      <div className="border-t border-clinic-200 p-3">
        <div className="mb-1 text-xs text-clinic-400">{user?.display_name}</div>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-clinic-500 hover:bg-clinic-100 hover:text-red-600"
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-clinic-200 bg-white px-5">
      <button onClick={onMenuOpen} aria-label="Open navigation" className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-clinic-300 bg-white text-clinic-600 hover:bg-clinic-50 md:hidden">
        <Menu className="h-4 w-4" />
      </button>
      <button onClick={onCommandOpen} className="flex h-9 w-full max-w-xl items-center gap-3 rounded-md border border-clinic-300 bg-clinic-50 px-3 text-left text-sm text-clinic-500 hover:border-clinic-400 hover:bg-white">
        <Search className="h-4 w-4 text-clinic-400" />
        <span className="min-w-0 flex-1 truncate">Search patients, tasks, faxes, messages</span>
        <span className="inline-flex items-center gap-1 rounded border border-clinic-200 bg-white px-1.5 py-0.5 text-xs text-clinic-500">
          <Command className="h-3 w-3" />
          K
        </span>
      </button>
      <div className="ml-4 flex items-center gap-2">
        <button onClick={onAssistantOpen} aria-label="Open clinical assistant" className="flex h-9 w-9 items-center justify-center rounded-md border border-clinic-300 bg-white text-clinic-600 hover:bg-clinic-50 xl:hidden">
          <Bot className="h-4 w-4" />
        </button>
        <button onClick={onDensityChange} className="hidden items-center gap-1.5 rounded-md border border-clinic-200 bg-clinic-50 px-2.5 py-1.5 text-xs font-medium text-clinic-600 hover:bg-white sm:inline-flex">
          Density
          <span className="rounded bg-white px-1.5 py-0.5 text-clinic-800">{density === 'comfortable' ? 'Comfort' : 'Compact'}</span>
        </button>
        <button onClick={onSettingsOpen} aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-md border border-clinic-300 bg-white text-clinic-600 hover:bg-clinic-50">
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
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messaging', label: 'Messages', icon: MessageSquare },
    { to: '/operations', label: 'Operations', icon: ShieldCheck },
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-clinic-900/20 md:hidden">
      <div className="flex h-full w-72 max-w-[86vw] flex-col border-r border-clinic-200 bg-white shadow-xl">
        <div className="flex h-14 items-center justify-between border-b border-clinic-200 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-accent-200 bg-accent-50">
              <Activity className="h-4 w-4 text-accent-700" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-clinic-900">ConciergeOS</span>
              <span className="block text-xs text-clinic-500">Clinic operations</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close navigation" className="flex h-8 w-8 items-center justify-center rounded-md text-clinic-500 hover:bg-clinic-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-clinic-600 hover:bg-clinic-100 hover:text-clinic-900 [&.active]:bg-clinic-100 [&.active]:text-clinic-900"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-clinic-200 p-3">
          <div className="mb-1 text-xs text-clinic-400">{user?.display_name}</div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-clinic-500 hover:bg-clinic-100 hover:text-red-600"
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
    <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4" role="dialog" aria-modal="true">
      <div className="ml-auto h-full max-w-md overflow-hidden rounded-md border border-clinic-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-clinic-900">Settings</h2>
            <p className="text-xs text-clinic-500">Local frontend preferences and supervisor status</p>
          </div>
          <button onClick={onClose} aria-label="Close settings" className="flex h-8 w-8 items-center justify-center rounded-md text-clinic-500 hover:bg-clinic-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <section>
            <h3 className="text-xs font-semibold uppercase text-clinic-500">Reminder Rules</h3>
            <div className="mt-2 space-y-3 rounded-md border border-clinic-200 bg-clinic-50 p-3">
              <label className="block text-sm font-medium text-clinic-700">
                Timing offsets
                <input
                  disabled={!canManageSettings}
                  value={offsets}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_offsets_minutes: event.target.value.split(',').map((value) => Number(value.trim())).filter(Number.isFinite) })}
                  className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm disabled:bg-clinic-100"
                />
              </label>
              <label className="block text-sm font-medium text-clinic-700">
                Sender identity
                <input
                  disabled={!canManageSettings}
                  value={effectiveSettings.sender_identity ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, sender_identity: event.target.value })}
                  className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm disabled:bg-clinic-100"
                />
              </label>
              <label className="block text-sm font-medium text-clinic-700">
                SMS template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_sms_template ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_sms_template: event.target.value })}
                  className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm disabled:bg-clinic-100"
                />
              </label>
              <label className="block text-sm font-medium text-clinic-700">
                Email template
                <textarea
                  disabled={!canManageSettings}
                  rows={3}
                  value={effectiveSettings.reminder_email_template ?? ''}
                  onChange={(event) => setSettingsForm({ ...settingsForm, reminder_email_template: event.target.value })}
                  className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm disabled:bg-clinic-100"
                />
              </label>
              <button
                disabled={!canManageSettings || Object.keys(settingsForm).length === 0 || settingsMutation.isPending}
                onClick={() => settingsMutation.mutate(settingsForm)}
                className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50"
              >
                {settingsMutation.isPending ? 'Saving...' : 'Save reminder settings'}
              </button>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase text-clinic-500">Workspace</h3>
            <div className="mt-2 rounded-md border border-clinic-200 bg-clinic-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-clinic-600">Mode</span>
                <span className="font-medium text-clinic-900">Demo fallback</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-clinic-600">API</span>
                <span className="font-medium text-amber-700">Waiting for backend infra</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-clinic-600">Persistence</span>
                <span className="font-medium text-clinic-900">Local browser storage</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase text-clinic-500">Density</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['comfortable', 'compact'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    if (option !== density) onDensityChange();
                  }}
                  className={`rounded-md border px-3 py-2 text-sm font-medium capitalize ${
                    density === option
                      ? 'border-accent-300 bg-accent-50 text-accent-800'
                      : 'border-clinic-300 text-clinic-700 hover:bg-clinic-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase text-clinic-500">Status</h3>
            <ul className="mt-2 space-y-2 text-sm text-clinic-700">
              {['React shell ready', 'Demo API fallback ready', 'Command palette ready', 'Backend infra not required for frontend review'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent-600" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase text-clinic-500">Demo Data</h3>
            <button
              onClick={() => {
                window.localStorage.removeItem('concierge-os.demo-data.v1');
                window.location.reload();
              }}
              className="mt-2 rounded-md border border-clinic-300 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
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
    <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4" role="dialog" aria-modal="true">
      <div className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-md border border-clinic-300 bg-white shadow-xl">
        <div className="flex items-center gap-3 border-b border-clinic-200 px-3 py-2">
          <Search className="h-4 w-4 text-clinic-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 flex-1 bg-transparent text-sm text-clinic-900 outline-none placeholder:text-clinic-400"
            placeholder="Search commands, patients, queues..."
          />
          <button onClick={onClose} aria-label="Close command palette" className="flex h-8 w-8 items-center justify-center rounded-md text-clinic-500 hover:bg-clinic-100">
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
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-clinic-50"
            >
              <Icon className="h-4 w-4 text-accent-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-clinic-900">{label}</span>
                <span className="block truncate text-xs text-clinic-500">{detail}</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-8 text-center text-sm text-clinic-400">No matching commands</div>}
        </div>
      </div>
    </div>
  );
}

function ClinicalAssistantPanel({
  pathname,
  className = 'hidden w-72 shrink-0 border-l border-clinic-200 bg-white xl:block',
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
      <div className="border-b border-clinic-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-accent-200 bg-accent-50">
            <Bot className="h-4 w-4 text-accent-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-clinic-800">Clinical Assistant</h2>
            <p className="text-xs text-clinic-500">Context-aware shift support</p>
          </div>
        </div>
      </div>

      <div className="border-b border-clinic-100 px-4 py-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-clinic-500">
          <Sparkles className="h-3.5 w-3.5 text-accent-700" />
          Readable context
        </div>
        <div className="flex flex-wrap gap-1.5">
          {contextChips.map((chip) => (
            <span key={chip} className="rounded border border-clinic-200 bg-clinic-50 px-2 py-1 text-xs font-medium text-clinic-700">
              {chip}
            </span>
          ))}
        </div>
      </div>

      {completedAction && (
        <div className="border-b border-accent-100 bg-accent-50 px-4 py-3 text-sm text-accent-800">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {completedAction}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase text-amber-800">Confirm action</div>
          <div className="mt-1 text-sm font-semibold text-clinic-900">{pendingAction.title}</div>
          <p className="mt-1 text-xs leading-5 text-clinic-600">{pendingAction.detail}</p>
          <div className="mt-2 rounded border border-amber-200 bg-white px-2 py-1 font-mono text-[0.6875rem] text-clinic-500">
            {pendingAction.toolId}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={pendingAction.run}
              disabled={pendingAction.pending}
              className="inline-flex h-8 items-center rounded-md bg-clinic-900 px-2.5 text-xs font-semibold text-white hover:bg-clinic-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction.pending ? 'Working...' : pendingAction.confirmLabel}
            </button>
            <button
              onClick={() => setPendingAction(null)}
              disabled={pendingAction.pending}
              className="inline-flex h-8 items-center rounded-md border border-clinic-300 bg-white px-2.5 text-xs font-semibold text-clinic-700 hover:bg-clinic-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-clinic-100">
        {suggestions.map(({ label, detail, tone, actionLabel, action, pending }) => (
          <div key={`${label}-${detail}`} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  tone === 'red'
                    ? 'bg-red-600'
                    : tone === 'amber'
                      ? 'bg-amber-600'
                      : tone === 'green'
                        ? 'bg-accent-600'
                        : 'bg-clinic-400'
                }`}
              />
              <span className="text-xs font-semibold uppercase text-clinic-500">{label}</span>
            </div>
            <div className="mt-1 text-sm font-medium text-clinic-800">{detail}</div>
            <button
              onClick={() => setPendingAction(action)}
              disabled={pending}
              className="mt-3 inline-flex h-8 items-center rounded-md border border-clinic-300 bg-white px-2.5 text-xs font-semibold text-clinic-700 hover:bg-clinic-50 disabled:cursor-not-allowed disabled:opacity-60"
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
    <div className="fixed inset-0 z-50 bg-clinic-900/20 xl:hidden" role="dialog" aria-modal="true">
      <div className="ml-auto flex h-full w-80 max-w-[92vw] flex-col border-l border-clinic-200 bg-white shadow-xl">
        <div className="flex h-12 items-center justify-between border-b border-clinic-200 px-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-clinic-900">
            <Bot className="h-4 w-4 text-accent-700" />
            Clinical Assistant
          </div>
          <button onClick={onClose} aria-label="Close clinical assistant" className="flex h-8 w-8 items-center justify-center rounded-md text-clinic-500 hover:bg-clinic-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ClinicalAssistantPanel pathname={pathname} className="block min-h-0 flex-1 overflow-y-auto bg-white" />
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

  if (pathname === '/login') {
    return <Outlet />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className={`flex h-screen overflow-hidden bg-clinic-50 ${density === 'compact' ? 'text-[0.9375rem]' : ''}`}>
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
    <div className="min-h-screen bg-clinic-50 p-6">
      <ErrorState title="The frontend hit a runtime error" detail={error.message} />
    </div>
  ),
});
