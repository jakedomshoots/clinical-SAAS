import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState, humanizeWorkflowLabel } from '@/lib/ui-state';
import { Badge } from '@/components/badge';
import type { Task, TaskOutreachSummary, TaskPatientOutreachDelivery, TaskPatientOutreachDraft, TaskWorkQueue, User } from '@concierge-os/shared';
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
  open: 'bg-canvas-sunk text-ink-muted',
  in_progress: 'bg-accent-soft text-accent',
  blocked: 'bg-danger/10 text-danger',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-canvas-sunk text-ink-faint line-through',
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
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState<TaskPatientOutreachDraft | null>(null);
  const [deliveryResult, setDeliveryResult] = useState<TaskPatientOutreachDelivery | null>(null);
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
  const { data: outreachSummary } = useQuery({
    queryKey: QUERY_KEYS.TASK_OUTREACH_SUMMARY,
    queryFn: () => api.get<TaskOutreachSummary>(ROUTES.TASK_PATIENT_OUTREACH_SUMMARY),
  });
  const { data: workQueue } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'work-queue'],
    queryFn: () => api.get<TaskWorkQueue>(ROUTES.TASK_WORK_QUEUE),
  });
  const staffRows = staff?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Partial<Task> }) =>
      api.patch(ROUTES.TASK(id), update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
  });
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ tasks: taskRows, update }: { tasks: Task[]; update: Partial<Task> }) => {
      await Promise.all(taskRows.map((task) => api.patch(ROUTES.TASK(task.id), update)));
    },
    onSuccess: () => {
      setSelectedTaskIds([]);
      setBulkAssigneeId('');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT });
    },
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
    onSuccess: (draft) => {
      setDeliveryResult(null);
      setOutreachDraft(draft);
    },
  });

  const deliverMutation = useMutation({
    mutationFn: ({ draft, channel }: { draft: TaskPatientOutreachDraft; channel: 'sms' | 'email' }) =>
      api.post<TaskPatientOutreachDelivery>(ROUTES.TASK_PATIENT_OUTREACH_DELIVER(draft.task_id), {
        channel,
        subject: draft.subject,
        body: draft.body,
      }),
    onSuccess: (result) => {
      setDeliveryResult(result);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASK_OUTREACH_SUMMARY });
    },
  });

  function updateTask(id: string, update: Partial<Task>) {
    updateMutation.mutate({ id, update });
  }
  const selectedTasks = filteredTasks.filter((task) => selectedTaskIds.includes(task.id));
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((current) => current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId]);
  };
  const visibleTaskIds = filteredTasks.map((task) => task.id);
  const allVisibleSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.includes(id));
  const toggleVisibleTasks = () => {
    setSelectedTaskIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleTaskIds.includes(id));
      return Array.from(new Set([...current, ...visibleTaskIds]));
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-display text-ink">Tasks</h1>
        <button onClick={() => setShowNewTask(true)} className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="mr-2 flex items-center text-meta font-medium text-ink-faint">Status</div>
        {['', 'open', 'in_progress', 'blocked', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-ink text-canvas-raised border border-ink'
                : 'border border-border bg-canvas-raised text-ink-secondary hover:border-border-strong hover:bg-canvas-sunk'
            }`}
          >
            {s ? humanizeWorkflowLabel(s) : 'All'}
          </button>
        ))}
        <div className="h-8 w-px bg-border" />
        <div className="mr-2 flex items-center text-meta font-medium text-ink-faint">Priority</div>
        {['', 'high', 'urgent'].map((priority) => (
          <button
            key={priority || 'any-priority'}
            onClick={() => { setPriorityFilter(priority); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              priorityFilter === priority
                ? 'bg-ink text-canvas-raised border border-ink'
                : 'border border-border bg-canvas-raised text-ink-secondary hover:border-border-strong hover:bg-canvas-sunk'
            }`}
          >
            {priority ? `${humanizeWorkflowLabel(priority)} priority` : 'Any priority'}
          </button>
        ))}
        <button
          onClick={() => { setSourceFilter(sourceFilter === 'checkout' ? '' : 'checkout'); setPage(1); }}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            sourceFilter === 'checkout'
              ? 'bg-warn text-canvas-raised'
              : 'border border-border bg-canvas-raised text-ink-secondary hover:border-border-strong hover:bg-canvas-sunk'
          }`}
        >
          <span>Checkout follow-ups</span>
          <span className="ml-1 text-[10px] opacity-80">post-visit</span>
        </button>
      </div>

      <section className="mb-4 grid gap-2 md:grid-cols-4">
        {[
          ['Queued', outreachSummary?.queued_count ?? 0],
          ['Delivered', outreachSummary?.delivered_count ?? 0],
          ['Blocked', outreachSummary?.blocked_count ?? 0],
          ['Needs retry', outreachSummary?.retryable_failed_count ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="bg-canvas-raised border border-border rounded-md px-3 py-2">
            <div className="font-serif text-lg font-medium text-ink">{value}</div>
            <div className="text-micro text-ink-muted">{label}</div>
          </div>
        ))}
      </section>

      {workQueue && (
        <section className="mb-4 bg-canvas-raised border border-border rounded-md">
          <div className="border-b border-border px-4 py-3 flex flex-wrap justify-between gap-3">
            <div>
              <h2 className="text-subhead font-medium text-ink">Work Queue Control</h2>
              <p className="text-micro text-ink-muted">{new Date(workQueue.generated_at).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge intent="danger">{workQueue.overdue_count} overdue</Badge>
              <Badge intent="danger">{workQueue.blocked_count} blocked</Badge>
              <Badge intent="warn">{workQueue.unassigned_count} unassigned</Badge>
              <Badge intent="muted">{workQueue.due_today_count} due today</Badge>
            </div>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-2 md:grid-cols-5">
              {[
                ['Open', workQueue.open_count],
                ['In progress', workQueue.in_progress_count],
                ['Blocked', workQueue.blocked_count],
                ['Urgent', workQueue.urgent_count],
                ['High priority', workQueue.high_priority_count],
              ].map(([label, value]) => (
                <div key={label} className="bg-canvas-sunk border border-border rounded-md px-3 py-2">
                  <div className="font-serif text-lg font-medium text-ink">{value}</div>
                  <div className="text-micro text-ink-muted">{label}</div>
                </div>
              ))}
              <div className="md:col-span-3">
                <div className="mb-1 text-meta font-medium text-ink-faint">Role buckets</div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {Object.entries(workQueue.role_buckets).map(([role, bucket]) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setStatusFilter('')}
                      className="rounded-md border border-border bg-canvas-raised px-2 py-1.5 text-left text-small hover:bg-canvas-sunk transition-colors"
                    >
                      <span className="font-medium capitalize text-ink">{role.replace('_', ' ')}</span>
                      <span className="ml-2 text-ink-muted">{bucket.open_count} open · {bucket.urgent_count} urgent</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-meta font-medium text-ink-faint">Source buckets</div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {Object.entries(workQueue.source_buckets).map(([source, count]) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => { setSourceFilter(source === 'checkout_handoff' ? 'checkout' : ''); setPage(1); }}
                      className="rounded-md border border-border bg-canvas-raised px-2 py-1.5 text-left text-small hover:bg-canvas-sunk transition-colors"
                    >
                      <span className="font-medium capitalize text-ink">{source.replace('_', ' ')}</span>
                      <span className="ml-2 text-ink-muted">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <aside className="border border-border rounded-md">
              <div className="border-b border-border px-3 py-2 text-meta font-medium text-ink-faint">Next actions</div>
              <div className="divide-y divide-border">
                {workQueue.next_actions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => {
                      if (action.key === 'blocked') setStatusFilter('blocked');
                      if (action.key === 'overdue') setStatusFilter('');
                      if (action.key === 'urgent') setPriorityFilter('urgent');
                      if (action.key === 'unassigned') setStatusFilter('');
                      setPage(1);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-canvas-sunk transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-small font-medium text-ink">{action.label}</span>
                      <Badge intent={action.severity === 'critical' ? 'danger' : 'warn'}>{action.severity}</Badge>
                    </div>
                    <div className="mt-1 text-micro text-ink-muted">{action.detail}</div>
                  </button>
                ))}
                {workQueue.next_actions.length === 0 && (
                  <div className="px-3 py-6 text-small text-ink-faint">No work queue actions.</div>
                )}
              </div>
            </aside>
          </div>
        </section>
      )}

      {isLoading ? (
        <LoadingState label="Loading tasks" />
      ) : isError ? (
        <ErrorState title="Unable to load tasks" detail={error instanceof Error ? error.message : 'The task queue could not be loaded.'} />
      ) : (
        <div className="overflow-x-auto">
          {selectedTaskIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-canvas-sunk px-4 py-2 border-b border-border">
              <div className="text-meta font-medium text-ink-secondary">{selectedTaskIds.length} selected</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={bulkAssigneeId}
                  onChange={(event) => setBulkAssigneeId(event.target.value)}
                  className="rounded-md border border-border bg-canvas px-2 py-1.5 text-small text-ink-secondary"
                >
                  <option value="">Choose assignee</option>
                  {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => bulkUpdateMutation.mutate({ tasks: selectedTasks, update: { assigned_to_id: bulkAssigneeId || null } })}
                  disabled={bulkUpdateMutation.isPending || selectedTasks.length === 0}
                  className="rounded-md border border-border bg-canvas-raised px-3 py-1.5 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-50 transition-colors"
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => bulkUpdateMutation.mutate({ tasks: selectedTasks, update: { status: 'in_progress' } })}
                  disabled={bulkUpdateMutation.isPending || selectedTasks.length === 0}
                  className="rounded-md border border-accent-soft bg-accent-soft px-3 py-1.5 text-small font-medium text-accent hover:bg-accent-soft/80 disabled:opacity-50 transition-colors"
                >
                  Start selected
                </button>
                <button
                  type="button"
                  onClick={() => bulkUpdateMutation.mutate({ tasks: selectedTasks, update: { status: 'blocked' } })}
                  disabled={bulkUpdateMutation.isPending || selectedTasks.length === 0}
                  className="rounded-md border border-danger/20 bg-danger/10 px-3 py-1.5 text-small font-medium text-danger hover:bg-danger/20 disabled:opacity-50 transition-colors"
                >
                  Block selected
                </button>
                <button
                  type="button"
                  onClick={() => bulkUpdateMutation.mutate({ tasks: selectedTasks, update: { status: 'completed' } })}
                  disabled={bulkUpdateMutation.isPending || selectedTasks.length === 0}
                  className="rounded-md border border-success/20 bg-success/10 px-3 py-1.5 text-small font-medium text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                >
                  Complete selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTaskIds([])}
                  className="rounded-md border border-border bg-canvas-raised px-3 py-1.5 text-small font-medium text-ink-secondary hover:bg-canvas-sunk transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          <table className="w-full min-w-[58rem] text-sm">
            <thead className="bg-canvas-sunk border-b border-border">
              <tr>
                <th className="w-10 px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleTasks}
                    className="h-4 w-4 rounded border-border text-accent"
                    aria-label="Select visible tasks"
                  />
                </th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Status</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Title</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Assigned</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Outreach</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase">Due</th>
                <th className="px-4 py-3 text-left text-meta font-medium text-ink-muted uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b border-border-subtle hover:bg-canvas-sunk/50 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.includes(task.id)}
                      onChange={() => toggleTaskSelection(task.id)}
                      className="h-4 w-4 rounded border-border text-accent"
                      aria-label={`Select ${task.title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={task.status}
                      onChange={(event) => updateTask(task.id, { status: event.target.value as Task['status'] })}
                      className={`border-0 rounded-sm px-2 py-1 text-micro font-medium ${STATUS_COLORS[task.status]}`}
                    >
                      {['open', 'in_progress', 'blocked', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{humanizeWorkflowLabel(status)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-1 text-small text-ink-muted">
                      {PRIORITY_ICONS[task.priority]}
                      <select
                        value={task.priority}
                        onChange={(event) => updateTask(task.id, { priority: event.target.value as Task['priority'] })}
                        className="rounded-md border border-border bg-canvas px-2 py-1 text-small text-ink-secondary"
                      >
                        {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{humanizeWorkflowLabel(priority)}</option>)}
                      </select>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{task.title}</div>
                    {task.source_type?.startsWith('checkout_handoff:') && (
                      <div className="mt-1 inline-flex bg-warn/10 text-warn border border-warn/20 rounded-md px-2 py-0.5 text-micro font-medium">
                        {task.source_type.replace('checkout_handoff:', 'checkout ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">
                    <select
                      value={task.assigned_to_id ?? ''}
                      onChange={(event) => updateTask(task.id, { assigned_to_id: event.target.value || null })}
                      className="w-40 rounded-md border border-border bg-canvas px-2 py-1 text-small text-ink-secondary"
                    >
                      <option value="">Unassigned</option>
                      {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-ink-secondary">{task.patient_name || '—'}</td>
                  <td className="px-4 py-3 text-small">
                    {task.delivery_status ? (
                      <div>
                        <span className={`inline-flex rounded-pill px-2 py-0.5 text-micro font-medium ${deliveryTone(task.delivery_status)}`}>
                          {humanizeWorkflowLabel(task.delivery_status)}
                        </span>
                        <div className="mt-1 text-ink-muted">{task.delivery_channel ?? 'outreach'} · {task.delivery_attempts} attempt{task.delivery_attempts === 1 ? '' : 's'}</div>
                        {task.delivery_error && <div className="mt-1 max-w-48 truncate text-warn">{task.delivery_error}</div>}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-muted text-small">
                    <input
                      type="datetime-local"
                      value={toDateTimeInput(task.due_date)}
                      onChange={(event) => updateTask(task.id, { due_date: event.target.value ? new Date(event.target.value).toISOString() : null })}
                      className={dueTone(task)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {(task.status === 'open' || task.status === 'blocked') && (
                        <button
                          onClick={() => updateTask(task.id, { status: 'in_progress' })}
                          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink-muted hover:text-ink hover:bg-canvas-sunk transition-colors"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          {task.status === 'blocked' ? 'Resume' : 'Start'}
                        </button>
                      )}
                      {task.status !== 'blocked' && task.status !== 'completed' && task.status !== 'cancelled' && (
                        <button
                          onClick={() => updateTask(task.id, { status: 'blocked' })}
                          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          Block
                        </button>
                      )}
                      {task.status !== 'completed' && (
                      <button
                        onClick={() => updateTask(task.id, { status: 'completed' })}
                        className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink-muted hover:text-success hover:bg-success/10 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </button>
                      )}
                      {task.status !== 'cancelled' && task.status !== 'completed' && (
                        <button
                          onClick={() => updateTask(task.id, { status: 'cancelled' })}
                          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink-muted hover:text-ink hover:bg-canvas-sunk transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancel
                        </button>
                      )}
                      {task.patient_id && (
                        <button
                          onClick={() => outreachMutation.mutate(task.id)}
                          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-small font-medium text-ink-muted hover:text-ink hover:bg-canvas-sunk transition-colors"
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
                  <td colSpan={9}>
                    <EmptyState
                      title="No tasks found"
                      detail={statusFilter ? 'Try another status filter or create a new task.' : 'No work is queued for the current filter. Create a task or check Setup if demo data is missing.'}
                      action={<button type="button" onClick={() => setShowNewTask(true)} className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-on hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">Create task</button>}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewTask && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
            className="mx-auto mt-24 max-w-lg bg-canvas-raised border border-border rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-subhead font-medium text-ink">New Task</h2>
              <button type="button" onClick={() => setShowNewTask(false)} className="text-ink-muted hover:text-ink rounded-md p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <label className="block text-small font-medium text-ink-secondary">
                Title
                <input required value={newTask.title} onChange={(event) => setNewTask({ ...newTask, title: event.target.value })} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft" />
              </label>
              <label className="block text-small font-medium text-ink-secondary">
                Description
                <textarea value={newTask.description} onChange={(event) => setNewTask({ ...newTask, description: event.target.value })} rows={3} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft" />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-small font-medium text-ink-secondary">
                  Priority
                  <select value={newTask.priority} onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft">
                    {['low', 'normal', 'high', 'urgent'].map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </label>
                <label className="text-small font-medium text-ink-secondary">
                  Due
                  <input type="datetime-local" value={newTask.due_date} onChange={(event) => setNewTask({ ...newTask, due_date: event.target.value })} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft" />
                </label>
                <label className="text-small font-medium text-ink-secondary">
                  Patient
                  <input value={newTask.patient_name} onChange={(event) => setNewTask({ ...newTask, patient_name: event.target.value })} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft" />
                </label>
              </div>
              <label className="block text-small font-medium text-ink-secondary">
                Assignee
                <select value={newTask.assigned_to_id} onChange={(event) => setNewTask({ ...newTask, assigned_to_id: event.target.value })} className="mt-1 w-full rounded-sm border border-border bg-canvas px-3 py-2 text-small text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft">
                  <option value="">Unassigned</option>
                  {staffRows.map((user) => <option key={user.id} value={user.id}>{user.display_name} - {formatRole(user.role)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button type="button" onClick={() => setShowNewTask(false)} className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-small text-ink-secondary hover:bg-canvas-sunk transition-colors">Cancel</button>
              <button disabled={createMutation.isPending} className="rounded-md bg-accent px-3 py-2 text-small font-medium text-accent-on hover:bg-accent-hover disabled:opacity-50 active:scale-[0.98] transition-transform duration-75">
                <Save className="mr-1 inline h-3.5 w-3.5" />
                {createMutation.isPending ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {outreachDraft && (
        <div className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="mx-auto mt-24 max-w-xl bg-canvas-raised border border-border rounded-lg shadow-lg animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-subhead font-medium text-ink">Patient Outreach Draft</h2>
                <p className="mt-1 text-micro text-ink-muted">{outreachDraft.patient_name} - {outreachDraft.patient_phone ?? outreachDraft.patient_email ?? 'No contact on file'}</p>
              </div>
              <button type="button" onClick={() => setOutreachDraft(null)} className="text-ink-muted hover:text-ink rounded-md p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-5">
              {deliveryResult && (
                <div className={`rounded-md border px-3 py-2 text-small ${deliveryResult.eligible ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                  {deliveryResult.eligible
                    ? `Queued ${deliveryResult.channel} delivery to ${deliveryResult.recipient}.`
                    : deliveryResult.blocked_reason ?? `${deliveryResult.channel} delivery is blocked.`}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {outreachDraft.channel_options.map((option) => (
                  <div key={option.channel} className={`rounded-md border px-3 py-2 text-small ${option.eligible ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}>
                    <div className="font-medium">{option.channel}</div>
                    <div className="mt-1">{option.eligible ? option.recipient : option.blocked_reason}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-meta font-medium text-ink-faint">Subject</div>
                <div className="mt-1 rounded-sm border border-border bg-canvas-sunk px-3 py-2 text-small text-ink">{outreachDraft.subject}</div>
              </div>
              <div>
                <div className="text-meta font-medium text-ink-faint">Body</div>
                <pre className="mt-1 whitespace-pre-wrap rounded-sm border border-border bg-canvas-sunk px-3 py-2 text-small leading-6 text-ink">{outreachDraft.body}</pre>
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-5 py-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => deliverMutation.mutate({ draft: outreachDraft, channel: 'sms' })}
                  disabled={deliverMutation.isPending || !outreachDraft.channel_options.find((option) => option.channel === 'sms')?.eligible}
                  className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-50 transition-colors"
                >
                  Queue SMS
                </button>
                <button
                  type="button"
                  onClick={() => deliverMutation.mutate({ draft: outreachDraft, channel: 'email' })}
                  disabled={deliverMutation.isPending || !outreachDraft.channel_options.find((option) => option.channel === 'email')?.eligible}
                  className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-small font-medium text-ink-secondary hover:bg-canvas-sunk disabled:opacity-50 transition-colors"
                >
                  Queue Email
                </button>
                <button type="button" onClick={() => setOutreachDraft(null)} className="rounded-md bg-accent px-3 py-2 text-small font-medium text-accent-on hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75">Done</button>
              </div>
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
  const base = 'w-44 rounded-sm border px-2 py-1 text-small outline-none focus:border-accent focus:ring-1 focus:ring-accent-soft';
  if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') return `${base} border-border bg-canvas text-ink-secondary`;
  const due = new Date(task.due_date).getTime();
  const now = Date.now();
  if (due < now) return `${base} border-danger/20 bg-danger/10 font-medium text-danger`;
  if (due - now < 24 * 60 * 60 * 1000) return `${base} border-warn/20 bg-warn/10 font-medium text-warn`;
  return `${base} border-border bg-canvas text-ink-secondary`;
}

function deliveryTone(status: string) {
  if (status === 'delivered') return 'bg-accent-soft text-accent';
  if (status === 'queued') return 'bg-accent-soft text-accent';
  if (status === 'failed' || status === 'blocked') return 'bg-warn/10 text-warn';
  return 'bg-canvas-sunk text-ink-muted';
}

function formatRole(role: User['role']) {
  return role.replace('_', ' ');
}
