import { createFileRoute } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ROUTES,
  type Role,
  type RoleAccessMatrix,
  type SessionPolicy,
  type User,
  type UserAccessReviewSummary,
  type UserListResponse,
  type UserPasswordResetResponse,
  type UserRecoverySummary,
  type UserUpdate,
} from '@concierge-os/shared';
import { Printer } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useApi } from '@/lib/api-client';
import { QUERY_KEYS } from '@/lib/query-keys';
import { EmptyState, ErrorState, LoadingState } from '@/lib/ui-state';
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  type LucideIcon,
} from 'lucide-react';

export const Route = createFileRoute('/staff')({
  component: StaffPage,
});

const ROLES: Role[] = ['admin', 'manager', 'provider', 'ma', 'front_desk'];

import { useDocumentTitle } from '@/hooks/use-document-title';

function StaffPage() {
  useDocumentTitle('Staff Administration');
  const api = useApi();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEYS.USERS,
    queryFn: () => api.get<UserListResponse>(ROUTES.USERS),
  });

  const staff = useMemo(() => data?.data ?? [], [data?.data]);

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const providers = useMemo(() => {
    return staff.filter((user) => user.role === 'provider' && user.is_active);
  }, [staff]);

  useEffect(() => {
    if (providers.length > 0 && !selectedProviderId) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const { data: availabilityData } = useQuery({
    queryKey: ['provider-availability', selectedProviderId],
    queryFn: () => {
      if (!selectedProviderId) return [];
      return api.get<{ id: string; provider_id: string; day_of_week: number; start_time: string; end_time: string }[]>(
        `/schedule/availability/${selectedProviderId}`
      );
    },
    enabled: !!selectedProviderId,
  });

  const weeklyAvailability = useMemo(() => {
    const days = [
      { name: 'Monday', index: 1, text: 'Off' },
      { name: 'Tuesday', index: 2, text: 'Off' },
      { name: 'Wednesday', index: 3, text: 'Off' },
      { name: 'Thursday', index: 4, text: 'Off' },
      { name: 'Friday', index: 5, text: 'Off' },
    ];
    if (!availabilityData) return days;
    return days.map((day) => {
      const match = availabilityData.find((a) => a.day_of_week === day.index);
      if (match) {
        const formatTime = (timeStr: string) => {
          const [hh, mm] = timeStr.split(':');
          const hour = parseInt(hh, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const formattedHour = hour % 12 || 12;
          return `${formattedHour}:${mm} ${ampm}`;
        };
        return {
          ...day,
          text: `${formatTime(match.start_time)} – ${formatTime(match.end_time)}`,
        };
      }
      return day;
    });
  }, [availabilityData]);
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
  const { data: roleMatrix } = useQuery({
    queryKey: [...QUERY_KEYS.USERS, 'role-access-matrix'],
    queryFn: () => api.get<RoleAccessMatrix>(ROUTES.USER_ROLE_ACCESS_MATRIX),
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
    mutationFn: (id: string) =>
      api.post<UserPasswordResetResponse>(ROUTES.USER_PASSWORD_RESET(id), {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.USERS, 'recovery-summary'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_ACCESS_REVIEW });
    },
  });

  const reviewByUserId = new Map((accessReview?.data ?? []).map((item) => [item.user.id, item]));
  const mfaEnabledCount = staff.filter((user) => user.mfa_enabled).length;
  const stats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Active', value: staff.filter((user) => user.is_active).length, icon: UserCheck },
    { label: 'MFA enabled', value: mfaEnabledCount, icon: ShieldCheck },
    { label: 'Review due', value: accessReview?.due_count ?? 0, icon: Clock3 },
    {
      label: 'Privileged MFA gaps',
      value: accessReview?.privileged_without_mfa_count ?? 0,
      icon: ShieldAlert,
    },
    { label: 'Inactive', value: accessReview?.inactive_count ?? 0, icon: UserX },
  ];
  const latestReset = resetMutation.data;

  return (
    <div className="space-y-5">
      <header className="print:hidden">
        <h1 className="font-serif text-display text-ink">Staff</h1>
        <p className="text-small text-ink-muted mt-1">Staff administration</p>
      </header>

      {isLoading ? (
        <LoadingState label="Loading staff" />
      ) : isError ? (
        <ErrorState
          title="Unable to load staff"
          detail={
            error instanceof Error ? error.message : 'The staff directory could not be loaded.'
          }
        />
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-5 print:hidden">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-canvas-raised border border-border rounded-md p-4">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-2xl font-medium text-ink">{value}</span>
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div className="text-meta text-ink-muted mt-1">{label}</div>
              </div>
            ))}
          </section>

          <section className="bg-canvas-raised border border-border rounded-md p-4 print:hidden">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <PolicyLine
                label="MFA policy"
                value={
                  sessionPolicy?.mfa_required ? 'Required in production' : 'Staged for production'
                }
              />
              <PolicyLine label="Provider" value={sessionPolicy?.mfa_provider ?? 'local_policy'} />
              <PolicyLine
                label="Review cadence"
                value={`${accessReview?.review_window_days ?? sessionPolicy?.access_review_window_days ?? 90} days`}
              />
            </div>
          </section>

          {roleMatrix && (
            <section className="bg-canvas-raised border border-border rounded-md print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-subhead font-medium text-ink">Role Access Matrix</h2>
                  <p className="text-small text-ink-muted mt-1">
                    {roleMatrix.total_roles} roles · {roleMatrix.summary.active_users ?? 0} active
                    staff · {roleMatrix.summary.privileged_users_without_mfa ?? 0} privileged MFA
                    gaps
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roleMatrix.warnings.slice(0, 3).map((warning) => (
                    <span
                      key={warning.key}
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${warning.severity === 'critical' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-warn/20 bg-warn/10 text-warn'}`}
                    >
                      {warning.label}
                    </span>
                  ))}
                  {roleMatrix.warnings.length === 0 && (
                    <span className="rounded-md border border-accent-soft bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                      Access clear
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-px bg-border md:grid-cols-5">
                {roleMatrix.roles.map((role) => (
                  <div key={role.role} className="bg-canvas-raised p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-small font-medium text-ink">{role.label}</div>
                      <span className="rounded-md border border-border bg-canvas-sunk px-2 py-0.5 text-micro font-medium text-ink-secondary">
                        {role.active_users}
                      </span>
                    </div>
                    <p className="mt-2 min-h-10 text-micro text-ink-muted">{role.summary}</p>
                    <div className="mt-3 grid gap-1 text-micro">
                      <AccessFlag enabled={role.can_manage_clinical} label="Clinical" />
                      <AccessFlag enabled={role.can_manage_front_office} label="Front office" />
                      <AccessFlag enabled={role.can_manage_staff} label="Staff/admin" />
                      <AccessFlag enabled={role.can_manage_operations} label="Operations" />
                      <AccessFlag enabled={role.can_export_audit} label="Audit export" />
                    </div>
                    {role.mfa_required && (
                      <div className="mt-3 rounded-md border border-warn/20 bg-warn/10 px-2 py-1 text-micro font-medium text-warn">
                        MFA required
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="bg-canvas-raised border border-border rounded-md p-4 print:border-none print:bg-transparent print:p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 mb-4 print:hidden">
              <div>
                <h2 className="text-subhead font-medium text-ink flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-accent" />
                  Staff Weekly Availability
                </h2>
                <p className="text-small text-ink-muted mt-1">
                  View shifts and weekly clinical hours for scheduling providers.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {providers.length > 0 && (
                  <select
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                    className="h-9 rounded-md border border-border bg-canvas px-3 text-small text-ink focus:border-accent focus:outline-none"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-secondary flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Print Schedule
                </button>
              </div>
            </div>

            {/* Print-only title */}
            <div className="hidden print:block mb-6 border-b border-ink/20 pb-4">
              <h1 className="font-serif text-3xl font-bold text-ink">Staff Weekly Availability Schedule</h1>
              <p className="text-small text-ink-secondary mt-1">
                Provider: <span className="font-semibold">{providers.find(p => p.id === selectedProviderId)?.display_name || 'Dr. Nora Ellis'}</span> ({providers.find(p => p.id === selectedProviderId)?.email})
              </p>
              <p className="text-micro text-ink-faint mt-1">Generated: {new Date().toLocaleString()}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-5 print:w-full print:grid-cols-5 print:gap-4">
              {weeklyAvailability.map((day) => (
                <div
                  key={day.name}
                  className={`rounded-md border p-3 flex flex-col justify-between min-h-24 ${
                    day.text === 'Off' 
                      ? 'border-border bg-canvas/30 text-ink-faint print:bg-transparent print:border-ink/10' 
                      : 'border-accent-soft bg-accent-soft text-accent print:bg-transparent print:border-accent'
                  }`}
                >
                  <div>
                    <div className="text-meta font-semibold text-ink-secondary print:text-ink">{day.name}</div>
                    <div className="mt-2 text-small font-medium font-mono print:text-ink">
                      {day.text}
                    </div>
                  </div>
                  <div className="mt-4 text-micro text-right font-medium">
                    {day.text === 'Off' ? 'Clinic Closed' : 'In-Office'}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="print:hidden">
            <div className="grid gap-px border-b border-border bg-border md:grid-cols-3">
              <div className="bg-canvas-raised px-4 py-3">
                <div className="font-serif text-2xl font-medium text-ink">
                  {recoverySummary?.temporary_password_count ?? 0}
                </div>
                <div className="text-meta text-ink-muted mt-1">Temporary credentials</div>
              </div>
              <div className="bg-canvas-raised px-4 py-3">
                <div className="font-serif text-2xl font-medium text-danger">
                  {recoverySummary?.expired_temporary_password_count ?? 0}
                </div>
                <div className="text-meta text-ink-muted mt-1">Expired onboarding</div>
              </div>
              <div className="bg-canvas-raised px-4 py-3">
                <div className="font-serif text-2xl font-medium text-ink">
                  {latestReset?.temporary_password ? 'Issued' : 'Ready'}
                </div>
                <div className="text-meta text-ink-muted mt-1">Recovery reset</div>
              </div>
            </div>
            {latestReset && (
              <div className="border-b border-warn/20 bg-warn/10 px-4 py-3 text-small text-warn">
                Temporary password for {latestReset.user.email}:{' '}
                <span className="font-mono font-semibold">{latestReset.temporary_password}</span>
                <span className="ml-2 text-micro">
                  Expires {formatDate(latestReset.temporary_password_expires_at)}
                </span>
              </div>
            )}
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-subhead font-medium text-ink">Access Review Queue</h2>
              <p className="text-small text-ink-muted mt-1">
                Review account status, privileged access, MFA readiness, and stale access evidence
                before production use.
              </p>
            </div>
            <div className="divide-y divide-border">
              {staff.map((user) => {
                const review = reviewByUserId.get(user.id);
                const needsReview = review?.review_status === 'needs_review';
                return (
                  <div
                    key={user.id}
                    className="grid gap-3 px-4 py-3 lg:grid-cols-[1.5fr_11rem_8rem_1.4fr_9rem] hover:bg-canvas-sunk/50 transition-colors duration-150"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {user.is_active ? (
                          <UserCheck className="h-4 w-4 text-accent" />
                        ) : (
                          <UserX className="h-4 w-4 text-ink-faint" />
                        )}
                        <input
                          value={user.display_name}
                          onChange={(event) =>
                            updateMutation.mutate({
                              id: user.id,
                              update: { display_name: event.target.value },
                            })
                          }
                          className="min-w-0 rounded-sm border border-transparent bg-transparent px-2 py-1 text-small font-medium text-ink hover:border-border hover:bg-canvas-sunk"
                        />
                      </div>
                      <div className="text-meta text-ink-muted mt-1 truncate">{user.email}</div>
                      <div className="text-micro text-ink-faint mt-1">
                        Last login: {formatDate(user.last_login_at)}
                      </div>
                      {user.password_must_change && (
                        <div
                          className={`mt-1 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-micro font-medium ${isExpired(user.temporary_password_expires_at) ? 'bg-danger/10 text-danger' : 'bg-warn/10 text-warn'}`}
                        >
                          <KeyRound className="h-3 w-3" />
                          {isExpired(user.temporary_password_expires_at)
                            ? 'Temp expired'
                            : 'Temp active'}
                        </div>
                      )}
                    </div>
                    <select
                      value={user.role}
                      onChange={(event) =>
                        updateMutation.mutate({
                          id: user.id,
                          update: { role: event.target.value as Role },
                        })
                      }
                      className="h-9 rounded-sm border border-border bg-canvas px-2 text-small text-ink"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          id: user.id,
                          update: { mfa_enabled: !user.mfa_enabled },
                        })
                      }
                      className={`inline-flex h-9 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium ${user.mfa_enabled ? 'border-accent-soft bg-accent-soft text-accent' : 'border-warn/20 bg-warn/10 text-warn'}`}
                    >
                      {user.mfa_enabled ? (
                        <ShieldCheck className="h-4 w-4" />
                      ) : (
                        <ShieldAlert className="h-4 w-4" />
                      )}
                      {user.mfa_enabled ? 'MFA on' : 'MFA gap'}
                    </button>
                    <div className="min-w-0 text-xs">
                      <div
                        className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 text-micro font-medium ${needsReview ? 'bg-warn/10 text-warn' : 'bg-accent-soft text-accent'}`}
                      >
                        {needsReview ? (
                          <Clock3 className="h-3.5 w-3.5" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {needsReview ? 'Needs review' : 'Current'}
                      </div>
                      <div className="text-meta text-ink-muted mt-1 truncate">
                        {review?.recommended_action ?? 'Review status not loaded.'}
                      </div>
                      <div className="text-micro text-ink-faint mt-1">
                        Reviewed: {formatDate(user.access_reviewed_at)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: user.id,
                            update: { is_active: !user.is_active },
                          })
                        }
                        className="rounded-md border border-border bg-canvas-raised px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-canvas-sunk active:scale-[0.98] transition-transform duration-75"
                      >
                        {user.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() =>
                          reviewMutation.mutate({
                            id: user.id,
                            mfa_enabled:
                              user.role === 'admin' || user.role === 'manager'
                                ? true
                                : user.mfa_enabled,
                          })
                        }
                        className="bg-accent text-accent-on rounded-md px-4 py-2 text-sm font-medium hover:bg-accent-hover active:scale-[0.98] transition-transform duration-75"
                      >
                        Mark reviewed
                      </button>
                      <button
                        onClick={() => resetMutation.mutate(user.id)}
                        disabled={resetMutation.isPending}
                        className="col-span-2 rounded-md border border-warn/20 bg-warn/10 px-3 py-2 text-sm font-medium text-warn hover:bg-warn/20 disabled:opacity-60 lg:col-span-1 active:scale-[0.98] transition-transform duration-75"
                      >
                        Reset password
                      </button>
                    </div>
                  </div>
                );
              })}
              {staff.length === 0 && (
                <EmptyState
                  title="No staff found"
                  detail="Create users through registration or seed data first."
                />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AccessFlag({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-sm border px-2 py-1 ${enabled ? 'border-accent-soft bg-accent-soft text-accent' : 'border-border bg-canvas-sunk text-ink-faint'}`}
    >
      <span>{label}</span>
      <span>{enabled ? 'yes' : 'no'}</span>
    </div>
  );
}

function PolicyLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-small font-medium text-ink-muted">{label}</div>
      <div className="text-small font-medium text-ink mt-1">{value}</div>
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
