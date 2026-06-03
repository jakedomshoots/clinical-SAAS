import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '@/lib/api-client';
import { ROUTES, QUERY_KEYS } from '@concierge-os/shared';
import type { Task, ApiEnvelope } from '@concierge-os/shared';
import { Plus, Loader2, CheckCircle2, Clock, AlertCircle, AlertTriangle } from 'lucide-react';

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

  const { data, isLoading } = useQuery({
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-clinic-800">Tasks</h1>
        <button className="flex items-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700">
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
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-clinic-400" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-clinic-200 bg-white">
          <table className="w-full text-sm">
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
                  <td colSpan={7} className="px-4 py-12 text-center text-clinic-400">No tasks found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
