import { Link, Navigate, Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router';
import {useAuth} from '@/lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { ErrorState } from '@/lib/ui-state';
import type { Fax, MessageThread, Patient, Task } from '@concierge-os/shared';
import {
  Activity,
  Bot,
  Calendar,
  Check,
  ClipboardList,
  Command,
  Gauge,
  LogOut,
  Menu,
  MessageSquare,
  Printer,
  Search,
  Sparkles,
  Settings,
  X,
  Users,
} from 'lucide-react';

interface ListResponse<T> {
  data: T[];
  total: number;
}

function SideNav() {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', label: 'Command', icon: Gauge },
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/scheduling', label: 'Schedule', icon: Calendar },
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messaging', label: 'Messages', icon: MessageSquare },
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
    { to: '/patients', label: 'Patients', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: ClipboardList },
    { to: '/scheduling', label: 'Schedule', icon: Calendar },
    { to: '/faxes', label: 'Faxes', icon: Printer },
    { to: '/messaging', label: 'Messages', icon: MessageSquare },
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
  if (!open) return null;

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

interface AssistantAction {
  title: string;
  detail: string;
  confirmLabel: string;
  run: () => void;
  pending: boolean;
}

function ClinicalAssistantPanel({
  pathname,
  className = 'hidden w-72 shrink-0 border-l border-clinic-200 bg-white xl:block',
}: {
  pathname: string;
  className?: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [completedAction, setCompletedAction] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AssistantAction | null>(null);
  const patientId = pathname.match(/^\/patients\/([^/]+)/)?.[1];

  const { data: tasks } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<Task>>('/tasks?page=1&page_size=20'),
  });
  const { data: faxes } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<Fax>>('/faxes?direction=inbound&page=1&page_size=20'),
  });
  const { data: threads } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });
  const { data: patient } = useQuery({
    queryKey: patientId ? QUERY_KEYS.PATIENT(patientId) : ['clinical-assistant', 'no-patient'],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    enabled: Boolean(patientId),
  });

  const urgentTask = tasks?.data.find((task) => task.status !== 'completed' && task.priority === 'urgent');
  const unmatchedFax = faxes?.data.find((fax) => !fax.patient_id);
  const unreadThread = threads?.data.find((thread) => thread.unread_count > 0);
  const activeTask = tasks?.data.find((task) => task.status === 'in_progress');
  const routeLabel = pathname.startsWith('/patients/')
    ? 'Patient chart'
    : pathname.startsWith('/patients')
      ? 'Patient search'
      : pathname.startsWith('/tasks')
        ? 'Task queue'
        : pathname.startsWith('/scheduling')
          ? 'Schedule'
          : pathname.startsWith('/faxes')
            ? 'Fax center'
            : pathname.startsWith('/messaging')
              ? 'Messages'
              : 'Command center';

  const invalidateAssistantData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT }),
    ]);
  };

  const createFollowUpTask = useMutation({
    mutationFn: () =>
      api.post<Task>('/tasks', {
        title: patient ? `Review chart and follow up with ${patient.first_name} ${patient.last_name}` : 'Review assistant flagged follow-up',
        description: patient
          ? `Assistant staged this from the ${routeLabel.toLowerCase()}. Confirm chart context before outreach.`
          : `Assistant staged this from the ${routeLabel.toLowerCase()}.`,
        priority: patient ? 'high' : 'normal',
        status: 'open',
        due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        patient_id: patient?.id ?? urgentTask?.patient_id ?? null,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : urgentTask?.patient_name ?? null,
      }),
    onSuccess: async () => {
      setCompletedAction('Follow-up task created');
      setPendingAction(null);
      await invalidateAssistantData();
    },
  });

  const draftPortalReply = useMutation({
    mutationFn: () =>
      api.post('/messages', {
        recipient_id: patient?.id ?? unreadThread?.participants.find((participant) => participant.name !== 'Clinic Admin')?.id ?? 'patient',
        subject: unreadThread?.subject ?? `Follow-up for ${patient ? `${patient.first_name} ${patient.last_name}` : 'your visit'}`,
        body: patient
          ? `Hi ${patient.first_name}, your care team is reviewing your chart and will follow up with next steps.`
          : 'Hi, your care team is reviewing this and will follow up with next steps.',
        thread_id: unreadThread?.id,
      }),
    onSuccess: async () => {
      setCompletedAction('Portal reply drafted');
      setPendingAction(null);
      await invalidateAssistantData();
    },
  });

  const matchFaxToPatient = useMutation({
    mutationFn: () =>
      api.patch<Fax>(`/faxes/${unmatchedFax?.id}`, {
        patient_id: patient?.id ?? urgentTask?.patient_id ?? '00000000-0000-4000-8000-000000000101',
        patient_name: patient
          ? `${patient.first_name} ${patient.last_name}`
          : urgentTask?.patient_name ?? 'Mary Collins',
        matched_by: 'assistant suggested, user confirmed',
      }),
    onSuccess: async () => {
      setCompletedAction('Fax match staged');
      setPendingAction(null);
      await invalidateAssistantData();
    },
  });

  const suggestions = [
    urgentTask && {
      label: 'Urgent callback',
      detail: urgentTask.title,
      tone: 'red',
      actionLabel: 'Create follow-up',
      action: {
        title: 'Create follow-up task',
        detail: patient
          ? `This will create a high-priority task tied to ${patient.first_name} ${patient.last_name}.`
          : `This will create a follow-up task tied to ${urgentTask.patient_name ?? 'the urgent queue item'}.`,
        confirmLabel: 'Create task',
        run: () => createFollowUpTask.mutate(),
        pending: createFollowUpTask.isPending,
      },
      pending: createFollowUpTask.isPending,
    },
    unmatchedFax && {
      label: 'Possible fax match',
      detail: patient
        ? `Match ${unmatchedFax.pages} page${unmatchedFax.pages === 1 ? '' : 's'} to ${patient.first_name} ${patient.last_name}`
        : `${unmatchedFax.pages} page${unmatchedFax.pages === 1 ? '' : 's'} need patient matching`,
      tone: 'amber',
      actionLabel: 'Stage match',
      action: {
        title: 'Stage fax match',
        detail: patient
          ? `This will attach the unmatched inbound fax to ${patient.first_name} ${patient.last_name}.`
          : 'This will stage the inbound fax against the assistant suggested patient for staff review.',
        confirmLabel: 'Stage match',
        run: () => matchFaxToPatient.mutate(),
        pending: matchFaxToPatient.isPending,
      },
      pending: matchFaxToPatient.isPending,
    },
    activeTask && {
      label: 'Work in motion',
      detail: activeTask.title,
      tone: 'green',
      actionLabel: 'Draft update',
      action: {
        title: 'Draft portal update',
        detail: 'This will draft a portal message but will not send it.',
        confirmLabel: 'Draft update',
        run: () => draftPortalReply.mutate(),
        pending: draftPortalReply.isPending,
      },
      pending: draftPortalReply.isPending,
    },
    unreadThread && {
      label: 'Portal reply',
      detail: unreadThread.subject,
      tone: 'neutral',
      actionLabel: 'Draft reply',
      action: {
        title: 'Draft portal reply',
        detail: `This will draft a reply in the "${unreadThread.subject}" thread but will not send it.`,
        confirmLabel: 'Draft reply',
        run: () => draftPortalReply.mutate(),
        pending: draftPortalReply.isPending,
      },
      pending: draftPortalReply.isPending,
    },
  ].filter(Boolean) as Array<{
    label: string;
    detail: string;
    tone: string;
    actionLabel: string;
    action: AssistantAction;
    pending: boolean;
  }>;

  const contextChips = [
    routeLabel,
    patient && `${patient.first_name} ${patient.last_name}`,
    urgentTask && 'urgent task',
    unmatchedFax && 'unmatched fax',
    unreadThread && 'unread portal',
  ].filter(Boolean) as string[];

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
        {(suggestions.length > 0
          ? suggestions
          : [
              {
                label: 'All clear',
                detail: 'No pinned urgent work right now',
                tone: 'green',
                actionLabel: 'Create follow-up',
                action: {
                  title: 'Create follow-up task',
                  detail: `This will create a general follow-up task from the ${routeLabel.toLowerCase()}.`,
                  confirmLabel: 'Create task',
                  run: () => createFollowUpTask.mutate(),
                  pending: createFollowUpTask.isPending,
                },
                pending: createFollowUpTask.isPending,
              },
            ]
        ).map(({ label, detail, tone, actionLabel, action, pending }) => (
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
