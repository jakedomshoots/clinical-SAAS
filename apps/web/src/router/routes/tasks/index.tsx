import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared'
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import type { Task } from '@concierge-os/shared';
import { Plus, CheckCircle2, Clock, AlertCircle, AlertTriangle, X } from 'lucide-react';

interface TaskListResponse {
  data: Task[];
  total: number;
  page: number;
  page_size: number;
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
  const [page, setPage] = useState(1);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'normal',
    due_date: '',
    patient_name: '',
    assigned_to_name: 'Clinic Admin',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: '20' });
      if (statusFilter) params.set('status', statusFilter);
      return api.get<TaskListResponse>(`/tasks?${params}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(ROUTES.TASK(id), { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<Task>('/tasks', {
      ...newTask,
      status: 'open',
      due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS });
      setShowNewTask(false);
      setNewTask({ title: '', description: '', priority: 'normal', due_date: '', patient_name: '', assigned_to_name: 'Clinic Admin' });
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Tasks</h1>
        <button onClick={() => setShowNewTask(true)} className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      <div className="mb-4 flex gap-2">
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
              {data?.data.map((task) => (
                <tr key={task.id} className="border-b border-clinic-100 hover:bg-clinic-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-clinic-500">
                      {PRIORITY_ICONS[task.priority]}
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-clinic-800">{task.title}</td>
                  <td className="px-4 py-3 text-clinic-600">{task.assigned_to_name || '—'}</td>
                  <td className="px-4 py-3 text-clinic-600">{task.patient_name || '—'}</td>
                  <td className="px-4 py-3 text-clinic-500 text-xs">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    {task.status !== 'completed' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: task.id, status: 'completed' })}
                        className="text-xs text-accent-600 hover:text-accent-700"
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
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
            </div>
            <div className="flex justify-end gap-2 border-t border-clinic-200 px-4 py-3">
              <button type="button" onClick={() => setShowNewTask(false)} className="rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-700 hover:bg-clinic-50">Cancel</button>
              <button disabled={createMutation.isPending} className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                {createMutation.isPending ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
