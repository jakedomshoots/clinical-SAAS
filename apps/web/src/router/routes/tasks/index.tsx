import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Task, TaskPatientOutreachDraft, User } from '@concierge-os/shared';
import { Plus, CheckCircle2, Clock, AlertCircle, AlertTriangle, X, PlayCircle, Ban, Save, MessageSquare } from 'lucide-react';

interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  page_size: number;
}

interface UserListResponse {
  data: User[];
  total: number;
}

const PRIORITY_ICONS: Record<string, React.ReactNode> = {
  low: <Clock className="h-3.5 w-3.5" />,
  normal: <CheckCircle2 className="h-3.5 w-3.5" />,
  high: <AlertCircle className="h-3.5 w-3.5" />,
  urgent: <AlertTriangle className="h-3.5 w-3.5" />,
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-clinic-100 text-clinic-600',
  in_progress: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-clinic-100 text-clinic-400 line-through',
};

export const Route = createFileRoute('/tasks/')({
  component: TaskListPage,
});

function TaskListPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showNewTask, setShowNewTask] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState<TaskPatientOutreachDraft | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'normal',
    due_date: '',
    patient_name: '',
    assigned_to_id: '',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, statusFilter, priorityFilter, sourceFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      return api.get<TaskListResponse>(`/tasks?${params}`);
    },
  });
  const filteredTasks = data?.data.filter((task) => (
    sourceFilter === 'checkout' ? task.source_type?.startsWith('checkout_handoff:') : true
  )) ?? [];
  const { data: staff } = useQuery({
    queryKey: QUERY_KEYS.USERS,
    queryFn: () => api.get<UserListResponse>(ROUTES.USERS),
  });
  const staffRows = staff?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<Task> }) =>
      api.patch(ROUTES.TASK(id), update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Task>('/tasks', {
      ...newTask,
      status: 'open',
      assigned_to_id: newTask.assigned_to_id || null,
      due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      setShowNewTask(false);
      setNewTask({ title: '', description: '', priority: 'normal', due_date: '', patient_name: '', assigned_to_id: '' });
    },
  });

  const outreachMutation = useMutation({
    mutationFn: (taskId: string) => api.post<TaskPatientOutreachDraft>(ROUTES.TASK_PATIENT_OUTREACH(taskId), {}),
    onSuccess: (draft) => setOutreachDraft(draft),
  });

  function updateTask(id: string, update: Partial<Task>) {
    updateMutation.mutate({ id, update });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Tasks</h1>
        <button onClick={() => setShowNewTask(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'open', 'in_progress', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-accent-600 text-white'
                : 'border border-clinic-300 text-clinic-600 hover:bg-clinic-100'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
        <div className="h-8 w-px bg-clinic-200" />
        {['', 'high', 'urgent'].map((priority) => (
          <button
            key={priority || 'any-priority'}
            onClick={() => { setPriorityFilter(priority); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              priorityFilter === priority
                ? 'bg-clinic-800 text-white'
                : 'border border-clinic-300 text-clinic-600 hover:bg-clinic-100'
            }`}
          >
            {priority ? `${priority} priority` : 'Any priority'}
          </button>
        ))}
        <button
          onClick={() => { setSourceFilter(sourceFilter === 'checkout' ? '' : 'checkout'); setPage(1); }}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            sourceFilter === 'checkout'
              ? 'bg-amber-600 text-white'
              : 'border border-clinic-300 text-clinic-600 hover:bg-clinic-100'
          }`}
        >
          Checkout tasks
        </button>
      </div>

      {isLoading ? (
        <LoadingState label="Loading tasks" />
      ) : isError ? (
        <ErrorState title="Unable to load tasks" detail={error instanceof Error ? error.message : 'The task queue could not be loaded.'} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-clinic-200 bg-white">
          <table className="w-full min-w-[58rem] text-sm">
            <thead className="border-b border-clinic-200 bg-clinic-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Priority</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Title</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Assigned</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500">Due</th>
                <th className="px-4 py-3 text-left font-medium text-clinic-500"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b border-clinic-100 hover:bg-clinic-50">
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={(event) => updateTask(task.id, { status: event.target.value as Task['status'] })}
                      className={`rounded-md border-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[task.status]}`}
                    >
                      {['open', 'in_progress', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-1 text-xs text-clinic-500">
                      {PRIORITY_ICONS[task.priority]}
                      <select
                        value={task.priority}
                        onChange={(event) => updateTask(task.id, { priority: event.target.value as Task['priority'] })}
                        className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs text-clinic-700"
                      >
                        {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
                      </select>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-clinic-800">{task.title}</div>
                    {task.source_type?.startsWith('checkout_handoff:') && (
                      <div className="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        {task.source_type.replace('checkout_handoff:', 'checkout ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-clinic-600">
                    <select
                      value={task.assigned_to_id ?? ''}
                      onChange={(event) => updateTask(task.id, { assigned_to_id: event.target.value || null })}
                      className="w-40 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs text-clinic-700"
                    >
                      <option value="">Unassigned</option>
                      {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-clinic-600">{task.patient_name || '—'}</td>
                  <td className="px-4 py-3 text-clinic-500 text-xs">
                    <input
                      type="datetime-local"
                      value={toDateTimeInput(task.due_date)}
                      onChange={(event) => updateTask(task.id, { due_date: event.target.value ? new Date(event.target.value).toISOString() : null })}
                      className={dueTone(task)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {task.status === 'open' && (
                        <button
                          onClick={() => updateTask(task.id, { status: 'in_progress' })}
                          className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          Start
                        </button>
                      )}
                      {task.status !== 'completed' && (
                      <button
                        onClick={() => updateTask(task.id, { status: 'completed' })}
                        className="inline-flex items-center gap-1 rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </button>
                      )}
                      {task.status !== 'cancelled' && task.status !== 'completed' && (
                        <button
                          onClick={() => updateTask(task.id, { status: 'cancelled' })}
                          className="inline-flex items-center gap-1 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-600 hover:bg-clinic-50"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      )}
                      {task.patient_id && (
                        <button
                          onClick={() => outreachMutation.mutate(task.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-clinic-200 bg-white px-2 py-1 text-xs font-medium text-clinic-600 hover:bg-clinic-50"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Outreach
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No tasks found"
                      detail={statusFilter ? 'Try another status filter or create a new task.' : 'No work is queued for the current filter.'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewTask && (
        <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg rounded-md border border-clinic-300 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-900">New Task</h2>
              <button type="button" onClick={() => setShowNewTask(false)} className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block text-sm font-medium text-clinic-700">
                Title
                <input required value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm font-medium text-clinic-700">
                Description
                <textarea value={newTask.description} onChange={(event) => setNewTask({ ...newTask, description: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-clinic-700">
                  Priority
                  <select value={newTask.priority} onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm">
                    {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Due
                  <input type="datetime-local" value={newTask.due_date} onChange={(event) => setNewTask({ ...newTask, due_date: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-clinic-700">
                  Patient
                  <input value={newTask.patient_name} onChange={(event) => setNewTask({ ...newTask, patient_name: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block text-sm font-medium text-clinic-700">
                Assignee
                <select value={newTask.assigned_to_id} onChange={(event) => setNewTask({ ...newTask, assigned_to_id: event.target.value })} className="mt-1 w-full rounded-md border border-clinic-300 px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name} - {formatRole(user.role)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setShowNewTask(false)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">Cancel</button>
              <button disabled={createMutation.isPending} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                <Save className="mr-1 inline h-3.5 w-3.5" />
                {createMutation.isPending ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {outreachDraft && (
        <div className="fixed inset-0 z-50 bg-clinic-900/20 p-4">
          <div className="mx-auto mt-24 max-w-xl rounded-md border border-clinic-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-clinic-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-clinic-900">Patient Outreach Draft</h2>
                <p className="mt-1 text-xs text-clinic-500">{outreachDraft.patient_name} - {outreachDraft.patient_phone ?? outreachDraft.patient_email ?? 'No contact on file'}</p>
              </div>
              <button type="button" onClick={() => setOutreachDraft(null)} className="rounded-md p-1 text-clinic-500 hover:bg-clinic-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <div className="text-xs font-medium uppercase text-clinic-500">Subject</div>
                <div className="mt-1 rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm text-clinic-800">{outreachDraft.subject}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase text-clinic-500">Body</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-md border border-clinic-200 bg-clinic-50 px-3 py-2 text-sm leading-6 text-clinic-800">{outreachDraft.body}</pre>
              </div>
            </div>
            <div className="flex justify-end border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setOutreachDraft(null)} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function dueTone(task: Task) {
  const base = 'w-44 rounded-md border px-2 py-1 text-xs';
  if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return `${base} border-clinic-200 bg-white text-clinic-600`;
  const due = new Date(task.due_date).getTime();
  const now = Date.now();
  if (due < now) return `${base} border-red-200 bg-red-50 font-medium text-red-800`;
  if (due - now < 24 * 60 * 60 * 1000) return `${base} border-amber-200 bg-amber-50 font-medium text-amber-800`;
  return `${base} border-clinic-200 bg-white text-clinic-600`;
}

function formatRole(role: User['role']) {
  return role.replace('_', ' ');
}
