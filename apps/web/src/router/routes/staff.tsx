import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROUTES, type Role, type SessionPolicy, type User, type UserAccessReviewSummary, type UserListResponse, type UserPasswordResetResponse, type UserRecoverySummary, type UserUpdate } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import { CheckCircle2, Clock3, KeyRound, ShieldAlert, ShieldCheck, UserCheck, UserX, type LucideIcon } from 'lucide-react';

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
  const { data: accessReview } = useQuery({
    queryKey: QUERY_KEYS.USER_ACCESS_REVIEW,
    queryFn: () => api.get<UserAccessReviewSummary>(ROUTES.USER_ACCESS_REVIEW),
  });
  const { data: sessionPolicy } = useQuery({
    queryKey: ['session-policy'],
    queryFn: () => api.get<SessionPolicy>(ROUTES.SESSION_POLICY),
  });
  const { data: recoverySummary } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'recovery-summary'],
    queryFn: () => api.get<UserRecoverySummary>(ROUTES.USER_RECOVERY_SUMMARY),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, update }: { id: string; update: UserUpdate }) =>
      api.patch<User>(ROUTES.USER(id), update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_ACCESS_REVIEW });
    },
  });
  const reviewMutation = useMutation({
    mutationFn: ({ id, mfa_enabled }: { id: string; mfa_enabled?: boolean }) =>
      api.post<User>(ROUTES.USER_ACCESS_REVIEW_MARK(id), {
        note: 'Access reviewed from Staff console.',
        ...(typeof mfa_enabled === 'boolean' ? { mfa_enabled } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_ACCESS_REVIEW });
    },
  });
  const resetMutation = useMutation({
    mutationFn: (id: string) => api.post<UserPasswordResetResponse>(ROUTES.USER_PASSWORD_RESET(id), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.USERS, 'recovery-summary'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_ACCESS_REVIEW });
    },
  });
  const staff = data?.data ?? [];
  const reviewByUserId = new Map((accessReview?.data ?? []).map((item) => [item.user.id, item]));
  const mfaEnabledCount = staff.filter((user) => user.mfa_enabled).length;
  const stats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Active', value: staff.filter((user) => user.is_active).length, icon: UserCheck },
    { label: 'MFA enabled', value: mfaEnabledCount, icon: ShieldCheck },
    { label: 'Review due', value: accessReview?.due_count ?? 0, icon: Clock3 },
    { label: 'Privileged MFA gaps', value: accessReview?.privileged_without_mfa_count ?? 0, icon: ShieldAlert },
    { label: 'Inactive', value: accessReview?.inactive_count ?? 0, icon: UserX },
  ];
  const latestReset = resetMutation.data;

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
        <>
          <section className="rounded-md border border-clinic-200 bg-white">
            <div className="grid gap-px bg-clinic-100 md:grid-cols-5">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-clinic-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-2xl font-semibold text-clinic-900">{value}</div>
                    <Icon className="h-4 w-4 text-accent-700" />
                  </div>
                  <div className="mt-1 text-xs text-clinic-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 border-t border-clinic-100 px-4 py-3 text-sm md:grid-cols-3">
              <PolicyLine label="MFA policy" value={sessionPolicy?.mfa_required ? 'Required in production' : 'Staged for production'} />
              <PolicyLine label="Provider" value={sessionPolicy?.mfa_provider ?? 'local_policy'} />
              <PolicyLine label="Review cadence" value={`${accessReview?.review_window_days ?? sessionPolicy?.access_review_window_days ?? 90} days`} />
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-clinic-200 bg-white">
            <div className="grid gap-px border-b border-clinic-100 bg-clinic-100 md:grid-cols-3">
              <div className="bg-white px-4 py-3">
                <div className="text-2xl font-semibold text-clinic-900">{recoverySummary?.temporary_password_count ?? 0}</div>
                <div className="mt-1 text-xs text-clinic-500">Temporary credentials</div>
              </div>
              <div className="bg-white px-4 py-3">
                <div className="text-2xl font-semibold text-red-700">{recoverySummary?.expired_temporary_password_count ?? 0}</div>
                <div className="mt-1 text-xs text-clinic-500">Expired onboarding</div>
              </div>
              <div className="bg-white px-4 py-3">
                <div className="text-2xl font-semibold text-clinic-900">{latestReset?.temporary_password ? 'Issued' : 'Ready'}</div>
                <div className="mt-1 text-xs text-clinic-500">Recovery reset</div>
              </div>
            </div>
            {latestReset && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Temporary password for {latestReset.user.email}: <span className="font-mono font-semibold">{latestReset.temporary_password}</span>
                <span className="ml-2 text-xs">Expires {formatDate(latestReset.temporary_password_expires_at)}</span>
              </div>
            )}
            <div className="border-b border-clinic-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-clinic-900">Access Review Queue</h2>
              <p className="mt-1 text-xs text-clinic-500">Review account status, privileged access, MFA readiness, and stale access evidence before production use.</p>
            </div>
            <div className="divide-y divide-clinic-100">
              {staff.map((user) => {
                const review = reviewByUserId.get(user.id);
                const needsReview = review?.review_status === 'needs_review';
                return (
                  <div key={user.id} className="grid gap-3 px-4 py-3 lg:grid-cols-[1.5fr_11rem_8rem_1.4fr_9rem]">
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
                      <div className="mt-1 text-[11px] text-clinic-400">Last login: {formatDate(user.last_login_at)}</div>
                      {user.password_must_change && (
                        <div className={`mt-1 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${isExpired(user.temporary_password_expires_at) ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                          <KeyRound className="h-3 w-3" />
                          {isExpired(user.temporary_password_expires_at) ? 'Temp expired' : 'Temp active'}
                        </div>
                      )}
                    </div>
                    <select
                      value={user.role}
                      onChange={(event) => updateMutation.mutate({ id: user.id, update: { role: event.target.value as Role } })}
                      className="h-9 rounded-md border border-clinic-200 bg-white px-2 text-sm text-clinic-700"
                    >
                      {ROLES.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                    </select>
                    <button
                      onClick={() => updateMutation.mutate({ id: user.id, update: { mfa_enabled: !user.mfa_enabled } })}
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium ${user.mfa_enabled ? 'border-accent-200 bg-accent-50 text-accent-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}
                    >
                      {user.mfa_enabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      {user.mfa_enabled ? 'MFA on' : 'MFA gap'}
                    </button>
                    <div className="min-w-0 text-xs">
                      <div className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-medium ${needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-accent-200 bg-accent-50 text-accent-700'}`}>
                        {needsReview ? <Clock3 className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {needsReview ? 'Needs review' : 'Current'}
                      </div>
                      <div className="mt-1 truncate text-clinic-500">{review?.recommended_action ?? 'Review status not loaded.'}</div>
                      <div className="mt-1 text-clinic-400">Reviewed: {formatDate(user.access_reviewed_at)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      <button
                        onClick={() => updateMutation.mutate({ id: user.id, update: { is_active: !user.is_active } })}
                        className="rounded-md border border-clinic-300 px-3 py-2 text-sm font-medium text-clinic-700 hover:bg-clinic-50"
                      >
                        {user.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => reviewMutation.mutate({ id: user.id, mfa_enabled: user.role === 'admin' || user.role === 'manager' ? true : user.mfa_enabled })}
                        className="rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700"
                      >
                        Mark reviewed
                      </button>
                      <button
                        onClick={() => resetMutation.mutate(user.id)}
                        disabled={resetMutation.isPending}
                        className="col-span-2 rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-60 lg:col-span-1"
                      >
                        Reset password
                      </button>
                    </div>
                  </div>
                );
              })}
              {staff.length === 0 && <EmptyState title="No staff found" detail="Create users through registration or seed data first." />}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PolicyLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-clinic-500">{label}</div>
      <div className="mt-1 font-semibold text-clinic-900">{value}</div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleDateString();
}

function isExpired(value: string | null | undefined) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}
