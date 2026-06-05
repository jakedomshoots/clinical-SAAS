import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROUTES, type Role, type User, type UserListResponse, type UserUpdate } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { ShieldCheck, UserCheck, UserX } from 'lucide-react';

export const Route = createFileRoute('/staff')({
  component: StaffPage,
});

const ROLES: Role[] = ['admin', 'manager', 'provider', 'ma', 'front_desk'];

function StaffPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.USERS,
    queryFn: () => api.get<UserListResponse>(ROUTES.USERS),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: UserUpdate }) =>
      api.patch<User>(ROUTES.USER(id), update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
  });
  const staff = data?.data ?? [];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-clinic-500">Staff administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-clinic-900">Staff</h1>
      </header>

      {isLoading ? (
        <LoadingState label="Loading staff" />
      ) : isError ? (
        <ErrorState title="Unable to load staff" detail={error instanceof Error ? error.message : 'The staff directory could not be loaded.'} />
      ) : (
        <div className="overflow-hidden rounded-md border border-clinic-200 bg-white">
          <div className="grid grid-cols-4 gap-px border-b border-clinic-100 bg-clinic-100">
            {[
              ['Active', staff.filter((user) => user.is_active).length],
              ['Providers', staff.filter((user) => user.role === 'provider').length],
              ['Clinical', staff.filter((user) => ['provider', 'ma'].includes(user.role)).length],
              ['Managers', staff.filter((user) => ['admin', 'manager'].includes(user.role)).length],
            ].map(([label, value]) => (
              <div key={label} className="bg-clinic-50 px-4 py-3">
                <div className="text-2xl font-semibold text-clinic-900">{value}</div>
                <div className="mt-1 text-xs text-clinic-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="divide-y divide-clinic-100">
            {staff.map((user) => (
              <div key={user.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_12rem_10rem_9rem]">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {user.is_active ? <UserCheck className="h-4 w-4 text-accent-700" /> : <UserX className="h-4 w-4 text-clinic-400" />}
                    <input
                      value={user.display_name}
                      onChange={(event) => updateMutation.mutate({ id: user.id, update: { display_name: event.target.value } })}
                      className="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-clinic-900 hover:border-clinic-200 hover:bg-clinic-50"
                    />
                  </div>
                  <div className="mt-1 truncate text-xs text-clinic-500">{user.email}</div>
                </div>
                <select
                  value={user.role}
                  onChange={(event) => updateMutation.mutate({ id: user.id, update: { role: event.target.value as Role } })}
                  className="rounded-md border border-clinic-200 bg-white px-2 py-1 text-sm text-clinic-700"
                >
                  {ROLES.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                </select>
                <div className="inline-flex items-center gap-2 text-sm text-clinic-600">
                  <ShieldCheck className="h-4 w-4 text-accent-700" />
                  {user.is_active ? 'Active' : 'Inactive'}
                </div>
                <button
                  onClick={() => updateMutation.mutate({ id: user.id, update: { is_active: !user.is_active } })}
                  className="rounded-md border border-clinic-300 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
                >
                  {user.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            ))}
            {staff.length === 0 && <EmptyState title="No staff found" detail="Create users through registration or seed data first." />}
          </div>
        </div>
      )}
    </div>
  );
}
