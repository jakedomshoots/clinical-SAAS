import type {
  AdapterImplementationItem,
  AdapterImplementationPacket,
  Appointment,
  AuditEvent,
  AuditReviewSummary,
  BillingCase,
  BrowserQaChecklist,
  BrowserQaChecklistItem,
  BrowserQaSession,
  BrowserQaSessionList,
  BrowserQaSessionStart,
  BrowserQaSessionUpdate,
  ClinicSettings,
  CredentialBinderItem,
  CredentialBinderSnapshot,
  CredentialBinderSnapshotList,
  CredentialDryRunBinder,
  CredentialPreflight,
  CredentialPreflightItem,
  CutoverRunbook,
  CutoverRunbookPhase,
  CutoverRunbookSession,
  CutoverRunbookSessionList,
  CutoverRunbookSessionStart,
  CutoverRunbookSessionUpdate,
  CutoverRunbookStep,
  DailyCloseout,
  DailyCloseoutAction,
  DailyCloseoutRisk,
  DocumentStorageReadiness,
  DrChronoImportBatch,
  DrChronoImportBatchCreate,
  DrChronoImportBatchList,
  DrChronoMigrationDryRun,
  DrChronoMigrationDryRunStart,
  DrChronoMigrationPacket,
  EncounterTemplate,
  Fax,
  GoLiveAttestation,
  GoLiveAttestationCreate,
  GoLiveAttestationList,
  GoLivePacket,
  HandoffPacketArchive,
  IntegrationCutoverReadinessItem,
  IntegrationCutoverReadinessPacket,
  LaunchWorkplan,
  LaunchWorkplanSnapshot,
  LaunchWorkplanSnapshotList,
  LiveUseRehearsal,
  LiveUseRehearsalAction,
  LiveUseRehearsalGate,
  Message,
  MessageThread,
  OperatorHealth,
  OperatorHealthAction,
  OperatorHealthCheck,
  OperationsAlertRule,
  OperationsAlertRuleList,
  OperationsIncident,
  OperationsIncidentList,
  OperationsIncidentTimeline,
  OperationsTimelineItem,
  Patient,
  PatientCarePlanItem,
  PatientCheckoutHandoff,
  PatientChartSummary,
  PatientDocument,
  PatientDocumentQueueItem,
  PatientEncounter,
  PatientLabResult,
  PatientMedication,
  PatientUpdate,
  PolicyApprovalChecklist,
  PolicyApprovalChecklistItem,
  PolicyApprovalSession,
  PolicyApprovalSessionList,
  PolicyApprovalSessionStart,
  PolicyApprovalSessionUpdate,
  PortalIntakeSubmission,
  ProductionConfigAudit,
  ProductionConfigCheck,
  ProductionRehearsalReport,
  ProductionRehearsalSnapshot,
  ProductionRehearsalSnapshotList,
  ProviderAvailability,
  ReadinessSnapshot,
  ReadinessSnapshotList,
  RehearsalActionAssignment,
  RehearsalActionAssignmentUpdate,
  RestoreDrillChecklist,
  RestoreDrillChecklistItem,
  RestoreDrillSession,
  RestoreDrillSessionList,
  RestoreDrillSessionStart,
  RestoreDrillSessionUpdate,
  Role,
  RoleAccessMatrix,
  RoleDryRunChecklist,
  RoleDryRunChecklistList,
  RoleDryRunChecklistItem,
  RoleDryRunSession,
  RoleDryRunSessionList,
  RoleDryRunSessionStart,
  RoleDryRunSessionUpdate,
  SandboxEvidence,
  ScopeAcceptancePacket,
  StaffTrainingChecklist,
  StaffTrainingChecklistItem,
  StaffTrainingChecklistRole,
  StaffTrainingSession,
  StaffTrainingSessionList,
  StaffTrainingSessionStart,
  StaffTrainingSessionUpdate,
  Task,
  TaskWorkQueue,
  TodayQueue,
  User,
  UserAccessReviewSummary,
  UserPasswordResetResponse,
  UserRecoverySummary,
  VendorCredentialRequestItem,
  VendorCredentialRequestPacket,
  WorkloadSummary,
} from '@concierge-os/shared';

const DEMO_STORAGE_KEY = 'concierge-os.demo-data.v1';
const DEMO_PORTAL_ACCESS_CODE = 'demo-portal-code';
const now = new Date('2026-06-03T13:30:00-04:00');
const ACTIVE_TASK_STATUSES = ['open', 'in_progress', 'blocked'];
const VENDOR_PROFILE_FIELDS = {
  VENDOR_NAME: 'vendor_name',
  VENDOR_ENVIRONMENT: 'environment',
  OWNER_NAME: 'owner_name',
  OWNER_EMAIL: 'owner_email',
  SUPPORT_CONTACT: 'support_contact',
  ESCALATION_NOTES: 'escalation_notes',
  CONTRACT_REFERENCE_URL: 'contract_reference_url',
} as const;
const VENDOR_PROFILE_REQUIRED = [
  'VENDOR_NAME',
  'VENDOR_ENVIRONMENT',
  'OWNER_NAME',
  'OWNER_EMAIL',
  'SUPPORT_CONTACT',
] as const;
const CUTOVER_EVIDENCE_FIELDS = {
  CUTOVER_PLANNED_AT: 'planned_cutover_at',
  LAST_VENDOR_TEST_AT: 'last_vendor_test_at',
  ROLLBACK_OWNER: 'rollback_owner',
  GO_NO_GO_NOTES: 'go_no_go_notes',
  LIVE_REHEARSAL_APPROVED: 'live_rehearsal_approved',
} as const;
const CUTOVER_EVIDENCE_REQUIRED = [
  'CUTOVER_PLANNED_AT',
  'LAST_VENDOR_TEST_AT',
  'ROLLBACK_OWNER',
  'GO_NO_GO_NOTES',
  'LIVE_REHEARSAL_APPROVED',
] as const;
const MITIGATED_RISK_STATUSES = ['mitigated', 'accepted'];
const AUDIT_REVIEW_CATEGORIES = [
  {
    key: 'document_access',
    label: 'Document access',
    event_types: ['patient_document.accessed', 'patient_document.download_handoff'],
    severity: 'critical' as const,
    route: '/audit?entity_type=patient_document',
    action_label: 'Review document access',
  },
  {
    key: 'patient_chart_access',
    label: 'Patient chart access',
    event_types: [
      'patient.profile_viewed',
      'patient_chart.viewed',
      'patient_clinical.medications_viewed',
      'patient_clinical.care_plan_viewed',
      'patient_clinical.labs_viewed',
      'patient_clinical.encounters_viewed',
      'patient_checkout_handoff.viewed',
    ],
    severity: 'critical' as const,
    route: '/audit?entity_type=patient',
    action_label: 'Review patient chart access',
  },
  {
    key: 'assistant_actions',
    label: 'Assistant actions',
    event_types: [
      'assistant.task_created',
      'assistant.message_drafted',
      'assistant.fax_match_staged',
    ],
    severity: 'warning' as const,
    route: '/assistant-review',
    action_label: 'Review assistant-confirmed actions',
  },
  {
    key: 'user_administration',
    label: 'User administration',
    event_types: [
      'user.created',
      'user.updated',
      'user.access_reviewed',
      'user.password_reset_issued',
      'auth.login',
      'auth.login_blocked',
      'auth.password_rotated',
    ],
    severity: 'critical' as const,
    route: '/staff',
    action_label: 'Review staff access changes',
  },
  {
    key: 'patient_outreach',
    label: 'Patient outreach',
    event_types: ['patient_outreach.staged', 'patient_outreach.callback'],
    severity: 'warning' as const,
    route: '/tasks',
    action_label: 'Review patient outreach',
  },
  {
    key: 'integration_operations',
    label: 'Integration operations',
    event_types: [
      'integration_event.retry',
      'integration_config.updated',
      'integration_config.connection_test',
      'integration_config.sandbox_evidence',
    ],
    severity: 'warning' as const,
    route: '/integrations',
    action_label: 'Review integration changes',
  },
  {
    key: 'audit_exports',
    label: 'Audit exports',
    event_types: ['audit.exported'],
    severity: 'warning' as const,
    route: '/operations',
    action_label: 'Review audit export evidence',
  },
];

function iso(offsetHours = 0) {
  return new Date(now.getTime() + offsetHours * 60 * 60 * 1000).toISOString();
}

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function withDeliveryDefaults(
  task: Omit<
    Task,
    | 'delivery_channel'
    | 'delivery_status'
    | 'delivery_recipient'
    | 'delivery_provider_message_id'
    | 'delivery_error'
    | 'delivery_attempts'
    | 'delivered_at'
  >
): Task {
  return {
    ...task,
    delivery_channel: null,
    delivery_status: null,
    delivery_recipient: null,
    delivery_provider_message_id: null,
    delivery_error: null,
    delivery_attempts: 0,
    delivered_at: null,
  };
}

function normalizeDocument(document: PatientDocument): PatientDocument {
  return {
    ...document,
    source_contact: document.source_contact ?? null,
    source_phone: document.source_phone ?? null,
    source_fax: document.source_fax ?? null,
    source_reference: document.source_reference ?? null,
    requested_by: document.requested_by ?? null,
    routed_to_role: document.routed_to_role ?? null,
    review_priority: document.review_priority ?? 'normal',
    review_note: document.review_note ?? null,
    reviewed_by: document.reviewed_by ?? null,
    reviewed_at: document.reviewed_at ?? null,
    upload_status: document.upload_status ?? (document.file_url ? 'uploaded' : 'metadata_only'),
    ocr_status: document.ocr_status ?? 'not_started',
    classification: document.classification ?? null,
  };
}

function normalizePatient(patient: Patient): Patient {
  return {
    ...patient,
    sms_consent: patient.sms_consent ?? false,
    email_consent: patient.email_consent ?? false,
    preferred_contact_channel: patient.preferred_contact_channel ?? null,
  };
}

function normalizeDemoUser(
  user: Omit<User, 'password_must_change' | 'temporary_password_expires_at'> &
    Partial<Pick<User, 'password_must_change' | 'temporary_password_expires_at'>>
): User {
  return {
    ...user,
    password_must_change: user.password_must_change ?? false,
    temporary_password_expires_at: user.temporary_password_expires_at ?? null,
  };
}

const ACCESS_REVIEW_WINDOW_DAYS = 90;

function accessReviewSummary(): UserAccessReviewSummary {
  const data = demoUsers.map((user) => {
    const findings: string[] = [];
    if (!user.is_active) findings.push('inactive_account');
    if (['admin', 'manager'].includes(user.role) && !user.mfa_enabled)
      findings.push('privileged_mfa_missing');
    if (!user.access_reviewed_at) findings.push('never_reviewed');
    else if (
      new Date(user.access_reviewed_at).getTime() <
      now.getTime() - ACCESS_REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
    )
      findings.push('stale_review');
    if (!user.last_login_at) findings.push('never_logged_in');
    const actionable = findings.some((finding) =>
      ['inactive_account', 'privileged_mfa_missing', 'never_reviewed', 'stale_review'].includes(
        finding
      )
    );
    const recommended_action = findings.includes('privileged_mfa_missing')
      ? 'Require MFA enrollment before production use.'
      : findings.includes('inactive_account')
        ? 'Confirm whether this account should remain inactive or be removed from access.'
        : findings.includes('never_reviewed')
          ? 'Review role, employment status, and access need.'
          : findings.includes('stale_review')
            ? `Refresh access review; policy window is ${ACCESS_REVIEW_WINDOW_DAYS} days.`
            : findings.includes('never_logged_in')
              ? 'Account has no recorded login; confirm onboarding status.'
              : 'No action required.';
    return {
      user,
      findings,
      review_status: actionable ? ('needs_review' as const) : ('current' as const),
      recommended_action,
    };
  });
  return {
    data,
    total: data.length,
    due_count: data.filter((item) => item.review_status === 'needs_review').length,
    privileged_without_mfa_count: data.filter((item) =>
      item.findings.includes('privileged_mfa_missing')
    ).length,
    inactive_count: demoUsers.filter((user) => !user.is_active).length,
    review_window_days: ACCESS_REVIEW_WINDOW_DAYS,
  };
}

function roleAccessMatrix(): RoleAccessMatrix {
  const roles: Role[] = ['admin', 'manager', 'provider', 'ma', 'front_desk'];
  const privilegedRoles = new Set<Role>(['admin', 'manager']);
  const clinicalRoles = new Set<Role>(['admin', 'manager', 'provider', 'ma']);
  const frontOfficeRoles = new Set<Role>(['admin', 'manager', 'front_desk']);
  const managerRoles = new Set<Role>(['admin', 'manager']);
  const rows = roles.map((role) => ({
    role,
    label:
      role === 'ma'
        ? 'MA / nurse'
        : role.replace('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
    active_users: demoUsers.filter((user) => user.is_active && user.role === role).length,
    can_view_patients: true,
    can_manage_clinical: clinicalRoles.has(role),
    can_manage_front_office: frontOfficeRoles.has(role),
    can_manage_staff: managerRoles.has(role),
    can_manage_operations: managerRoles.has(role),
    can_manage_integrations: managerRoles.has(role),
    can_export_audit: managerRoles.has(role),
    mfa_required: privilegedRoles.has(role),
    access_review_required: true,
    summary: roleSummary(role),
  }));
  const warnings: RoleAccessMatrix['warnings'] = [];
  const privilegedMfaGaps = demoUsers.filter(
    (user) => user.is_active && privilegedRoles.has(user.role) && !user.mfa_enabled
  ).length;
  if (privilegedMfaGaps) {
    warnings.push({
      key: 'privileged_mfa_required',
      label: 'Privileged MFA required',
      severity: 'critical',
      role: null,
      detail: `${privilegedMfaGaps} privileged active user(s) need MFA before production login.`,
    });
  }
  for (const role of roles) {
    if (!demoUsers.some((user) => user.is_active && user.role === role)) {
      warnings.push({
        key: `role_without_active_user:${role}`,
        label: 'No active staff assigned',
        severity: 'warning',
        role,
        detail: `No active ${role.replace('_', ' ')} user is assigned.`,
      });
    }
  }
  const accessReview = accessReviewSummary();
  return {
    generated_at: new Date().toISOString(),
    total_roles: rows.length,
    summary: {
      active_users: demoUsers.filter((user) => user.is_active).length,
      inactive_users: demoUsers.filter((user) => !user.is_active).length,
      privileged_roles: privilegedRoles.size,
      privileged_users_without_mfa: privilegedMfaGaps,
      roles_without_active_users: rows.filter((row) => row.active_users === 0).length,
      access_review_due: accessReview.due_count,
    },
    roles: rows,
    warnings,
  };
}

function roleSummary(role: Role) {
  const summaries: Record<Role, string> = {
    admin:
      'Full system administration, staff access, integrations, operations, and audit evidence.',
    manager:
      'Clinic operations, staff review, launch evidence, integrations, and audit evidence without admin elevation.',
    provider:
      'Clinical chart review, documents, medications, labs, encounters, and clinical task work.',
    ma: 'Clinical support workflows, document review, medication/lab prep, care plan, and checkout tasks.',
    front_desk:
      'Scheduling, faxes, messages, patient access, outreach, and front-office task work.',
  };
  return summaries[role];
}

function auditReviewSummary(): AuditReviewSummary {
  const categories = AUDIT_REVIEW_CATEGORIES.map((definition) => {
    const rows = auditEvents.filter((event) => definition.event_types.includes(event.event_type));
    return {
      key: definition.key,
      label: definition.label,
      count: rows.length,
      severity: rows.length ? definition.severity : ('clear' as const),
      event_types: definition.event_types,
      last_event_at: rows[0]?.created_at ?? null,
      route: definition.route,
    };
  });
  return {
    generated_at: new Date().toISOString(),
    total_event_count: auditEvents.length,
    sensitive_event_count: categories.reduce((sum, category) => sum + category.count, 0),
    categories,
    recommended_actions: categories
      .filter((category) => category.count > 0)
      .map((category) => {
        const definition = AUDIT_REVIEW_CATEGORIES.find((item) => item.key === category.key);
        return {
          key: category.key,
          label: definition?.action_label ?? category.label,
          detail: `${category.count} sensitive audit event(s) need review.`,
          severity: category.severity,
          route: category.route,
        };
      }),
  };
}

function demoTemporaryPassword() {
  return `demo-temp-${Date.now()}Aa1!`;
}

function demoTemporaryPasswordExpired(user: User) {
  return Boolean(
    user.password_must_change &&
    user.temporary_password_expires_at &&
    new Date(user.temporary_password_expires_at).getTime() < Date.now()
  );
}

function recoverySummary(): UserRecoverySummary {
  const data = demoUsers
    .filter((user) => user.password_must_change)
    .map((user) => ({
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      status: demoTemporaryPasswordExpired(user)
        ? ('temporary_expired' as const)
        : ('temporary_active' as const),
      temporary_password_expires_at: user.temporary_password_expires_at,
      last_login_at: user.last_login_at,
    }));
  return {
    data,
    total: data.length,
    temporary_password_count: data.length,
    expired_temporary_password_count: data.filter((item) => item.status === 'temporary_expired')
      .length,
  };
}

function outreachChannelOption(patient: Patient, channel: 'sms' | 'email') {
  const recipient = channel === 'sms' ? patient.phone : patient.email;
  const consent = channel === 'sms' ? patient.sms_consent : patient.email_consent;
  if (!recipient) {
    return {
      channel,
      recipient: null,
      eligible: false,
      blocked_reason: `No ${channel} recipient is available for this patient.`,
    };
  }
  if (!consent) {
    return {
      channel,
      recipient,
      eligible: false,
      blocked_reason: `Patient has not granted ${channel} outreach consent.`,
    };
  }
  return { channel, recipient, eligible: true, blocked_reason: null };
}

function outreachSummary() {
  const outreachTasks = tasks.filter((task) => task.delivery_status);
  return {
    queued_count: outreachTasks.filter((task) => task.delivery_status === 'queued').length,
    delivered_count: outreachTasks.filter((task) => task.delivery_status === 'delivered').length,
    failed_count: outreachTasks.filter((task) => task.delivery_status === 'failed').length,
    blocked_count: outreachTasks.filter((task) => task.delivery_status === 'blocked').length,
    retryable_failed_count: outreachTasks.filter((task) =>
      ['failed', 'blocked'].includes(task.delivery_status ?? '')
    ).length,
    consent_blocked_count: outreachTasks.filter(
      (task) =>
        task.delivery_status === 'blocked' && task.delivery_error?.toLowerCase().includes('consent')
    ).length,
    no_contact_blocked_count: outreachTasks.filter(
      (task) =>
        task.delivery_status === 'blocked' &&
        task.delivery_error?.toLowerCase().includes('recipient')
    ).length,
    total_outreach_tasks: outreachTasks.length,
    consent_required: true,
  };
}

function taskWorkQueue(): TaskWorkQueue {
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const openTasks = tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status));
  const roleBuckets: TaskWorkQueue['role_buckets'] = {};
  const sourceBuckets: Record<string, number> = {};
  openTasks.forEach((task) => {
    const assignee = demoUsers.find((user) => user.id === task.assigned_to_id);
    const role = assignee?.role ?? 'unassigned';
    roleBuckets[role] = roleBuckets[role] ?? { open_count: 0, urgent_count: 0, overdue_count: 0 };
    roleBuckets[role].open_count += 1;
    if (task.priority === 'urgent') roleBuckets[role].urgent_count += 1;
    if (task.due_date && new Date(task.due_date) < now) roleBuckets[role].overdue_count += 1;
    const source = task.source_type?.startsWith('checkout_handoff:')
      ? 'checkout_handoff'
      : (task.source_type ?? 'manual');
    sourceBuckets[source] = (sourceBuckets[source] ?? 0) + 1;
  });
  const urgentCount = openTasks.filter((task) => task.priority === 'urgent').length;
  const overdueCount = openTasks.filter(
    (task) => task.due_date && new Date(task.due_date) < now
  ).length;
  const unassignedCount = openTasks.filter((task) => !task.assigned_to_id).length;
  const dueTodayCount = openTasks.filter(
    (task) => task.due_date && new Date(task.due_date) >= now && new Date(task.due_date) <= todayEnd
  ).length;
  return {
    generated_at: now.toISOString(),
    open_count: openTasks.filter((task) => task.status === 'open').length,
    in_progress_count: openTasks.filter((task) => task.status === 'in_progress').length,
    blocked_count: openTasks.filter((task) => task.status === 'blocked').length,
    urgent_count: urgentCount,
    high_priority_count: openTasks.filter((task) => ['urgent', 'high'].includes(task.priority))
      .length,
    overdue_count: overdueCount,
    due_today_count: dueTodayCount,
    unassigned_count: unassignedCount,
    role_buckets: roleBuckets,
    source_buckets: sourceBuckets,
    next_actions: [
      ...(overdueCount
        ? [
            {
              key: 'overdue',
              label: 'Clear overdue work',
              detail: `${overdueCount} active task(s) are past due.`,
              severity: 'critical' as const,
              route: '/tasks',
            },
          ]
        : []),
      ...(openTasks.some((task) => task.status === 'blocked')
        ? [
            {
              key: 'blocked',
              label: 'Resolve blocked work',
              detail: `${openTasks.filter((task) => task.status === 'blocked').length} task(s) are blocked.`,
              severity: 'critical' as const,
              route: '/tasks',
            },
          ]
        : []),
      ...(urgentCount
        ? [
            {
              key: 'urgent',
              label: 'Review urgent work',
              detail: `${urgentCount} urgent task(s) need same-day ownership.`,
              severity: 'critical' as const,
              route: '/tasks',
            },
          ]
        : []),
      ...(unassignedCount
        ? [
            {
              key: 'unassigned',
              label: 'Assign open work',
              detail: `${unassignedCount} open task(s) have no owner.`,
              severity: 'warning' as const,
              route: '/tasks',
            },
          ]
        : []),
      ...(dueTodayCount
        ? [
            {
              key: 'due_today',
              label: "Prepare today's queue",
              detail: `${dueTodayCount} task(s) are due today.`,
              severity: 'warning' as const,
              route: '/tasks',
            },
          ]
        : []),
    ],
  };
}

function normalizeBillingCase(item: BillingCase): BillingCase {
  return {
    ...item,
    claim_control_number: item.claim_control_number ?? null,
    submission_ready_at: item.submission_ready_at ?? null,
    submitted_at: item.submitted_at ?? null,
    denied_at: item.denied_at ?? null,
    denial_reason: item.denial_reason ?? null,
    denial_worked_at: item.denial_worked_at ?? null,
    remittance_status: item.remittance_status ?? 'not_received',
    allowed_amount: item.allowed_amount ?? null,
    paid_amount: item.paid_amount ?? null,
    paid_at: item.paid_at ?? null,
  };
}

function billingReadiness(item: BillingCase) {
  const blockers = [
    ...(!item.payer ? ['Payer is required.'] : []),
    ...(item.cpt_codes.length === 0 ? ['CPT codes are required.'] : []),
    ...(item.diagnosis_codes.length === 0 ? ['Diagnosis codes are required.'] : []),
    ...(item.eligibility_status !== 'eligible'
      ? ['Eligibility must be checked and eligible.']
      : []),
    ...(item.status === 'denied' && !item.denial_worked_at
      ? ['Denied claim must be reworked before resubmission.']
      : []),
  ];
  const warnings = item.appointment_id ? [] : ['No appointment is linked to this case.'];
  const ready = blockers.length === 0;
  const recommended_next_step = ready
    ? 'Submit claim to the configured clearinghouse.'
    : blockers.includes('Eligibility must be checked and eligible.')
      ? 'Run eligibility check before submission.'
      : blockers.includes('Denied claim must be reworked before resubmission.')
        ? 'Work the denial and document rework notes.'
        : 'Complete payer and coding fields.';
  return { case_id: item.id, ready, blockers, warnings, recommended_next_step };
}

function billingWorkQueue() {
  const readiness = billingCases.map(billingReadiness);
  return {
    draft_count: billingCases.filter((item) => item.status === 'draft').length,
    ready_count: billingCases.filter((item) => item.status === 'ready').length,
    submitted_count: billingCases.filter((item) => item.status === 'submitted').length,
    denied_count: billingCases.filter((item) => item.status === 'denied').length,
    paid_count: billingCases.filter((item) => item.status === 'paid').length,
    missing_coding_count: readiness.filter(
      (item) =>
        item.blockers.includes('CPT codes are required.') ||
        item.blockers.includes('Diagnosis codes are required.')
    ).length,
    eligibility_needed_count: readiness.filter((item) =>
      item.blockers.includes('Eligibility must be checked and eligible.')
    ).length,
    denial_rework_count: billingCases.filter(
      (item) => item.status === 'denied' && !item.denial_worked_at
    ).length,
    remittance_pending_count: billingCases.filter(
      (item) => item.status === 'submitted' && item.remittance_status === 'not_received'
    ).length,
    total: billingCases.length,
  };
}

function dailyCloseout(): DailyCloseout {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const openTasks = tasks.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status));
  const overdueTasks = openTasks.filter((item) => item.due_date && new Date(item.due_date) < now);
  const urgentTasks = openTasks.filter((item) => item.priority === 'urgent');
  const documentsNeedingReview = patientDocuments.filter((item) => item.status === 'needs_review');
  const billing = billingWorkQueue();
  const totals = {
    appointments_today: appointments.filter((item) => {
      const start = new Date(item.start_time);
      return start >= todayStart && start < tomorrowStart;
    }).length,
    active_visits: appointments.filter((item) =>
      ['checked_in', 'roomed', 'provider_review', 'checkout'].includes(item.status)
    ).length,
    open_tasks: openTasks.length,
    overdue_tasks: overdueTasks.length,
    urgent_tasks: urgentTasks.length,
    documents_needing_review: documentsNeedingReview.length,
    unsigned_encounters: patientEncounters.filter((item) =>
      ['draft', 'provider_review'].includes(item.status)
    ).length,
    medications_needing_review: patientMedications.filter((item) => item.status === 'review')
      .length,
    labs_needing_review: patientLabs.filter((item) => ['new', 'needs_review'].includes(item.status))
      .length,
    care_plan_blockers: patientCarePlan.filter((item) => item.status === 'blocked').length,
    intake_needing_review: portalIntake.filter((item) =>
      ['received', 'needs_review'].includes(item.status)
    ).length,
    unmatched_faxes: faxes.filter((item) => !item.patient_id).length,
    failed_integrations: integrationEvents.filter((item) => item.status === 'failed').length,
  };
  const aging = {
    tasks_over_48h: openTasks.filter(
      (item) =>
        item.due_date && now.getTime() - new Date(item.due_date).getTime() >= 48 * 60 * 60 * 1000
    ).length,
    documents_over_72h: documentsNeedingReview.filter(
      (item) => now.getTime() - new Date(item.received_at).getTime() >= 72 * 60 * 60 * 1000
    ).length,
    draft_billing_cases: billing.draft_count,
    denials_waiting_rework: billing.denial_rework_count,
    remittance_pending: billing.remittance_pending_count,
    failed_integration_events: totals.failed_integrations,
  };
  const risk_register: DailyCloseoutRisk[] = [
    {
      label: 'Urgent open tasks',
      category: 'clinical',
      count: totals.urgent_tasks,
      severity: 'critical' as const,
      detail: 'Open urgent tasks should be owned before closeout.',
    },
    {
      label: 'Overdue work',
      category: 'operations',
      count: totals.overdue_tasks,
      severity: 'warning' as const,
      detail: 'Overdue tasks remain unresolved.',
    },
    {
      label: 'Aging documents',
      category: 'clinical',
      count: aging.documents_over_72h,
      severity: 'critical' as const,
      detail: 'Outside documents have waited more than 72 hours for review.',
    },
    {
      label: 'Unsigned encounters',
      category: 'clinical',
      count: totals.unsigned_encounters,
      severity: 'critical' as const,
      detail: 'Draft or provider-review encounters are blocking downstream work.',
    },
    {
      label: 'Clinical review blockers',
      category: 'clinical',
      count:
        totals.medications_needing_review + totals.labs_needing_review + totals.care_plan_blockers,
      severity: 'critical' as const,
      detail: 'Medication, lab, or care-plan items still need provider/nursing resolution.',
    },
    {
      label: 'Billing coding gaps',
      category: 'revenue',
      count: billing.missing_coding_count,
      severity: 'warning' as const,
      detail: 'Claims are missing CPT or diagnosis coding.',
    },
    {
      label: 'Integration failures',
      category: 'vendor',
      count: totals.failed_integrations,
      severity: 'critical' as const,
      detail: 'Failed integration events need retry or vendor follow-up.',
    },
  ].filter((item) => item.count > 0);
  const recommended_actions: DailyCloseoutAction[] = [
    ...(totals.urgent_tasks > 0
      ? [
          {
            key: 'urgent_tasks',
            severity: 'critical' as const,
            label: 'Assign or complete urgent tasks',
            detail: `${totals.urgent_tasks} urgent task(s) are still open.`,
            route: '/tasks',
          },
        ]
      : []),
    ...(aging.documents_over_72h > 0
      ? [
          {
            key: 'documents_over_72h',
            severity: 'critical' as const,
            label: 'Review aging outside documents',
            detail: `${aging.documents_over_72h} document(s) have aged past 72 hours.`,
            route: '/patients',
          },
        ]
      : []),
    ...(totals.unsigned_encounters > 0
      ? [
          {
            key: 'unsigned_encounters',
            severity: 'warning' as const,
            label: 'Close unsigned encounters',
            detail: `${totals.unsigned_encounters} encounter(s) remain draft or in provider review.`,
            route: '/patients',
          },
        ]
      : []),
    ...(totals.medications_needing_review + totals.labs_needing_review + totals.care_plan_blockers >
    0
      ? [
          {
            key: 'clinical_review',
            severity: 'critical' as const,
            label: 'Resolve clinical review blockers',
            detail: `${totals.medications_needing_review + totals.labs_needing_review + totals.care_plan_blockers} medication, lab, or care-plan item(s) need resolution before closeout.`,
            route: '/patients',
          },
        ]
      : []),
    ...(billing.missing_coding_count > 0
      ? [
          {
            key: 'billing_coding',
            severity: 'warning' as const,
            label: 'Resolve billing coding gaps',
            detail: `${billing.missing_coding_count} claim(s) are missing coding before submission.`,
            route: '/billing',
          },
        ]
      : []),
    ...(totals.failed_integrations > 0
      ? [
          {
            key: 'failed_integrations',
            severity: 'warning' as const,
            label: 'Retry failed integration events',
            detail: `${totals.failed_integrations} vendor event(s) failed.`,
            route: '/operations',
          },
        ]
      : []),
    ...(totals.intake_needing_review > 0
      ? [
          {
            key: 'portal_intake',
            severity: 'normal' as const,
            label: 'Clear portal intake review',
            detail: `${totals.intake_needing_review} intake submission(s) need review.`,
            route: '/portal-intake',
          },
        ]
      : []),
  ];
  return {
    status: risk_register.length === 0 ? 'clear' : 'attention',
    generated_at: new Date().toISOString(),
    totals,
    aging,
    billing,
    risk_register,
    recommended_actions,
  };
}

function operationsIncidents(): OperationsIncidentList {
  const incidents: OperationsIncident[] = [
    {
      key: 'integration_ehr',
      title: 'EHR not live',
      severity: 'warning' as const,
      source: 'readiness',
      status: 'setup_required',
      owner_role: 'operations',
      count: 1,
      detail: 'Missing EHR_API_BASE_URL.',
      recommended_action: 'Connect credentials, test the adapter, and rerun readiness.',
      route: '/integrations',
    },
    {
      key: 'integration_fax_provider',
      title: 'Fax provider not live',
      severity: 'warning' as const,
      source: 'readiness',
      status: 'setup_required',
      owner_role: 'operations',
      count: 1,
      detail: 'Missing FAX_PROVIDER_API_KEY.',
      recommended_action: 'Connect credentials, test the adapter, and rerun readiness.',
      route: '/integrations',
    },
    {
      key: 'integration_event_failures',
      title: 'Failed integration events',
      severity: 'critical' as const,
      source: 'integration_events',
      status: 'open',
      owner_role: 'operations',
      count: integrationEvents.filter((item) => item.status === 'failed').length,
      detail: 'Integration events failed in local/demo mode.',
      recommended_action: 'Review the failed event payload, retry it, or contact the vendor.',
      route: '/operations',
    },
    {
      key: 'launch_backup_restore',
      title: 'Backup and restore evidence',
      severity: 'warning' as const,
      source: 'launch_readiness',
      status: 'open',
      owner_role: 'operations',
      count: 1,
      detail: 'Latest backup and restore markers should exist before go-live.',
      recommended_action: 'Run backup and restore validation before production launch.',
      route: '/setup',
    },
  ].filter((item) => item.count > 0);
  return {
    data: incidents.sort(
      (a, b) =>
        (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1) ||
        a.title.localeCompare(b.title)
    ),
    open_count: incidents.length,
    critical_count: incidents.filter((item) => item.severity === 'critical').length,
    warning_count: incidents.filter((item) => item.severity === 'warning').length,
    generated_at: new Date().toISOString(),
  };
}

function incidentTimeline(): OperationsIncidentTimeline {
  const integrationItems: OperationsTimelineItem[] = integrationEvents
    .filter((event) => event.status === 'failed')
    .map((event) => ({
      key: `integration_event:${event.integration}:${event.action}`,
      occurred_at: event.updated_at,
      severity: 'critical' as const,
      category: 'integration',
      title: `${event.integration.replace('_', ' ')} failed`,
      detail: event.error ?? `${event.action} failed after ${event.attempts} attempt(s).`,
      source: 'integration_events',
      route: '/operations',
      entity_type: event.entity_type,
      entity_id: event.entity_id,
    }));
  const auditTypes = [
    'auth.login_blocked',
    'user.password_reset_issued',
    'auth.password_rotated',
    'audit.exported',
    'patient_document.download_handoff',
    'patient_document.accessed',
    'integration_event.retry',
  ];
  const auditItems: OperationsTimelineItem[] = auditEvents
    .filter((event) => auditTypes.includes(event.event_type))
    .map((event) => ({
      key: `audit_event:${event.event_type}`,
      occurred_at: event.created_at,
      severity: ['auth.login_blocked', 'user.password_reset_issued'].includes(event.event_type)
        ? ('critical' as const)
        : ('warning' as const),
      category:
        event.event_type.startsWith('auth.') || event.event_type.startsWith('user.')
          ? 'security'
          : event.event_type === 'audit.exported'
            ? 'compliance'
            : 'document',
      title: event.event_type.replace('.', ' ').replace('_', ' '),
      detail:
        event.event_type === 'auth.login_blocked'
          ? `Login blocked: ${String(event.payload?.reason ?? 'policy')}`
          : event.event_type === 'audit.exported'
            ? `Audit export generated with ${String(event.payload?.row_count ?? 0)} row(s).`
            : `${event.event_type} recorded.`,
      source: 'audit',
      route:
        event.event_type.startsWith('auth.') || event.event_type.startsWith('user.')
          ? '/staff'
          : '/operations',
      entity_type: event.entity_type,
      entity_id: event.entity_id,
    }));
  const data = [...integrationItems, ...auditItems]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 30);
  return {
    data,
    total: data.length,
    critical_count: data.filter((item) => item.severity === 'critical').length,
    warning_count: data.filter((item) => item.severity === 'warning').length,
    generated_at: new Date().toISOString(),
  };
}

function alertRules(): OperationsAlertRuleList {
  const failedEvents = integrationEvents.filter((item) => item.status === 'failed');
  const blockedLogins = auditEvents.filter((item) => item.event_type === 'auth.login_blocked');
  const documentAccess = auditEvents.filter((item) =>
    ['patient_document.accessed', 'patient_document.download_handoff'].includes(item.event_type)
  );
  const auditExports = auditEvents.filter((item) => item.event_type === 'audit.exported');
  const recovery = recoverySummary();
  const storage = documentStorageReadiness();
  const roleMatrix = roleAccessMatrix();
  const rules: OperationsAlertRule[] = [
    demoAlertRule(
      'failed_integrations',
      'Failed integrations',
      failedEvents.length > 0,
      'critical',
      failedEvents.length,
      failedEvents[0]?.error ?? `${failedEvents.length} failed integration event(s).`,
      '/operations',
      failedEvents[0]?.updated_at ?? null
    ),
    demoAlertRule(
      'blocked_logins',
      'Blocked logins',
      blockedLogins.length > 0,
      'critical',
      blockedLogins.length,
      blockedLogins.length
        ? `${blockedLogins.length} blocked login event(s).`
        : 'No blocked login events recorded.',
      '/staff',
      blockedLogins[0]?.created_at ?? null
    ),
    demoAlertRule(
      'expired_onboarding',
      'Expired onboarding credentials',
      recovery.expired_temporary_password_count > 0,
      'warning',
      recovery.expired_temporary_password_count,
      `${recovery.expired_temporary_password_count} expired temporary credential(s).`,
      '/staff',
      null
    ),
    demoAlertRule(
      'backup_restore_gap',
      'Backup and restore gap',
      true,
      'warning',
      1,
      'Backup and restore validation evidence is missing in demo mode.',
      '/operations',
      null
    ),
    demoAlertRule(
      'document_access_review',
      'Document access review',
      documentAccess.length > 0,
      'warning',
      documentAccess.length,
      `${documentAccess.length} document access event(s) should be reviewed before closeout.`,
      '/operations',
      documentAccess[0]?.created_at ?? null
    ),
    demoAlertRule(
      'audit_export_review',
      'Audit export review',
      auditExports.length > 0,
      'warning',
      auditExports.length,
      auditExports.length
        ? `${auditExports.length} audit export event(s). Latest exported ${String(auditExports[0]?.payload?.row_count ?? 0)} row(s).`
        : 'No audit export events recorded.',
      '/operations',
      auditExports[0]?.created_at ?? null
    ),
    demoAlertRule(
      'document_storage_readiness',
      'Document storage readiness',
      storage.status !== 'ready',
      storage.status === 'blocked' ? 'critical' : 'warning',
      storage.summary.config_gaps +
        storage.summary.metadata_only_documents +
        storage.summary.unsigned_handoffs +
        storage.summary.expired_handoffs,
      `${storage.summary.config_gaps} config gap(s), ${storage.summary.metadata_only_documents} metadata-only document(s), ${storage.summary.unsigned_handoffs} unsigned handoff(s), and ${storage.summary.expired_handoffs} expired handoff(s).`,
      '/operations',
      storage.recent_handoffs[0]?.occurred_at ?? null
    ),
    demoAlertRule(
      'role_access_matrix',
      'Role access matrix',
      roleMatrix.warnings.length > 0,
      roleMatrix.warnings.some((item) => item.severity === 'critical') ? 'critical' : 'warning',
      roleMatrix.warnings.length,
      `${roleMatrix.warnings.length} role access warning(s), ${roleMatrix.summary.privileged_users_without_mfa} privileged MFA gap(s), and ${roleMatrix.summary.roles_without_active_users} role coverage gap(s).`,
      '/staff',
      roleMatrix.warnings.length ? roleMatrix.generated_at : null
    ),
  ];
  return {
    data: rules,
    total: rules.length,
    triggered_count: rules.filter((item) => item.status === 'triggered').length,
    critical_count: rules.filter(
      (item) => item.status === 'triggered' && item.severity === 'critical'
    ).length,
    warning_count: rules.filter(
      (item) => item.status === 'triggered' && item.severity === 'warning'
    ).length,
    generated_at: new Date().toISOString(),
  };
}

function demoAlertRule(
  key: string,
  label: string,
  triggered: boolean,
  severity: OperationsAlertRule['severity'],
  count: number,
  detail: string,
  route: string,
  last_triggered_at: string | null
): OperationsAlertRule {
  return {
    key,
    label,
    status: triggered ? 'triggered' : 'clear',
    severity,
    count,
    detail,
    route,
    last_triggered_at,
  };
}

function documentStorageReadiness(): DocumentStorageReadiness {
  const metadataOnly = patientDocuments.filter(
    (item) => !item.file_url || item.upload_status === 'metadata_only'
  );
  const stored = patientDocuments.filter((item) => item.file_url);
  const auditHandoffs = auditEvents
    .filter((event) =>
      ['patient_document.accessed', 'patient_document.download_handoff'].includes(event.event_type)
    )
    .slice(0, 8)
    .map((event) => {
      const payload = event.payload as Record<string, unknown>;
      const expiresAt = typeof payload.expires_at === 'string' ? payload.expires_at : null;
      return {
        document_id: event.entity_id,
        patient_id: typeof payload.patient_id === 'string' ? payload.patient_id : null,
        occurred_at: event.created_at,
        storage_status:
          typeof payload.storage_status === 'string' ? payload.storage_status : 'signed_handoff',
        presigned: Boolean(payload.presigned),
        expires_at: expiresAt,
        expired: expiresAt ? new Date(expiresAt).getTime() < Date.now() : false,
      };
    });
  const syntheticHandoffs = stored.slice(0, 2).map((document, index) => ({
    document_id: document.id,
    patient_id: document.patient_id,
    occurred_at: iso(index * -0.2),
    storage_status: 'signed_handoff',
    presigned: false,
    expires_at: iso(-1 - index),
    expired: true,
  }));
  const recentHandoffs = [...auditHandoffs, ...syntheticHandoffs].slice(0, 10);
  const unsignedHandoffs = recentHandoffs.filter(
    (item) => item.storage_status === 'signed_handoff' && !item.presigned
  ).length;
  const expiredHandoffs = recentHandoffs.filter((item) => item.expired).length;
  const configGaps = 3;
  const signingGaps = 2;
  const checks: DocumentStorageReadiness['checks'] = [
    demoDocumentStorageCheck(
      'object_storage_credentials',
      'Object-storage credentials',
      configGaps,
      'critical',
      'Demo object storage uses local credentials and insecure transport.',
      'Set production MINIO/S3 endpoint, bucket, access key, secret key, and secure transport.'
    ),
    demoDocumentStorageCheck(
      'object_storage_signing',
      'Object-storage signing',
      signingGaps,
      'critical',
      `${signingGaps} object-storage signing path(s) failed a presigned URL capability check.`,
      'Verify upload and download presigning against the production bucket before go-live.'
    ),
    demoDocumentStorageCheck(
      'metadata_only_documents',
      'Metadata-only documents',
      metadataOnly.length,
      'warning',
      `${metadataOnly.length} document(s) do not have a file URL attached.`,
      'Upload or reconcile missing files before relying on document previews/downloads.'
    ),
    demoDocumentStorageCheck(
      'unsigned_handoffs',
      'Unsigned object handoffs',
      unsignedHandoffs,
      'warning',
      `${unsignedHandoffs} recent handoff(s) did not receive a presigned object-storage URL.`,
      'Verify object-storage signing is reachable and configured before go-live.'
    ),
    demoDocumentStorageCheck(
      'expired_handoffs',
      'Expired signed handoffs',
      expiredHandoffs,
      'warning',
      `${expiredHandoffs} signed handoff(s) are expired and should be regenerated on demand.`,
      'Have staff request a fresh document access link when the original handoff expires.'
    ),
  ];
  const critical = checks.filter(
    (item) => item.status === 'triggered' && item.severity === 'critical'
  ).length;
  const warnings = checks.filter(
    (item) => item.status === 'triggered' && item.severity === 'warning'
  ).length;
  return {
    status: critical ? 'blocked' : warnings ? 'attention' : 'ready',
    score: Math.max(0, 100 - critical * 35 - warnings * 15),
    generated_at: new Date().toISOString(),
    summary: {
      total_documents: patientDocuments.length,
      stored_documents: stored.length,
      metadata_only_documents: metadataOnly.length,
      recent_handoffs: recentHandoffs.length,
      unsigned_handoffs: unsignedHandoffs,
      expired_handoffs: expiredHandoffs,
      config_gaps: configGaps,
      signing_gaps: signingGaps,
    },
    checks,
    recent_handoffs: recentHandoffs,
  };
}

function demoDocumentStorageCheck(
  key: string,
  label: string,
  count: number,
  severity: DocumentStorageReadiness['checks'][number]['severity'],
  detail: string,
  recommended_action: string
): DocumentStorageReadiness['checks'][number] {
  return {
    key,
    label,
    status: count ? 'triggered' : 'clear',
    severity,
    count,
    detail,
    recommended_action,
    route: '/operations',
  };
}

function operatorHealth(): OperatorHealth {
  const failedEvents = integrationEvents.filter((item) => item.status === 'failed');
  const preflight = demoCredentialPreflight();
  const packet = goLivePacket();
  const roleMatrix = roleAccessMatrix();
  const missingEvidence = packet.evidence.filter((item) => item.status === 'missing').length;
  const blockingEvidence = packet.evidence.filter((item) => item.status === 'blocking').length;
  const warningEvidence = packet.evidence.filter((item) => item.status === 'warning').length;
  const privilegedMfaGaps = roleMatrix.summary.privileged_users_without_mfa ?? 0;
  const roleCoverageGaps = roleMatrix.summary.roles_without_active_users ?? 0;
  const checks: OperatorHealthCheck[] = [
    {
      key: 'core_readiness',
      label: 'Core readiness',
      status: 'healthy',
      score: 100,
      detail: 'Demo core services are available.',
      route: '/operations',
      last_seen_at: new Date().toISOString(),
    },
    {
      key: 'operational_readiness',
      label: 'Operational readiness',
      status: preflight.blocking_count ? 'critical' : 'warning',
      score: preflight.blocking_count ? 25 : 75,
      detail: `${preflight.blocking_count} blocking integration item(s) remain before live use.`,
      route: '/integrations',
      last_seen_at: new Date().toISOString(),
    },
    {
      key: 'backup_freshness',
      label: 'Backup freshness',
      status: 'critical',
      score: 0,
      detail: 'No backup manifest found in demo mode.',
      route: '/operations',
      last_seen_at: null,
    },
    {
      key: 'restore_freshness',
      label: 'Restore validation freshness',
      status: 'warning',
      score: 45,
      detail: 'No restore marker found in demo mode.',
      route: '/operations',
      last_seen_at: null,
    },
    {
      key: 'integration_failures',
      label: 'Integration failures',
      status: failedEvents.length ? 'critical' : 'healthy',
      score: Math.max(0, 100 - failedEvents.length * 20),
      detail: `${failedEvents.length} failed integration event(s).${failedEvents[0]?.error ? ` Latest: ${failedEvents[0].error}` : ''}`,
      route: '/integrations',
      last_seen_at: failedEvents[0]?.updated_at ?? null,
    },
    {
      key: 'credential_preflight',
      label: 'Credential preflight',
      status: preflight.blocking_count
        ? 'critical'
        : preflight.staged_count
          ? 'warning'
          : 'healthy',
      score: Math.max(0, 100 - preflight.blocking_count * 20 - preflight.staged_count * 8),
      detail: `${preflight.blocking_count} blocking and ${preflight.staged_count} staged integration item(s).`,
      route: '/integrations',
      last_seen_at: new Date().toISOString(),
    },
    {
      key: 'launch_evidence',
      label: 'Launch evidence',
      status:
        missingEvidence || blockingEvidence ? 'critical' : warningEvidence ? 'warning' : 'healthy',
      score: Math.max(0, 100 - (missingEvidence + blockingEvidence) * 20 - warningEvidence * 10),
      detail: `${missingEvidence} missing, ${blockingEvidence} blocking, and ${warningEvidence} warning evidence item(s).`,
      route: '/operations',
      last_seen_at: new Date().toISOString(),
    },
    {
      key: 'role_access_matrix',
      label: 'Role access matrix',
      status: privilegedMfaGaps ? 'critical' : roleMatrix.warnings.length ? 'warning' : 'healthy',
      score: Math.max(0, 100 - privilegedMfaGaps * 25 - roleCoverageGaps * 15),
      detail: `${roleMatrix.warnings.length} role access warning(s), ${privilegedMfaGaps} privileged MFA gap(s), and ${roleCoverageGaps} role coverage gap(s).`,
      route: '/staff',
      last_seen_at: roleMatrix.generated_at,
    },
  ];
  const critical = checks.filter((item) => item.status === 'critical').length;
  const warning = checks.filter((item) => item.status === 'warning').length;
  const recommended_actions: OperatorHealthAction[] = checks
    .filter((item) => item.status !== 'healthy')
    .map((item) => ({
      key: `resolve_${item.key}`,
      label: `Resolve ${item.label}`,
      detail: item.detail,
      severity: item.status === 'critical' ? 'critical' : 'warning',
      route: item.route,
    }));
  return {
    status: critical ? 'critical' : warning ? 'attention' : 'healthy',
    score: Math.round(checks.reduce((sum, item) => sum + item.score, 0) / checks.length),
    generated_at: new Date().toISOString(),
    summary: {
      critical_checks: critical,
      warning_checks: warning,
      failed_integration_events: failedEvents.length,
      credential_blockers: preflight.blocking_count,
      launch_evidence_missing: missingEvidence,
      role_access_warnings: roleMatrix.warnings.length,
      privileged_mfa_gaps: privilegedMfaGaps,
      roles_without_active_users: roleCoverageGaps,
    },
    checks,
    recommended_actions,
  };
}

function demoConfigCheck(
  key: string,
  category: string,
  label: string,
  ready: boolean,
  severity: ProductionConfigCheck['severity'],
  detail: string,
  action: string,
  env_vars: string[],
  docs: string[]
): ProductionConfigCheck {
  return { key, category, label, ready, severity, detail, action, env_vars, docs };
}

function productionConfigAudit(): ProductionConfigAudit {
  const checks: ProductionConfigCheck[] = [
    demoConfigCheck(
      'app_env',
      'Infrastructure',
      'Production environment mode',
      false,
      'warning',
      'Current APP_ENV is demo.',
      'Set APP_ENV=production in the production secret store.',
      ['APP_ENV'],
      ['docs/operations/production-launch-checklist.md']
    ),
    demoConfigCheck(
      'secret_key',
      'Security',
      'Unique API signing secret',
      false,
      'critical',
      'JWT signing uses the local/demo default in this workspace.',
      'Generate and store a unique SECRET_KEY of at least 32 characters.',
      ['SECRET_KEY'],
      ['.env.production.example']
    ),
    demoConfigCheck(
      'cors_origins',
      'Security',
      'Production HTTPS CORS origins',
      false,
      'critical',
      'Demo mode allows localhost origins.',
      'Set CORS_ORIGINS to only production HTTPS app origin(s).',
      ['CORS_ORIGINS'],
      ['docs/operations/production-launch-checklist.md']
    ),
    demoConfigCheck(
      'seed_endpoints',
      'Security',
      'Seed endpoints disabled',
      false,
      'critical',
      'Seed endpoints are available for local setup.',
      'Set ALLOW_SEED_ENDPOINT=false before production launch.',
      ['ALLOW_SEED_ENDPOINT'],
      ['docs/operations/production-launch-checklist.md']
    ),
    demoConfigCheck(
      'schema_migrations',
      'Infrastructure',
      'Explicit database migrations',
      false,
      'critical',
      'Demo mode can bootstrap schema automatically.',
      'Set AUTO_CREATE_SCHEMA=false and run pnpm migrate:api during deploy.',
      ['AUTO_CREATE_SCHEMA'],
      ['scripts/migrate-api.sh', 'docs/operations/deployment-runbook.md']
    ),
    demoConfigCheck(
      'object_storage_startup',
      'Infrastructure',
      'Object storage startup enforcement',
      true,
      'critical',
      'Object storage startup enforcement is enabled in local defaults.',
      'Keep ENSURE_OBJECT_STORAGE_ON_STARTUP=true for production.',
      ['ENSURE_OBJECT_STORAGE_ON_STARTUP'],
      ['docs/operations/production-launch-checklist.md']
    ),
    demoConfigCheck(
      'minio_credentials',
      'Security',
      'Production object-storage credentials',
      false,
      'critical',
      'Demo object storage uses local credentials and insecure transport.',
      'Set production object-storage endpoint, credentials, bucket, and MINIO_SECURE=true.',
      ['MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET', 'MINIO_SECURE'],
      ['.env.production.example', 'docs/operations/production-launch-checklist.md']
    ),
    demoConfigCheck(
      'webhook_secret',
      'Security',
      'Webhook signing secret',
      false,
      'critical',
      'No production webhook shared secret is configured in demo mode.',
      'Set WEBHOOK_SHARED_SECRET and configure vendors to send X-Concierge-Webhook-Secret, X-Concierge-Webhook-Timestamp, X-Concierge-Webhook-Signature, and event_id.',
      ['WEBHOOK_SHARED_SECRET'],
      ['docs/integrations/vendor-adapter-plan.md']
    ),
    demoConfigCheck(
      'communications_provider',
      'Integrations',
      'Production communications provider',
      false,
      'warning',
      'Current communications provider is demo.',
      'Select the production SMS/email/portal provider and set COMMUNICATIONS_PROVIDER_API_KEY.',
      ['COMMUNICATIONS_PROVIDER', 'COMMUNICATIONS_PROVIDER_API_KEY'],
      ['docs/integrations/vendor-adapter-plan.md']
    ),
  ];
  const critical = checks.filter((item) => !item.ready && item.severity === 'critical').length;
  const warnings = checks.filter((item) => !item.ready && item.severity === 'warning').length;
  const ready = checks.filter((item) => item.ready).length;
  return {
    status: critical ? 'blocked' : warnings ? 'attention' : 'ready',
    score: Math.round((ready / checks.length) * 100),
    environment: 'demo',
    generated_at: new Date().toISOString(),
    critical_count: critical,
    warning_count: warnings,
    ready_count: ready,
    total: checks.length,
    checks,
  };
}

function demoBrowserQaItem(
  key: string,
  label: string,
  detail: string,
  route: string,
  category: string
): BrowserQaChecklistItem {
  return { key, label, detail, route, category };
}

function browserQaChecklist(): BrowserQaChecklist {
  const items = [
    demoBrowserQaItem(
      'login',
      'Login',
      'Confirm staff login and demo-mode entry load the expected workspace.',
      '/login',
      'Access'
    ),
    demoBrowserQaItem(
      'patients',
      'Patients',
      'Search patients, open a profile, and confirm chart tabs render.',
      '/patients',
      'Clinical'
    ),
    demoBrowserQaItem(
      'scheduling',
      'Scheduling',
      'Open today queue, schedule views, and conflict-check controls.',
      '/scheduling',
      'Front office'
    ),
    demoBrowserQaItem(
      'documents',
      'Patient documents',
      'Review document list, access metadata, upload flow, and filing controls from a patient chart.',
      '/patients',
      'Clinical'
    ),
    demoBrowserQaItem(
      'faxes',
      'Faxes',
      'Review inbound/outbound fax queues, matching, and status actions.',
      '/faxes',
      'Front office'
    ),
    demoBrowserQaItem(
      'billing',
      'Billing',
      'Review charge capture, claim readiness, eligibility history, and billing work queue.',
      '/billing',
      'Revenue'
    ),
    demoBrowserQaItem(
      'audit',
      'Audit',
      'Confirm audit list, patient access history, and export controls are reachable.',
      '/operations',
      'Compliance'
    ),
    demoBrowserQaItem(
      'assistant_actions',
      'Assistant actions',
      'Review confirmation-gated assistant actions and policy surface.',
      '/assistant-review',
      'AI safety'
    ),
    demoBrowserQaItem(
      'portal_intake',
      'Portal intake',
      'Process intake, appointment conversion, and document conversion workflows.',
      '/portal-intake',
      'Patient access'
    ),
    demoBrowserQaItem(
      'reports',
      'Reports',
      'Review daily closeout risks, recommended actions, and CSV export.',
      '/reports',
      'Operations'
    ),
  ];
  return { generated_at: new Date().toISOString(), items, total: items.length };
}

function demoTrainingItem(
  key: string,
  label: string,
  detail: string,
  route: string,
  category: string
): StaffTrainingChecklistItem {
  return { key, label, detail, route, category };
}

function demoTrainingRole(
  key: string,
  label: string,
  summary: string,
  items: StaffTrainingChecklistItem[]
): StaffTrainingChecklistRole {
  return { key, label, summary, items };
}

function staffTrainingChecklist(): StaffTrainingChecklist {
  const roles = [
    demoTrainingRole(
      'front_desk',
      'Front desk',
      'Patient access, check-in, checkout, communication consent, and escalation expectations.',
      [
        demoTrainingItem(
          'daily_flow',
          'Daily flow',
          'Review Command Center, patient search, scheduling, portal intake, and checkout handoff.',
          '/',
          'Workflow'
        ),
        demoTrainingItem(
          'access_phi',
          'PHI access',
          'Review minimum-necessary chart access, document handling, audit visibility, and patient communication consent.',
          '/patients',
          'Compliance'
        ),
        demoTrainingItem(
          'escalation',
          'Escalation',
          'Practice routing urgent tasks, blocked intake, and failed patient outreach to the right owner.',
          '/tasks',
          'Operations'
        ),
      ]
    ),
    demoTrainingRole(
      'ma_nurse',
      'MA / nurse',
      'Clinical rooming, document triage, medication/lab review, and incident response expectations.',
      [
        demoTrainingItem(
          'clinical_rooming',
          'Clinical rooming',
          'Review documents, meds, labs, care-plan items, and checkout blockers from the patient profile.',
          '/patients',
          'Clinical'
        ),
        demoTrainingItem(
          'phi_audit',
          'PHI audit',
          'Review patient document access, source-document handling, and audit expectations for clinical users.',
          '/operations',
          'Compliance'
        ),
        demoTrainingItem(
          'incident_response',
          'Incident response',
          'Practice escalation for wrong-patient documents, urgent labs, failed faxes, and suspected PHI exposure.',
          '/reports',
          'Safety'
        ),
      ]
    ),
    demoTrainingRole(
      'provider',
      'Provider',
      'Provider chart workflow, assistant policy, clinical closeout, and documentation ownership.',
      [
        demoTrainingItem(
          'provider_workflow',
          'Provider workflow',
          'Review chart summary, outside documents, labs, meds, encounters, and checkout tasks.',
          '/patients',
          'Clinical'
        ),
        demoTrainingItem(
          'assistant_policy',
          'Assistant policy',
          'Review confirmation-gated assistant actions, tool limits, and clinical responsibility boundaries.',
          '/assistant-review',
          'AI safety'
        ),
        demoTrainingItem(
          'clinical_closeout',
          'Clinical closeout',
          'Review unsigned encounters, clinical blockers, and handoff completion before the patient leaves.',
          '/reports',
          'Closeout'
        ),
      ]
    ),
    demoTrainingRole(
      'billing',
      'Billing',
      'Charge capture, claim readiness, payer data handling, and clearinghouse incident routing.',
      [
        demoTrainingItem(
          'billing_workflow',
          'Billing workflow',
          'Review charge review, claim readiness, eligibility history, denial rework, and remittance placeholders.',
          '/billing',
          'Revenue'
        ),
        demoTrainingItem(
          'payer_data_phi',
          'Payer data PHI',
          'Review payer identifiers, coverage data, billing notes, and minimum-necessary handling.',
          '/billing',
          'Compliance'
        ),
        demoTrainingItem(
          'clearinghouse_incidents',
          'Clearinghouse incidents',
          'Practice routing claim submission failures, eligibility failures, and remittance gaps.',
          '/integrations',
          'Vendor'
        ),
      ]
    ),
    demoTrainingRole(
      'manager',
      'Manager',
      'Launch evidence, access review, backup/restore, incident ownership, and sign-off responsibility.',
      [
        demoTrainingItem(
          'launch_evidence',
          'Launch evidence',
          'Review go-live packet, browser QA, role dry-runs, production rehearsal, and training evidence.',
          '/operations',
          'Launch'
        ),
        demoTrainingItem(
          'access_review',
          'Access review',
          'Review role assignments, MFA gaps, inactive accounts, stale access reviews, and audit export.',
          '/staff',
          'Security'
        ),
        demoTrainingItem(
          'incident_backup',
          'Incident and backup',
          'Review incident response, backup/restore validation, deployment runbook, and owner assignment.',
          '/operations',
          'Resilience'
        ),
      ]
    ),
  ];
  return {
    generated_at: new Date().toISOString(),
    roles,
    total_roles: roles.length,
    total_items: roles.reduce((sum, role) => sum + role.items.length, 0),
  };
}

function recalculateStaffTrainingSession(session: StaffTrainingSession): StaffTrainingSession {
  const itemCount = session.roles.reduce((sum, role) => sum + role.items.length, 0);
  const signedCount = session.roles.reduce(
    (sum, role) => sum + role.items.filter((item) => item.training_status === 'signed').length,
    0
  );
  const reviewedCount = session.roles.reduce(
    (sum, role) => sum + role.items.filter((item) => item.training_status === 'reviewed').length,
    0
  );
  return {
    ...session,
    item_count: itemCount,
    signed_count: signedCount,
    reviewed_count: reviewedCount,
    pending_count: itemCount - signedCount - reviewedCount,
  };
}

function createStaffTrainingSession(data: StaffTrainingSessionStart): StaffTrainingSession {
  const checklist = staffTrainingChecklist();
  const createdAt = new Date().toISOString();
  const session = recalculateStaffTrainingSession({
    id: uuid(2200 + staffTrainingSessions.length),
    session_id: uuid(2300 + staffTrainingSessions.length),
    session_name: data.session_name || 'Staff training',
    trainer_name: data.trainer_name ?? null,
    status: 'in_progress',
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    item_count: 0,
    signed_count: 0,
    reviewed_count: 0,
    pending_count: 0,
    roles: checklist.roles.map((role) => ({
      ...role,
      items: role.items.map((item) => ({
        ...item,
        training_status: 'pending' as const,
        note: null,
      })),
    })),
  });
  staffTrainingSessions = [session, ...staffTrainingSessions];
  logDemoEvent({
    event_type: 'operations.staff_training_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updateStaffTrainingSession(
  sessionId: string,
  data: StaffTrainingSessionUpdate
): StaffTrainingSession | null {
  const session = staffTrainingSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated = recalculateStaffTrainingSession({
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status === 'completed' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status === 'completed' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    roles: session.roles.map((role) => {
      if (role.key !== data.role_key) return role;
      return {
        ...role,
        items: role.items.map((item) => {
          if (item.key !== data.item_key) return item;
          return {
            ...item,
            training_status: data.training_status ?? item.training_status,
            note: data.item_note !== undefined ? data.item_note : item.note,
          };
        }),
      };
    }),
  });
  staffTrainingSessions = [
    updated,
    ...staffTrainingSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.staff_training_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: updated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return updated;
}

function demoPolicyItem(
  key: string,
  label: string,
  detail: string,
  route: string,
  category: string,
  docs: string[]
): PolicyApprovalChecklistItem {
  return { key, label, detail, route, category, docs };
}

function policyApprovalChecklist(): PolicyApprovalChecklist {
  const items = [
    demoPolicyItem(
      'phi_retention',
      'PHI retention',
      'Review patient record, audit log, document, backup, and demo-data retention expectations.',
      '/operations',
      'Compliance',
      ['docs/compliance/phi-retention-and-incident-response.md']
    ),
    demoPolicyItem(
      'incident_response',
      'Incident response',
      'Review breach triage, account containment, evidence preservation, notification, and corrective-action ownership.',
      '/operations',
      'Security',
      ['docs/compliance/phi-retention-and-incident-response.md']
    ),
    demoPolicyItem(
      'access_review',
      'Access review',
      'Review monthly access review, offboarding, privileged MFA, and audit export responsibilities.',
      '/staff',
      'Security',
      [
        'docs/compliance/phi-retention-and-incident-response.md',
        'docs/operations/production-launch-checklist.md',
      ]
    ),
    demoPolicyItem(
      'backup_restore',
      'Backup and restore',
      'Review backup validation, restore drills, retention location, access controls, RTO, and RPO approval.',
      '/operations',
      'Resilience',
      ['docs/operations/production-launch-checklist.md', 'docs/operations/deployment-runbook.md']
    ),
    demoPolicyItem(
      'patient_outreach',
      'Patient outreach consent',
      'Review consent-gated SMS/email/portal outreach, blocked states, retries, and callback responsibilities.',
      '/tasks',
      'Communications',
      ['docs/operations/daily-use-readiness.md', 'docs/operations/production-launch-checklist.md']
    ),
    demoPolicyItem(
      'assistant_policy',
      'Assistant policy',
      'Review confirmation-gated assistant actions, tool authorization, audit visibility, and clinical responsibility boundaries.',
      '/assistant-review',
      'AI safety',
      ['docs/operations/daily-use-readiness.md', 'docs/integrations/vendor-adapter-plan.md']
    ),
  ];
  return { generated_at: new Date().toISOString(), items, total: items.length };
}

function recalculatePolicyApprovalSession(session: PolicyApprovalSession): PolicyApprovalSession {
  const approvedCount = session.items.filter((item) => item.approval_status === 'approved').length;
  const needsChangesCount = session.items.filter(
    (item) => item.approval_status === 'needs_changes'
  ).length;
  return {
    ...session,
    item_count: session.items.length,
    approved_count: approvedCount,
    needs_changes_count: needsChangesCount,
    pending_count: session.items.length - approvedCount - needsChangesCount,
  };
}

function createPolicyApprovalSession(data: PolicyApprovalSessionStart): PolicyApprovalSession {
  const checklist = policyApprovalChecklist();
  const createdAt = new Date().toISOString();
  const session = recalculatePolicyApprovalSession({
    id: uuid(2400 + policyApprovalSessions.length),
    session_id: uuid(2500 + policyApprovalSessions.length),
    session_name: data.session_name || 'Policy approval',
    reviewer_name: data.reviewer_name ?? null,
    status: 'in_progress',
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    item_count: 0,
    approved_count: 0,
    needs_changes_count: 0,
    pending_count: 0,
    items: checklist.items.map((item) => ({
      ...item,
      approval_status: 'pending' as const,
      note: null,
    })),
  });
  policyApprovalSessions = [session, ...policyApprovalSessions];
  logDemoEvent({
    event_type: 'operations.policy_approval_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updatePolicyApprovalSession(
  sessionId: string,
  data: PolicyApprovalSessionUpdate
): PolicyApprovalSession | null {
  const session = policyApprovalSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated = recalculatePolicyApprovalSession({
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status === 'completed' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status === 'completed' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    items: session.items.map((item) => {
      if (item.key !== data.item_key) return item;
      return {
        ...item,
        approval_status: data.approval_status ?? item.approval_status,
        note: data.item_note !== undefined ? data.item_note : item.note,
      };
    }),
  });
  policyApprovalSessions = [
    updated,
    ...policyApprovalSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.policy_approval_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: updated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return updated;
}

function demoRestoreDrillItem(
  key: string,
  label: string,
  detail: string,
  route: string,
  category: string
): RestoreDrillChecklistItem {
  return { key, label, detail, route, category };
}

function restoreDrillChecklist(): RestoreDrillChecklist {
  const items = [
    demoRestoreDrillItem(
      'backup_created',
      'Backup created',
      'Run a current backup and identify the backup folder used for the drill.',
      '/operations',
      'Backup'
    ),
    demoRestoreDrillItem(
      'backup_validated',
      'Backup validated',
      'Validate the selected backup manifest and object archive before restoring.',
      '/operations',
      'Backup'
    ),
    demoRestoreDrillItem(
      'disposable_restore',
      'Disposable restore',
      'Restore into a disposable stack or database target, not the active clinic workspace.',
      '/operations',
      'Restore'
    ),
    demoRestoreDrillItem(
      'application_smoke',
      'Application smoke',
      'Open the restored app and verify login, patients, tasks, documents, and reports.',
      '/operations',
      'Application'
    ),
    demoRestoreDrillItem(
      'object_file_check',
      'Object file check',
      'Open at least one restored patient document or object reference.',
      '/patients',
      'Documents'
    ),
    demoRestoreDrillItem(
      'rto_rpo_recorded',
      'RTO/RPO recorded',
      'Capture restore duration, backup age, RTO/RPO result, failures, and follow-up owner.',
      '/operations',
      'Evidence'
    ),
  ];
  return { generated_at: new Date().toISOString(), items, total: items.length };
}

function recalculateRestoreDrillSession(session: RestoreDrillSession): RestoreDrillSession {
  const completeCount = session.items.filter((item) => item.drill_status === 'complete').length;
  const blockedCount = session.items.filter((item) => item.drill_status === 'blocked').length;
  return {
    ...session,
    item_count: session.items.length,
    complete_count: completeCount,
    blocked_count: blockedCount,
    pending_count: session.items.length - completeCount - blockedCount,
  };
}

function createRestoreDrillSession(data: RestoreDrillSessionStart): RestoreDrillSession {
  const checklist = restoreDrillChecklist();
  const createdAt = new Date().toISOString();
  const session = recalculateRestoreDrillSession({
    id: uuid(3000 + restoreDrillSessions.length),
    session_id: uuid(3100 + restoreDrillSessions.length),
    session_name: data.session_name || 'Restore drill',
    owner_name: data.owner_name ?? null,
    backup_reference: data.backup_reference ?? null,
    status: 'in_progress',
    rto_minutes: null,
    rpo_minutes: null,
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    item_count: 0,
    complete_count: 0,
    blocked_count: 0,
    pending_count: 0,
    items: checklist.items.map((item) => ({
      ...item,
      drill_status: 'pending' as const,
      note: null,
    })),
  });
  restoreDrillSessions = [session, ...restoreDrillSessions];
  logDemoEvent({
    event_type: 'operations.restore_drill_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updateRestoreDrillSession(
  sessionId: string,
  data: RestoreDrillSessionUpdate
): RestoreDrillSession | null {
  const session = restoreDrillSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated = recalculateRestoreDrillSession({
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    rto_minutes: data.rto_minutes !== undefined ? data.rto_minutes : session.rto_minutes,
    rpo_minutes: data.rpo_minutes !== undefined ? data.rpo_minutes : session.rpo_minutes,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status === 'completed' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status === 'completed' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    items: session.items.map((item) => {
      if (item.key !== data.item_key) return item;
      return {
        ...item,
        drill_status: data.drill_status ?? item.drill_status,
        note: data.item_note !== undefined ? data.item_note : item.note,
      };
    }),
  });
  restoreDrillSessions = [
    updated,
    ...restoreDrillSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.restore_drill_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: updated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return updated;
}

function restoreDrillCsv(session: RestoreDrillSession) {
  const rows = [
    [
      'session_id',
      'session_name',
      'owner_name',
      'status',
      'backup_reference',
      'rto_minutes',
      'rpo_minutes',
      'item_key',
      'item_label',
      'drill_status',
      'note',
    ],
  ];
  session.items.forEach((item) =>
    rows.push([
      session.session_id,
      session.session_name,
      session.owner_name ?? '',
      session.status,
      session.backup_reference ?? '',
      session.rto_minutes === null ? '' : String(session.rto_minutes),
      session.rpo_minutes === null ? '' : String(session.rpo_minutes),
      item.key,
      item.label,
      item.drill_status,
      item.note ?? '',
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function demoCutoverStep(
  key: string,
  label: string,
  detail: string,
  owner_role: string,
  expected_minute: number,
  rollback_trigger: string | null
): CutoverRunbookStep {
  return { key, label, detail, owner_role, expected_minute, rollback_trigger };
}

function demoCutoverPhase(
  key: string,
  label: string,
  objective: string,
  steps: CutoverRunbookStep[]
): CutoverRunbookPhase {
  return { key, label, objective, steps };
}

function cutoverRunbook(): CutoverRunbook {
  const phases = [
    demoCutoverPhase(
      'pre_cutover',
      'Pre-cutover',
      'Confirm launch inputs and freeze risky changes before the cutover window.',
      [
        demoCutoverStep(
          'confirm_owner',
          'Confirm cutover owner',
          'Confirm cutover owner, vendor contacts, escalation channel, and decision authority.',
          'manager',
          -60,
          null
        ),
        demoCutoverStep(
          'final_backup',
          'Run final backup',
          'Run backup and confirm restore marker or documented rollback snapshot.',
          'operations',
          -45,
          'Backup fails or restore marker is missing.'
        ),
        demoCutoverStep(
          'freeze_changes',
          'Freeze noncritical changes',
          'Pause noncritical workflow changes and confirm staff are using the rehearsal plan.',
          'manager',
          -30,
          'Unexpected configuration drift is detected.'
        ),
      ]
    ),
    demoCutoverPhase(
      'cutover_window',
      'Cutover window',
      'Switch production-facing configuration and verify critical access paths.',
      [
        demoCutoverStep(
          'deploy_release',
          'Deploy release',
          'Deploy the approved release and confirm health checks.',
          'operations',
          0,
          'Health check fails after deploy.'
        ),
        demoCutoverStep(
          'verify_identity',
          'Verify identity access',
          'Confirm admin/manager/provider/front desk access and session policy.',
          'manager',
          10,
          'Privileged user cannot authenticate.'
        ),
        demoCutoverStep(
          'enable_integrations',
          'Enable integrations',
          'Enable approved vendor credentials and confirm credential preflight.',
          'operations',
          20,
          'Credential preflight has blocking items.'
        ),
      ]
    ),
    demoCutoverPhase(
      'validation',
      'Validation',
      'Validate clinical, front-office, billing, and audit workflows before staff use.',
      [
        demoCutoverStep(
          'patient_chart_smoke',
          'Validate patient chart',
          'Open patient search, chart, documents, meds, care plan, and checkout handoff.',
          'ma_nurse',
          30,
          'Patient chart or document workflow fails.'
        ),
        demoCutoverStep(
          'front_office_smoke',
          'Validate front office',
          'Validate scheduling, portal intake, messaging, faxes, and reports.',
          'front_desk',
          40,
          'Scheduling, intake, or fax workflow fails.'
        ),
        demoCutoverStep(
          'billing_smoke',
          'Validate billing',
          'Validate charge review, claim readiness, eligibility, and audit trail visibility.',
          'billing',
          50,
          'Billing or eligibility workflow fails.'
        ),
      ]
    ),
    demoCutoverPhase(
      'rollback',
      'Rollback decision',
      'Make an explicit go/no-go decision and document rollback readiness.',
      [
        demoCutoverStep(
          'rollback_tree',
          'Review rollback decision tree',
          'Review blockers, owner authority, communication path, and rollback trigger thresholds.',
          'manager',
          55,
          'Any critical validation gate remains unresolved.'
        ),
        demoCutoverStep(
          'go_no_go',
          'Record go/no-go',
          'Record go/no-go decision, final owner, and follow-up monitoring plan.',
          'manager',
          60,
          'Go/no-go owner does not approve launch.'
        ),
      ]
    ),
  ];
  return {
    generated_at: new Date().toISOString(),
    phases,
    total_phases: phases.length,
    total_steps: phases.reduce((sum, phase) => sum + phase.steps.length, 0),
  };
}

function recalculateCutoverSession(session: CutoverRunbookSession): CutoverRunbookSession {
  const steps = session.phases.flatMap((phase) => phase.steps);
  const completeCount = steps.filter((step) => step.step_status === 'complete').length;
  const blockedCount = steps.filter((step) => step.step_status === 'blocked').length;
  const rollbackCount = steps.filter((step) => step.step_status === 'rollback').length;
  return {
    ...session,
    step_count: steps.length,
    complete_count: completeCount,
    blocked_count: blockedCount,
    rollback_count: rollbackCount,
    pending_count: steps.length - completeCount - blockedCount - rollbackCount,
  };
}

function createCutoverRunbookSession(data: CutoverRunbookSessionStart): CutoverRunbookSession {
  const runbook = cutoverRunbook();
  const createdAt = new Date().toISOString();
  const session = recalculateCutoverSession({
    id: uuid(2600 + cutoverRunbookSessions.length),
    session_id: uuid(2700 + cutoverRunbookSessions.length),
    session_name: data.session_name || 'Production cutover rehearsal',
    cutover_owner: data.cutover_owner ?? null,
    scheduled_for: data.scheduled_for ?? null,
    status: 'in_progress',
    rollback_status: 'not_reviewed',
    rollback_decision: null,
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    step_count: 0,
    complete_count: 0,
    blocked_count: 0,
    rollback_count: 0,
    pending_count: 0,
    phases: runbook.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((step) => ({
        ...step,
        step_status: 'pending' as const,
        owner_name: null,
        note: null,
      })),
    })),
  });
  cutoverRunbookSessions = [session, ...cutoverRunbookSessions];
  logDemoEvent({
    event_type: 'operations.cutover_runbook_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updateCutoverRunbookSession(
  sessionId: string,
  data: CutoverRunbookSessionUpdate
): CutoverRunbookSession | null {
  const session = cutoverRunbookSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated = recalculateCutoverSession({
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    rollback_status: data.rollback_status ?? session.rollback_status,
    rollback_decision:
      data.rollback_decision !== undefined ? data.rollback_decision : session.rollback_decision,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status && data.session_status !== 'in_progress' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status && data.session_status !== 'in_progress' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    phases: session.phases.map((phase) => {
      if (phase.key !== data.phase_key) return phase;
      return {
        ...phase,
        steps: phase.steps.map((step) => {
          if (step.key !== data.step_key) return step;
          return {
            ...step,
            step_status: data.step_status ?? step.step_status,
            owner_name: data.owner_name !== undefined ? data.owner_name : step.owner_name,
            note: data.step_note !== undefined ? data.step_note : step.note,
          };
        }),
      };
    }),
  });
  cutoverRunbookSessions = [
    updated,
    ...cutoverRunbookSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.cutover_runbook_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: updated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return updated;
}

function cutoverRunbookCsv(session: CutoverRunbookSession) {
  const rows = [['phase', 'key', 'label', 'status', 'owner', 'note', 'rollback_trigger']];
  session.phases.forEach((phase) =>
    phase.steps.forEach((step) =>
      rows.push([
        phase.key,
        step.key,
        step.label,
        step.step_status,
        step.owner_name ?? '',
        step.note ?? '',
        step.rollback_trigger ?? '',
      ])
    )
  );
  rows.push([
    'rollback_decision',
    'rollback_status',
    'Rollback status',
    session.rollback_status,
    session.cutover_owner ?? '',
    session.rollback_decision ?? '',
    '',
  ]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function recalculateBrowserQaSession(session: BrowserQaSession): BrowserQaSession {
  const passedCount = session.items.filter((item) => item.qa_status === 'passed').length;
  const failedCount = session.items.filter((item) => item.qa_status === 'failed').length;
  return {
    ...session,
    item_count: session.items.length,
    passed_count: passedCount,
    failed_count: failedCount,
    pending_count: session.items.length - passedCount - failedCount,
  };
}

function createBrowserQaSession(data: BrowserQaSessionStart): BrowserQaSession {
  const checklist = browserQaChecklist();
  const createdAt = new Date().toISOString();
  const session = recalculateBrowserQaSession({
    id: uuid(2000 + browserQaSessions.length),
    session_id: uuid(2100 + browserQaSessions.length),
    session_name: data.session_name || 'Browser QA run',
    browser: data.browser ?? null,
    status: 'in_progress',
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    item_count: 0,
    passed_count: 0,
    failed_count: 0,
    pending_count: 0,
    items: checklist.items.map((item) => ({ ...item, qa_status: 'pending' as const, note: null })),
  });
  browserQaSessions = [session, ...browserQaSessions];
  logDemoEvent({
    event_type: 'operations.browser_qa_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updateBrowserQaSession(
  sessionId: string,
  data: BrowserQaSessionUpdate
): BrowserQaSession | null {
  const session = browserQaSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated = recalculateBrowserQaSession({
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status === 'completed' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status === 'completed' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    items: session.items.map((item) => {
      if (item.key !== data.item_key) return item;
      return {
        ...item,
        qa_status: data.qa_status ?? item.qa_status,
        note: data.item_note !== undefined ? data.item_note : item.note,
      };
    }),
  });
  browserQaSessions = [
    updated,
    ...browserQaSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.browser_qa_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: updated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return updated;
}

function productionRehearsalReport(): ProductionRehearsalReport {
  const closeout = dailyCloseout();
  const incidents = operationsIncidents();
  const accessReview = accessReviewSummary();
  const preflight = demoCredentialPreflight();
  const gates = [
    {
      key: 'core_readiness',
      label: 'Core readiness',
      status: 'ready' as const,
      score: 100,
      detail: 'Demo core services are available.',
      route: '/operations',
    },
    {
      key: 'daily_closeout',
      label: 'Daily closeout',
      status: closeout.status === 'clear' ? ('ready' as const) : ('blocking' as const),
      score: Math.max(0, 100 - closeout.risk_register.length * 15),
      detail: `${closeout.risk_register.length} closeout risk(s) are open.`,
      route: '/reports',
    },
    {
      key: 'incident_register',
      label: 'Incident register',
      status: incidents.critical_count === 0 ? ('ready' as const) : ('blocking' as const),
      score: Math.max(0, 100 - incidents.critical_count * 25 - incidents.warning_count * 10),
      detail: `${incidents.critical_count} critical and ${incidents.warning_count} warning incident(s) are open.`,
      route: '/operations',
    },
    {
      key: 'credential_preflight',
      label: 'Credential preflight',
      status: preflight.blocking_count === 0 ? ('ready' as const) : ('blocking' as const),
      score: preflight.total ? Math.round((preflight.ready_count / preflight.total) * 100) : 0,
      detail: `${preflight.blocking_count} missing or blocked integration item(s), ${preflight.staged_count} staged.`,
      route: '/integrations',
    },
    {
      key: 'access_review',
      label: 'Access review',
      status:
        accessReview.due_count === 0 && accessReview.privileged_without_mfa_count === 0
          ? ('ready' as const)
          : ('blocking' as const),
      score: Math.max(
        0,
        100 - accessReview.due_count * 15 - accessReview.privileged_without_mfa_count * 20
      ),
      detail: `${accessReview.due_count} access review item(s) due; ${accessReview.privileged_without_mfa_count} privileged account(s) without MFA.`,
      route: '/staff',
    },
    {
      key: 'backup_restore',
      label: 'Backup and restore',
      status: 'warning' as const,
      score: 0,
      detail: 'Backup and restore validation evidence is missing in demo mode.',
      route: '/operations',
    },
  ];
  const blocking = gates.filter((gate) => gate.status === 'blocking').length;
  const warnings = gates.filter((gate) => gate.status === 'warning').length;
  return {
    status: blocking === 0 ? 'ready' : 'attention',
    rehearsal_ready: blocking === 0,
    score: Math.round(gates.reduce((total, gate) => total + gate.score, 0) / gates.length),
    blocking_count: blocking,
    warning_count: warnings,
    generated_at: new Date().toISOString(),
    gates,
    recommended_actions: gates
      .filter(
        (gate): gate is (typeof gates)[number] & { status: 'warning' | 'blocking' } =>
          gate.status !== 'ready'
      )
      .map((gate) => ({
        key: gate.key,
        label: `Resolve ${gate.label}`,
        detail: gate.detail,
        route: gate.route,
        severity: gate.status,
        assignment: rehearsalAssignments[gate.key] ?? null,
      })),
  };
}

function demoLaunchRequirements() {
  return [
    [
      'Security',
      'Unique API signing secret',
      false,
      'critical',
      'Generate and store a production SECRET_KEY.',
      ['SECRET_KEY'],
    ],
    [
      'Security',
      'Seed endpoints disabled',
      false,
      'critical',
      'Set ALLOW_SEED_ENDPOINT=false.',
      ['ALLOW_SEED_ENDPOINT'],
    ],
    [
      'Security',
      'Webhook signing secret',
      false,
      'critical',
      'Set WEBHOOK_SHARED_SECRET and require timestamp, signature, and event_id headers for vendor callbacks.',
      ['WEBHOOK_SHARED_SECRET'],
    ],
    [
      'Integrations',
      'EHR sync',
      false,
      'critical',
      'Connect demographics, medications, labs, and encounters.',
      ['EHR_API_BASE_URL'],
    ],
    [
      'Integrations',
      'Fax provider',
      false,
      'critical',
      'Connect inbound and outbound fax delivery.',
      ['FAX_PROVIDER_API_KEY'],
    ],
    [
      'Integrations',
      'External patient portal',
      false,
      'critical',
      'Connect messages, intake, appointment requests, and documents.',
      ['PORTAL_API_BASE_URL'],
    ],
    [
      'Integrations',
      'Calendar system',
      false,
      'critical',
      'Connect appointment create/update synchronization.',
      ['CALENDAR_API_BASE_URL'],
    ],
    [
      'Integrations',
      'SMS/email delivery',
      false,
      'critical',
      'Connect patient outreach delivery callbacks.',
      ['COMMUNICATIONS_PROVIDER', 'COMMUNICATIONS_PROVIDER_API_KEY'],
    ],
    [
      'Integrations',
      'CopilotKit runtime',
      false,
      'critical',
      'Deploy the AI runtime and approve model/tool policy.',
      ['COPILOTKIT_RUNTIME_URL'],
    ],
    [
      'Integrations',
      'Clearinghouse',
      false,
      'critical',
      'Connect claim submission, denial, payment, and ERA/remittance callbacks.',
      ['CLEARINGHOUSE_API_BASE_URL', 'CLEARINGHOUSE_API_KEY'],
    ],
  ].map(([category, label, ready, severity, action, envVars], index) => ({
    key: `demo-${index}`,
    category: String(category),
    label: String(label),
    ready: Boolean(ready),
    severity: String(severity),
    detail: ready ? 'Ready.' : 'Not configured in demo mode.',
    action: String(action),
    env_vars: envVars as string[],
    docs: ['docs/operations/production-launch-checklist.md'],
  }));
}

function launchWorkplan(): LaunchWorkplan {
  const rehearsal = productionRehearsalReport();
  const incidents = operationsIncidents();
  const preflight = demoCredentialPreflight();
  const credentialAssignment =
    rehearsal.recommended_actions.find((action) => action.key === 'credential_preflight')
      ?.assignment ?? null;
  const items = [
    ...rehearsal.recommended_actions.map((action) => ({
      key: `rehearsal_${action.key}`,
      source: 'rehearsal' as const,
      category: 'Production rehearsal',
      label: action.label,
      detail: action.detail,
      severity: action.severity,
      route: action.route,
      owner_role: 'operations',
      recommended_action: 'Assign an owner, clear the blocker, and save rehearsal evidence.',
      assignment: action.assignment,
    })),
    ...incidents.data.map((incident) => ({
      key: `incident_${incident.key}`,
      source: 'incident' as const,
      category: incident.source,
      label: incident.title,
      detail: incident.detail,
      severity: incident.severity === 'critical' ? ('blocking' as const) : ('warning' as const),
      route: incident.route,
      owner_role: incident.owner_role,
      recommended_action: incident.recommended_action,
      assignment: null,
    })),
    ...demoLaunchRequirements()
      .filter((requirement) => !requirement.ready)
      .map((requirement) => ({
        key: `launch_${requirement.key}`,
        source: 'launch_requirement' as const,
        category: requirement.category,
        label: requirement.label,
        detail: requirement.detail,
        severity:
          requirement.severity === 'critical' ? ('blocking' as const) : ('warning' as const),
        route: '/setup',
        owner_role: 'operations',
        recommended_action: requirement.action,
        assignment: null,
      })),
    ...preflight.data
      .filter((integration) => integration.status !== 'ready')
      .map((integration) => ({
        key: `credential_${integration.key}`,
        source: 'credential_preflight' as const,
        category: 'Integrations',
        label: `${integration.label} preflight`,
        detail:
          integration.blockers[0] ??
          integration.steps.find((step) => step.status !== 'ready')?.detail ??
          `${integration.label} needs credential preflight review.`,
        severity: integration.status === 'blocked' ? ('blocking' as const) : ('warning' as const),
        route: '/integrations',
        owner_role: 'operations',
        recommended_action:
          'Complete missing credential fields, connection test, and sandbox evidence.',
        assignment: credentialAssignment,
      })),
    ...integrationCutoverReadinessPacket()
      .items.filter((lane) => lane.cutover_status !== 'ready')
      .map((lane) => ({
        key: `cutover_${lane.integration}`,
        source: 'integration_cutover' as const,
        category: 'Integrations',
        label: `${lane.label} cutover`,
        detail:
          lane.blockers[0] ??
          lane.next_actions[0] ??
          `${lane.label} cutover needs go/no-go review.`,
        severity: lane.cutover_status === 'blocked' ? ('blocking' as const) : ('warning' as const),
        route: '/integrations',
        owner_role: 'operations',
        recommended_action:
          'Assign an integration owner and clear adapter, credential, handoff, risk, and cutover evidence gaps.',
        assignment: lane.assignment,
      })),
  ].sort(
    (a, b) =>
      (a.severity === 'blocking' ? 0 : 1) - (b.severity === 'blocking' ? 0 : 1) ||
      a.category.localeCompare(b.category) ||
      a.label.localeCompare(b.label)
  );
  return {
    status: items.length ? 'attention' : 'clear',
    generated_at: new Date().toISOString(),
    total: items.length,
    blocking_count: items.filter((item) => item.severity === 'blocking').length,
    warning_count: items.filter((item) => item.severity === 'warning').length,
    assigned_count: items.filter((item) => item.assignment).length,
    unassigned_count: items.filter((item) => !item.assignment).length,
    unassigned_blocking_count: items.filter(
      (item) => item.severity === 'blocking' && !item.assignment
    ).length,
    items,
  };
}

function launchWorkplanSnapshotFromEvent(event: AuditEvent): LaunchWorkplanSnapshot {
  const payload = event.payload as Partial<LaunchWorkplan>;
  return {
    id: event.id,
    created_at: event.created_at,
    status: payload.status ?? 'attention',
    total: Number(payload.total ?? 0),
    blocking_count: Number(payload.blocking_count ?? 0),
    warning_count: Number(payload.warning_count ?? 0),
    assigned_count: Number(payload.assigned_count ?? 0),
    unassigned_count: Number(payload.unassigned_count ?? 0),
    unassigned_blocking_count: Number(payload.unassigned_blocking_count ?? 0),
  };
}

function launchWorkplanCsv(workplan: LaunchWorkplan) {
  const rows = [
    [
      'key',
      'source',
      'category',
      'label',
      'severity',
      'detail',
      'route',
      'owner_role',
      'recommended_action',
      'owner',
      'assignment_status',
      'due_date',
      'note',
    ],
  ];
  workplan.items.forEach((item) =>
    rows.push([
      item.key,
      item.source,
      item.category,
      item.label,
      item.severity,
      item.detail,
      item.route,
      item.owner_role,
      item.recommended_action,
      item.assignment?.owner_name ?? '',
      item.assignment?.status ?? '',
      item.assignment?.due_date ?? '',
      item.assignment?.note ?? '',
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function credentialDryRunBinder(): CredentialDryRunBinder {
  const preflight = demoCredentialPreflight();
  const items: CredentialBinderItem[] = preflight.data.map((item): CredentialBinderItem => {
    const archive = integrationHandoffArchives[item.key] ?? null;
    const sandboxReferenceCount = item.sandbox_evidence.filter(
      (evidence) =>
        evidence.status === 'passed' &&
        Boolean(evidence.reference_url) &&
        !evidence.reference_url?.startsWith('sandbox://')
    ).length;
    const sandboxReferenceTotal = item.sandbox_tests.length;
    const handoffArchive = archive
      ? {
          status: archive.archive_reference_url ? ('ready' as const) : ('warning' as const),
          detail: archive.archive_reference_url
            ? `${item.label} handoff packet archive is linked to launch evidence.`
            : `${item.label} handoff packet is archived but missing a launch evidence reference.`,
          archive_reference_url: archive.archive_reference_url,
          archived_at: archive.archived_at,
        }
      : {
          status: 'missing' as const,
          detail: `${item.label} handoff packet has not been archived for launch review.`,
          archive_reference_url: null,
          archived_at: null,
        };
    const missingSteps = item.steps
      .filter((step) => step.status !== 'ready')
      .map((step) => step.label);
    const blockers = [...item.blockers];
    let binderStatus: 'ready' | 'warning' | 'blocking';
    if (['missing', 'blocked'].includes(item.status)) {
      binderStatus = 'blocking';
    } else if (handoffArchive.status === 'missing' && item.production_ready) {
      binderStatus = 'blocking';
    } else if (
      item.readiness_mode === 'production_vendor' &&
      sandboxReferenceTotal > 0 &&
      sandboxReferenceCount < sandboxReferenceTotal
    ) {
      binderStatus = 'blocking';
      blockers.push(
        'Vendor sandbox reference URLs are required for every passed workflow before launch review.'
      );
    } else if (
      item.status === 'staged' ||
      handoffArchive.status !== 'ready' ||
      missingSteps.length
    ) {
      binderStatus = 'warning';
    } else {
      binderStatus = 'ready';
    }
    return {
      integration: item.key,
      label: item.label,
      status: item.status,
      binder_status: binderStatus,
      readiness_mode: item.readiness_mode,
      configured: item.configured,
      healthy: item.healthy,
      adapter_implemented: item.adapter_implemented,
      production_ready: item.production_ready,
      sandbox_ready: item.sandbox_ready,
      mode: item.mode,
      vendor_profile: item.vendor_profile,
      cutover_evidence: item.cutover_evidence,
      risk_register: item.risk_register,
      handoff_archive: handoffArchive,
      sandbox_reference_count: sandboxReferenceCount,
      sandbox_reference_total: sandboxReferenceTotal,
      sandbox_evidence_count: item.sandbox_evidence.filter(
        (evidence) => evidence.status === 'passed'
      ).length,
      missing_steps: missingSteps,
      blockers,
      route: '/integrations',
    };
  });
  const blockingCount = items.filter((item) => item.binder_status === 'blocking').length;
  const warningCount = items.filter((item) => item.binder_status === 'warning').length;
  const readyCount = items.filter((item) => item.binder_status === 'ready').length;
  const archiveReadyCount = items.filter((item) => item.handoff_archive.status === 'ready').length;
  const vendorReferenceReadyCount = items.filter(
    (item) =>
      item.sandbox_reference_total > 0 &&
      item.sandbox_reference_count === item.sandbox_reference_total
  ).length;
  return {
    status: blockingCount ? 'blocked' : warningCount ? 'attention' : 'ready',
    generated_at: new Date().toISOString(),
    export_filename: 'concierge-os-credential-dry-run-binder.csv',
    ready_count: readyCount,
    warning_count: warningCount,
    blocking_count: blockingCount,
    archive_ready_count: archiveReadyCount,
    vendor_reference_ready_count: vendorReferenceReadyCount,
    total: items.length,
    summary: {
      total: items.length,
      ready: readyCount,
      warning: warningCount,
      blocking: blockingCount,
      archive_ready: archiveReadyCount,
      vendor_reference_ready: vendorReferenceReadyCount,
      credential_blockers: preflight.blocking_count,
      credential_staged: preflight.staged_count,
    },
    items,
  };
}

function credentialDryRunBinderCsv(binder: CredentialDryRunBinder) {
  const rows = [
    [
      'integration',
      'label',
      'binder_status',
      'credential_status',
      'readiness_mode',
      'production_ready',
      'vendor_name',
      'owner_name',
      'owner_email',
      'handoff_archive_status',
      'handoff_archive_reference',
      'sandbox_reference_count',
      'sandbox_reference_total',
      'blockers',
      'route',
    ],
  ];
  binder.items.forEach((item) =>
    rows.push([
      item.integration,
      item.label,
      item.binder_status,
      item.status,
      item.readiness_mode,
      String(item.production_ready),
      item.vendor_profile.vendor_name,
      item.vendor_profile.owner_name,
      item.vendor_profile.owner_email,
      item.handoff_archive.status,
      item.handoff_archive.archive_reference_url ?? '',
      String(item.sandbox_reference_count),
      String(item.sandbox_reference_total),
      item.blockers.join('; '),
      item.route,
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function vendorCredentialRequestPacket(): VendorCredentialRequestPacket {
  const preflight = demoCredentialPreflight();
  const items = preflight.data.map((item): VendorCredentialRequestItem => {
    const archive = integrationHandoffArchives[item.key] ?? null;
    const handoffArchive = archive
      ? {
          status: archive.archive_reference_url ? ('ready' as const) : ('warning' as const),
          detail: archive.archive_reference_url
            ? `${item.label} handoff packet archive is linked to launch evidence.`
            : `${item.label} handoff packet is archived but missing a launch evidence reference.`,
          archive_reference_url: archive.archive_reference_url,
          archived_at: archive.archived_at,
        }
      : {
          status: 'missing' as const,
          detail: `${item.label} handoff packet has not been archived for launch review.`,
          archive_reference_url: null,
          archived_at: null,
        };
    const missingFields = [...item.missing_fields];
    const requiredFields = Array.from(
      new Set([...item.configured_fields, ...missingFields])
    ).sort();
    const sandboxReferenceCount = item.sandbox_evidence.filter(
      (evidence) =>
        evidence.status === 'passed' &&
        Boolean(evidence.reference_url) &&
        !evidence.reference_url?.startsWith('sandbox://')
    ).length;
    const sandboxReferenceTotal = item.sandbox_tests.length;
    const blockers = [...item.blockers];
    const hasOwnerContact = Boolean(
      item.vendor_profile.owner_email || item.vendor_profile.support_contact
    );
    const hasContract = Boolean(item.vendor_profile.contract_reference_url);
    if (!hasOwnerContact)
      blockers.push(
        'Vendor owner email or support contact is required before a credential request can be sent.'
      );
    if (!hasContract) blockers.push('Vendor contract/reference link is missing.');
    if (handoffArchive.status === 'missing')
      blockers.push('Archive the vendor handoff packet before final launch review.');
    const requestStatus: VendorCredentialRequestItem['request_status'] = !hasOwnerContact
      ? 'blocked'
      : missingFields.length || handoffArchive.status === 'missing' || !hasContract
        ? 'attention'
        : 'ready';
    const credentialLabel =
      (missingFields.length ? missingFields : requiredFields).join(', ') ||
      'vendor credential fields';
    const requestChecklist = [
      'Confirm vendor owner, owner email, support contact, and escalation notes.',
      `Request credential values or setup confirmation for: ${credentialLabel}.`,
      'Attach the credential dry-run binder export for this integration.',
      handoffArchive.archive_reference_url
        ? `Attach archived vendor handoff packet evidence: ${handoffArchive.archive_reference_url}.`
        : 'Export and archive the vendor handoff packet before final launch review.',
      sandboxReferenceTotal > sandboxReferenceCount
        ? `Request vendor sandbox reference URLs for ${sandboxReferenceTotal - sandboxReferenceCount} workflow(s).`
        : 'Confirm vendor sandbox reference URLs remain valid for all workflows.',
      ...(item.readiness_mode === 'local_sandbox'
        ? [
            'Replace local sandbox rehearsal evidence with production vendor evidence before live use.',
          ]
        : []),
    ];
    const vendorName = item.vendor_profile.vendor_name || item.label;
    const ownerName = item.vendor_profile.owner_name || 'Vendor team';
    const environment = item.vendor_profile.environment || 'production';
    const requestBody = [
      `Hello ${ownerName},`,
      '',
      `We are preparing Concierge OS ${item.label} connectivity for the ${environment} environment with ${vendorName}.`,
      `Please provide or confirm: ${credentialLabel}.`,
      `Vendor sandbox references captured: ${sandboxReferenceCount} of ${sandboxReferenceTotal}`,
      handoffArchive.archive_reference_url
        ? `Handoff packet evidence: ${handoffArchive.archive_reference_url}`
        : 'Handoff packet evidence: pending archive before launch review',
      '',
      'Please also confirm any IP allowlists, callback URLs, sandbox test references, and production cutover requirements for this integration.',
    ].join('\n');
    return {
      integration: item.key,
      label: item.label,
      request_status: requestStatus,
      credential_status: item.status,
      readiness_mode: item.readiness_mode,
      vendor_profile: item.vendor_profile,
      handoff_archive: handoffArchive,
      required_fields: requiredFields,
      missing_fields: missingFields,
      configured_fields: item.configured_fields,
      sandbox_reference_count: sandboxReferenceCount,
      sandbox_reference_total: sandboxReferenceTotal,
      blockers,
      request_checklist: requestChecklist,
      request_subject: `Concierge OS credential request: ${item.label}`,
      request_body: requestBody,
      route: '/integrations',
    };
  });
  const readyCount = items.filter((item) => item.request_status === 'ready').length;
  const attentionCount = items.filter((item) => item.request_status === 'attention').length;
  const blockedCount = items.filter((item) => item.request_status === 'blocked').length;
  const missingOwnerCount = items.filter((item) =>
    item.vendor_profile.missing_fields.some((field) =>
      ['owner_name', 'owner_email', 'support_contact'].includes(field)
    )
  ).length;
  const missingContractCount = items.filter((item) =>
    item.vendor_profile.missing_fields.includes('contract_reference_url')
  ).length;
  const archiveMissingCount = items.filter(
    (item) => item.handoff_archive.status === 'missing'
  ).length;
  return {
    status: blockedCount ? 'blocked' : attentionCount ? 'attention' : 'ready',
    generated_at: new Date().toISOString(),
    export_filename: 'concierge-os-vendor-credential-request-packet.csv',
    ready_to_request_count: readyCount,
    attention_count: attentionCount,
    blocked_count: blockedCount,
    missing_owner_count: missingOwnerCount,
    missing_contract_count: missingContractCount,
    archive_missing_count: archiveMissingCount,
    total: items.length,
    summary: {
      total: items.length,
      ready_to_request: readyCount,
      attention: attentionCount,
      blocked: blockedCount,
      missing_owner: missingOwnerCount,
      missing_contract: missingContractCount,
      archive_missing: archiveMissingCount,
    },
    items,
  };
}

function vendorCredentialRequestPacketCsv(packet: VendorCredentialRequestPacket) {
  const rows = [
    [
      'integration',
      'label',
      'request_status',
      'vendor_name',
      'environment',
      'owner_email',
      'support_contact',
      'required_fields',
      'missing_fields',
      'handoff_archive_status',
      'handoff_archive_reference',
      'sandbox_reference_count',
      'sandbox_reference_total',
      'blockers',
      'route',
    ],
  ];
  packet.items.forEach((item) =>
    rows.push([
      item.integration,
      item.label,
      item.request_status,
      item.vendor_profile.vendor_name,
      item.vendor_profile.environment,
      item.vendor_profile.owner_email,
      item.vendor_profile.support_contact,
      item.required_fields.join('; '),
      item.missing_fields.join('; '),
      item.handoff_archive.status,
      item.handoff_archive.archive_reference_url ?? '',
      String(item.sandbox_reference_count),
      String(item.sandbox_reference_total),
      item.blockers.join('; '),
      item.route,
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function adapterImplementationPacket(): AdapterImplementationPacket {
  const items = demoCredentialPreflight().data.map((item): AdapterImplementationItem => {
    const implementationStatus: AdapterImplementationItem['implementation_status'] =
      item.adapter_implemented && item.readiness_mode === 'production_vendor'
        ? 'implemented'
        : item.readiness_mode === 'local_sandbox'
          ? 'sandbox_only'
          : 'placeholder';
    const priority: AdapterImplementationItem['priority'] =
      implementationStatus === 'implemented'
        ? 'normal'
        : ['fax', 'communications', 'portal'].includes(item.key)
          ? 'critical'
          : ['ehr', 'calendar', 'clearinghouse'].includes(item.key)
            ? 'high'
            : 'normal';
    const requiredCredentials = Array.from(
      new Set([...item.configured_fields, ...item.missing_fields])
    ).sort();
    const sandboxPassed = item.sandbox_evidence.filter(
      (evidence) => evidence.status === 'passed'
    ).length;
    const vendorReferenceCount = item.sandbox_evidence.filter(
      (evidence) =>
        evidence.status === 'passed' &&
        Boolean(evidence.reference_url) &&
        !evidence.reference_url?.startsWith('sandbox://')
    ).length;
    const blockers = [...item.blockers];
    if (implementationStatus === 'placeholder')
      blockers.push(
        item.adapter_detail ?? `Implement the ${item.label} production adapter before live use.`
      );
    if (implementationStatus === 'sandbox_only')
      blockers.push(
        'Local sandbox adapter is rehearsal-only and must be replaced with production vendor adapter evidence before live use.'
      );
    if (item.missing_fields.length)
      blockers.push(`Credential values still missing: ${item.missing_fields.join(', ')}.`);
    return {
      integration: item.key,
      label: item.label,
      implementation_status: implementationStatus,
      priority,
      readiness_mode: item.readiness_mode,
      configured: item.configured,
      adapter_implemented: item.adapter_implemented,
      adapter_method_ready_count: item.adapter_method_ready_count,
      adapter_method_total: item.adapter_method_total,
      adapter_methods: item.adapter_methods,
      required_credentials: requiredCredentials,
      missing_credentials: item.missing_fields,
      workflows: item.workflows,
      sandbox_tests: item.sandbox_tests,
      implementation_phases: [
        {
          key: 'vendor_selection',
          label: 'Vendor selection and credential scope',
          status: item.missing_fields.length ? 'attention' : 'ready',
          detail: item.missing_fields.length
            ? `Missing credential field(s): ${item.missing_fields.join(', ')}.`
            : 'Required credential fields are identified and staged.',
        },
        {
          key: 'adapter_contract',
          label: 'Adapter contract implementation',
          status:
            item.adapter_method_ready_count === item.adapter_method_total &&
            item.adapter_method_total > 0
              ? 'ready'
              : 'blocked',
          detail: `${item.adapter_method_ready_count} of ${item.adapter_method_total} required adapter method(s) are ready.`,
        },
        {
          key: 'workflow_mapping',
          label: 'Workflow mapping',
          status: item.workflows.length ? 'ready' : 'attention',
          detail: item.workflows.join(', ') || 'Workflow mapping needs to be defined.',
        },
        {
          key: 'sandbox_evidence',
          label: 'Sandbox evidence',
          status:
            item.sandbox_tests.length && sandboxPassed === item.sandbox_tests.length
              ? 'ready'
              : 'attention',
          detail: `${sandboxPassed} of ${item.sandbox_tests.length} sandbox workflow(s) have passing evidence.`,
        },
        {
          key: 'production_vendor_evidence',
          label: 'Production vendor evidence',
          status: item.production_ready
            ? 'ready'
            : implementationStatus !== 'implemented'
              ? 'blocked'
              : 'attention',
          detail: item.production_ready
            ? 'Production-vendor readiness is recorded.'
            : `${vendorReferenceCount} of ${item.sandbox_tests.length} workflow(s) have vendor reference URLs.`,
        },
      ],
      blockers,
      docs: item.docs,
      route: '/integrations',
    };
  });
  const implementedCount = items.filter(
    (item) => item.implementation_status === 'implemented'
  ).length;
  const placeholderCount = items.filter(
    (item) => item.implementation_status === 'placeholder'
  ).length;
  const sandboxOnlyCount = items.filter(
    (item) => item.implementation_status === 'sandbox_only'
  ).length;
  const criticalCount = items.filter((item) => item.priority === 'critical').length;
  const highCount = items.filter((item) => item.priority === 'high').length;
  return {
    status:
      placeholderCount || sandboxOnlyCount ? (criticalCount ? 'blocked' : 'attention') : 'ready',
    generated_at: new Date().toISOString(),
    export_filename: 'concierge-os-adapter-implementation-packet.csv',
    implemented_count: implementedCount,
    placeholder_count: placeholderCount,
    sandbox_only_count: sandboxOnlyCount,
    critical_count: criticalCount,
    high_count: highCount,
    total: items.length,
    summary: {
      total: items.length,
      implemented: implementedCount,
      placeholder: placeholderCount,
      sandbox_only: sandboxOnlyCount,
      critical: criticalCount,
      high: highCount,
    },
    items,
  };
}

function adapterImplementationPacketCsv(packet: AdapterImplementationPacket) {
  const rows = [
    [
      'integration',
      'label',
      'implementation_status',
      'priority',
      'readiness_mode',
      'configured',
      'adapter_method_ready_count',
      'adapter_method_total',
      'required_credentials',
      'missing_credentials',
      'workflows',
      'sandbox_tests',
      'blockers',
      'route',
    ],
  ];
  packet.items.forEach((item) =>
    rows.push([
      item.integration,
      item.label,
      item.implementation_status,
      item.priority,
      item.readiness_mode,
      String(item.configured),
      String(item.adapter_method_ready_count),
      String(item.adapter_method_total),
      item.required_credentials.join('; '),
      item.missing_credentials.join('; '),
      item.workflows.join('; '),
      item.sandbox_tests.join('; '),
      item.blockers.join('; '),
      item.route,
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function integrationCutoverReadinessPacket(): IntegrationCutoverReadinessPacket {
  const preflight = demoCredentialPreflight();
  const adapterItems = new Map(
    adapterImplementationPacket().items.map((item) => [item.integration, item])
  );
  const credentialItems = new Map(
    vendorCredentialRequestPacket().items.map((item) => [item.integration, item])
  );
  const items = preflight.data.map((preflightItem): IntegrationCutoverReadinessItem => {
    const adapter = adapterItems.get(preflightItem.key)!;
    const credential = credentialItems.get(preflightItem.key)!;
    const cutover = preflightItem.cutover_evidence;
    const riskRegister = preflightItem.risk_register;
    const gates = [
      {
        key: 'adapter',
        label: 'Adapter implementation',
        status:
          adapter.implementation_status === 'implemented'
            ? ('ready' as const)
            : ('blocked' as const),
        detail:
          adapter.implementation_status === 'implemented'
            ? `${adapter.adapter_method_ready_count} of ${adapter.adapter_method_total} adapter method(s) ready.`
            : `${preflightItem.label} adapter is ${adapter.implementation_status}.`,
        route: '/integrations',
      },
      {
        key: 'credential_request',
        label: 'Credential request',
        status:
          credential.request_status === 'ready'
            ? ('ready' as const)
            : credential.request_status === 'blocked'
              ? ('blocked' as const)
              : ('attention' as const),
        detail:
          credential.request_status === 'ready'
            ? 'Vendor credential request is ready to send.'
            : `Vendor credential request needs ${credential.request_status} review.`,
        route: '/integrations',
      },
      {
        key: 'handoff_archive',
        label: 'Vendor handoff archive',
        status:
          credential.handoff_archive.status === 'ready'
            ? ('ready' as const)
            : credential.handoff_archive.status === 'missing'
              ? ('blocked' as const)
              : ('attention' as const),
        detail: credential.handoff_archive.detail,
        route: '/integrations',
      },
      {
        key: 'cutover_evidence',
        label: 'Cutover rehearsal evidence',
        status: cutover.evidence_complete ? ('ready' as const) : ('attention' as const),
        detail: cutover.evidence_complete
          ? `Cutover planned for ${cutover.planned_cutover_at}; rollback owner ${cutover.rollback_owner}.`
          : 'Cutover date, last vendor test, rollback owner, go/no-go notes, and rehearsal approval need review.',
        route: '/integrations',
      },
      {
        key: 'sandbox_references',
        label: 'Vendor sandbox references',
        status:
          credential.sandbox_reference_total &&
          credential.sandbox_reference_count === credential.sandbox_reference_total
            ? ('ready' as const)
            : ('attention' as const),
        detail: `${credential.sandbox_reference_count} of ${credential.sandbox_reference_total} sandbox workflow(s) have vendor reference URLs.`,
        route: '/integrations',
      },
      {
        key: 'vendor_risks',
        label: 'Vendor risk register',
        status: riskRegister.blocking_count ? ('blocked' as const) : ('ready' as const),
        detail: riskRegister.blocking_count
          ? `${riskRegister.blocking_count} unresolved blocking risk(s) remain.`
          : `${riskRegister.risk_count} vendor risk(s) tracked with no unresolved blocking risk.`,
        route: '/integrations',
      },
    ];
    const blockers = Array.from(
      new Set(
        [
          ...gates.filter((gate) => gate.status === 'blocked').map((gate) => gate.detail),
          ...adapter.blockers,
          ...credential.blockers,
        ].filter(Boolean)
      )
    );
    const nextActions = Array.from(
      new Set([
        ...(adapter.implementation_status !== 'implemented'
          ? ['Assign production adapter implementation and contract-method verification.']
          : []),
        ...(credential.request_status !== 'ready'
          ? [
              'Complete vendor credential request owner/contact, missing values, and archive context.',
            ]
          : []),
        ...(credential.handoff_archive.status !== 'ready'
          ? ['Export and archive the vendor handoff packet with launch evidence reference.']
          : []),
        ...(!cutover.evidence_complete
          ? [
              'Complete cutover rehearsal date, last vendor test, rollback owner, go/no-go notes, and approval.',
            ]
          : []),
        ...(credential.sandbox_reference_total &&
        credential.sandbox_reference_count < credential.sandbox_reference_total
          ? ['Collect vendor sandbox reference URLs for every workflow.']
          : []),
        ...(riskRegister.blocking_count
          ? ['Mitigate or explicitly accept blocking vendor risks before cutover.']
          : []),
      ])
    );
    const blocked = gates.some((gate) => gate.status === 'blocked');
    const attention = gates.some((gate) => gate.status === 'attention');
    return {
      integration: preflightItem.key,
      label: preflightItem.label,
      cutover_status: blocked ? 'blocked' : attention ? 'attention' : 'ready',
      go_no_go: blocked ? 'no_go' : attention ? 'hold' : 'go',
      readiness_mode: preflightItem.readiness_mode,
      adapter,
      credential_request: credential,
      handoff_archive: credential.handoff_archive,
      cutover_evidence: cutover,
      risk_register: riskRegister,
      gates,
      blockers,
      next_actions: nextActions,
      route: '/integrations',
      assignment: integrationCutoverAssignments[preflightItem.key] ?? null,
    };
  });
  const readyCount = items.filter((item) => item.cutover_status === 'ready').length;
  const attentionCount = items.filter((item) => item.cutover_status === 'attention').length;
  const blockedCount = items.filter((item) => item.cutover_status === 'blocked').length;
  const goCount = items.filter((item) => item.go_no_go === 'go').length;
  const holdCount = items.filter((item) => item.go_no_go === 'hold').length;
  const noGoCount = items.filter((item) => item.go_no_go === 'no_go').length;
  return {
    status: blockedCount ? 'blocked' : attentionCount ? 'attention' : 'ready',
    generated_at: new Date().toISOString(),
    export_filename: 'concierge-os-integration-cutover-readiness-packet.csv',
    ready_count: readyCount,
    attention_count: attentionCount,
    blocked_count: blockedCount,
    go_count: goCount,
    hold_count: holdCount,
    no_go_count: noGoCount,
    total: items.length,
    summary: {
      total: items.length,
      ready: readyCount,
      attention: attentionCount,
      blocked: blockedCount,
      go: goCount,
      hold: holdCount,
      no_go: noGoCount,
    },
    items,
  };
}

function integrationCutoverReadinessPacketCsv(packet: IntegrationCutoverReadinessPacket) {
  const rows = [
    [
      'integration',
      'label',
      'cutover_status',
      'go_no_go',
      'readiness_mode',
      'adapter_status',
      'credential_request_status',
      'handoff_archive_status',
      'cutover_evidence_complete',
      'blocking_risks',
      'blockers',
      'next_actions',
      'route',
    ],
  ];
  packet.items.forEach((item) =>
    rows.push([
      item.integration,
      item.label,
      item.cutover_status,
      item.go_no_go,
      item.readiness_mode,
      item.adapter.implementation_status,
      item.credential_request.request_status,
      item.handoff_archive.status,
      String(item.cutover_evidence.evidence_complete),
      String(item.risk_register.blocking_count),
      item.blockers.join('; '),
      item.next_actions.join('; '),
      item.route,
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function credentialBinderSnapshotFromEvent(event: AuditEvent): CredentialBinderSnapshot {
  const payload = event.payload as Partial<CredentialDryRunBinder>;
  return {
    id: event.id,
    created_at: event.created_at,
    status: payload.status ?? 'blocked',
    total: Number(payload.total ?? 0),
    ready_count: Number(payload.ready_count ?? 0),
    warning_count: Number(payload.warning_count ?? 0),
    blocking_count: Number(payload.blocking_count ?? 0),
    archive_ready_count: Number(payload.archive_ready_count ?? 0),
    vendor_reference_ready_count: Number(payload.vendor_reference_ready_count ?? 0),
  };
}

function goLivePacket(): GoLivePacket {
  const workplan = launchWorkplan();
  const preflight = demoCredentialPreflight();
  const latestReadiness = auditEvents.find(
    (event) => event.event_type === 'operations.readiness_snapshot'
  );
  const latestWorkplan = auditEvents.find(
    (event) => event.event_type === 'operations.launch_workplan_snapshot'
  );
  const latestRehearsal = auditEvents.find(
    (event) => event.event_type === 'operations.production_rehearsal_snapshot'
  );
  const latestCredentialBinder = auditEvents.find(
    (event) => event.event_type === 'operations.credential_binder_snapshot'
  );
  const latestDryRun = roleDryRunSessions[0] ?? null;
  const latestBrowserQa = browserQaSessions[0] ?? null;
  const latestTraining = staffTrainingSessions[0] ?? null;
  const latestPolicyApproval = policyApprovalSessions[0] ?? null;
  const latestRestoreDrill = restoreDrillSessions[0] ?? null;
  const latestCutover = cutoverRunbookSessions[0] ?? null;
  const readinessSnapshot = latestReadiness ? readinessSnapshotFromEvent(latestReadiness) : null;
  const workplanSnapshot = latestWorkplan ? launchWorkplanSnapshotFromEvent(latestWorkplan) : null;
  const rehearsalSnapshot = latestRehearsal
    ? productionRehearsalSnapshotFromEvent(latestRehearsal)
    : null;
  const credentialBinderSnapshot = latestCredentialBinder
    ? credentialBinderSnapshotFromEvent(latestCredentialBinder)
    : null;
  const workplanSnapshotStatus = workplanSnapshot?.unassigned_blocking_count
    ? ('blocking' as const)
    : workplanSnapshot
      ? ('ready' as const)
      : ('missing' as const);
  const workplanSnapshotDetail = workplanSnapshot?.unassigned_blocking_count
    ? `${workplanSnapshot.blocking_count} blocking and ${workplanSnapshot.unassigned_count} unassigned item(s) captured; ${workplanSnapshot.unassigned_blocking_count} unassigned blocking item(s) require ownership.`
    : workplanSnapshot
      ? `${workplanSnapshot.blocking_count} blocking and ${workplanSnapshot.unassigned_count} unassigned item(s) captured.`
      : 'Save the Launch Workplan before the rehearsal.';
  const cutoverStatus =
    latestCutover &&
    (latestCutover.blocked_count > 0 ||
      latestCutover.rollback_count > 0 ||
      latestCutover.rollback_status === 'rollback_required')
      ? ('blocking' as const)
      : latestCutover?.status === 'completed' &&
          latestCutover.pending_count === 0 &&
          ['rollback_ready', 'not_needed'].includes(latestCutover.rollback_status) &&
          latestCutover.rollback_decision
        ? ('ready' as const)
        : latestCutover
          ? ('warning' as const)
          : ('missing' as const);
  const cutoverDetail = latestCutover
    ? `${latestCutover.complete_count} complete, ${latestCutover.blocked_count} blocked, ${latestCutover.rollback_count} rollback, ${latestCutover.pending_count} pending step(s); rollback status ${latestCutover.rollback_status}.`
    : 'Start and complete a cutover runbook session with rollback decision evidence.';
  const readinessSnapshotStatus = readinessSnapshot
    ? readinessSnapshot.core_status !== 'ok' || readinessSnapshot.critical_count > 0
      ? ('blocking' as const)
      : readinessSnapshot.operational_status !== 'ok' || readinessSnapshot.warning_count > 0
        ? ('warning' as const)
        : ('ready' as const)
    : ('missing' as const);
  const readinessSnapshotDetail = readinessSnapshot
    ? `Core ${readinessSnapshot.core_status}, operational ${readinessSnapshot.operational_status}, launch score ${readinessSnapshot.launch_score}, ${readinessSnapshot.critical_count} critical and ${readinessSnapshot.warning_count} warning incident(s) captured.`
    : 'Save a readiness snapshot from Operations.';
  const evidence = [
    {
      key: 'readiness_snapshot',
      label: 'Readiness snapshot',
      status: readinessSnapshotStatus,
      detail: readinessSnapshotDetail,
      route: '/operations',
      captured_at: readinessSnapshot?.created_at ?? null,
    },
    {
      key: 'launch_workplan_snapshot',
      label: 'Launch workplan snapshot',
      status: workplanSnapshotStatus,
      detail: workplanSnapshotDetail,
      route: '/operations',
      captured_at: workplanSnapshot?.created_at ?? null,
    },
    {
      key: 'production_rehearsal_snapshot',
      label: 'Production rehearsal snapshot',
      status: rehearsalSnapshot?.rehearsal_ready
        ? ('ready' as const)
        : rehearsalSnapshot?.blocking_count
          ? ('blocking' as const)
          : rehearsalSnapshot
            ? ('warning' as const)
            : ('missing' as const),
      detail: rehearsalSnapshot
        ? `${rehearsalSnapshot.blocking_count} blocker(s), ${rehearsalSnapshot.warning_count} warning(s) captured.`
        : 'Save the production rehearsal report.',
      route: '/operations',
      captured_at: rehearsalSnapshot?.created_at ?? null,
    },
    {
      key: 'credential_binder_snapshot',
      label: 'Credential binder snapshot',
      status:
        credentialBinderSnapshot?.status === 'ready'
          ? ('ready' as const)
          : credentialBinderSnapshot?.blocking_count
            ? ('blocking' as const)
            : credentialBinderSnapshot
              ? ('warning' as const)
              : ('missing' as const),
      detail: credentialBinderSnapshot
        ? `${credentialBinderSnapshot.blocking_count} blocking, ${credentialBinderSnapshot.warning_count} warning, ${credentialBinderSnapshot.archive_ready_count} of ${credentialBinderSnapshot.total} archive(s) ready.`
        : 'Save the Credential Dry-Run Binder before launch review.',
      route: '/operations',
      captured_at: credentialBinderSnapshot?.created_at ?? null,
    },
    {
      key: 'credential_preflight',
      label: 'Credential preflight',
      status: preflight.blocking_count === 0 ? ('ready' as const) : ('blocking' as const),
      detail: `${preflight.blocking_count} blocking integration item(s), ${preflight.staged_count} staged.`,
      route: '/integrations',
      captured_at: null,
    },
    {
      key: 'role_dry_run_session',
      label: 'Role dry-run session',
      status:
        latestDryRun?.status === 'completed' &&
        latestDryRun.pending_count === 0 &&
        latestDryRun.blocked_count === 0
          ? ('ready' as const)
          : latestDryRun?.blocked_count
            ? ('blocking' as const)
            : latestDryRun
              ? ('warning' as const)
              : ('missing' as const),
      detail: latestDryRun
        ? `${latestDryRun.complete_count} complete, ${latestDryRun.blocked_count} blocked, ${latestDryRun.pending_count} pending role dry-run item(s).`
        : 'Start and complete a role dry-run session with staff evidence notes.',
      route: '/operations',
      captured_at: latestDryRun?.updated_at ?? null,
    },
    {
      key: 'browser_qa_session',
      label: 'Browser QA session',
      status:
        latestBrowserQa?.status === 'completed' &&
        latestBrowserQa.pending_count === 0 &&
        latestBrowserQa.failed_count === 0
          ? ('ready' as const)
          : latestBrowserQa?.failed_count
            ? ('blocking' as const)
            : latestBrowserQa
              ? ('warning' as const)
              : ('missing' as const),
      detail: latestBrowserQa
        ? `${latestBrowserQa.passed_count} passed, ${latestBrowserQa.failed_count} failed, ${latestBrowserQa.pending_count} pending browser QA item(s).`
        : 'Complete a browser QA session for major staff workflows.',
      route: '/operations',
      captured_at: latestBrowserQa?.updated_at ?? null,
    },
    {
      key: 'staff_training_session',
      label: 'Staff training session',
      status:
        latestTraining?.status === 'completed' && latestTraining.pending_count === 0
          ? ('ready' as const)
          : latestTraining
            ? ('warning' as const)
            : ('missing' as const),
      detail: latestTraining
        ? `${latestTraining.signed_count} signed, ${latestTraining.reviewed_count} reviewed, ${latestTraining.pending_count} pending training item(s).`
        : 'Record a staff training session before live-use rehearsal.',
      route: '/operations',
      captured_at: latestTraining?.updated_at ?? null,
    },
    {
      key: 'policy_approval_session',
      label: 'Policy approval session',
      status:
        latestPolicyApproval?.status === 'completed' &&
        latestPolicyApproval.pending_count === 0 &&
        latestPolicyApproval.needs_changes_count === 0
          ? ('ready' as const)
          : latestPolicyApproval
            ? ('warning' as const)
            : ('missing' as const),
      detail: latestPolicyApproval
        ? `${latestPolicyApproval.approved_count} approved, ${latestPolicyApproval.needs_changes_count} needs changes, ${latestPolicyApproval.pending_count} pending policy item(s).`
        : 'Record compliance policy approval before live-use rehearsal.',
      route: '/operations',
      captured_at: latestPolicyApproval?.updated_at ?? null,
    },
    {
      key: 'backup_restore',
      label: 'Backup and restore',
      status: 'blocking' as const,
      detail: 'Backup and restore validation evidence is missing in demo mode.',
      route: '/operations',
      captured_at: null,
    },
    {
      key: 'restore_drill_session',
      label: 'Restore drill session',
      status:
        latestRestoreDrill?.status === 'completed' &&
        latestRestoreDrill.pending_count === 0 &&
        latestRestoreDrill.blocked_count === 0
          ? ('ready' as const)
          : latestRestoreDrill
            ? ('warning' as const)
            : ('missing' as const),
      detail: latestRestoreDrill
        ? `${latestRestoreDrill.complete_count} complete, ${latestRestoreDrill.blocked_count} blocked, ${latestRestoreDrill.pending_count} pending restore item(s). RTO ${latestRestoreDrill.rto_minutes ?? 'not recorded'} min, RPO ${latestRestoreDrill.rpo_minutes ?? 'not recorded'} min.`
        : 'Start and complete a restore drill session with RTO/RPO evidence.',
      route: '/operations',
      captured_at: latestRestoreDrill?.updated_at ?? null,
    },
    {
      key: 'cutover_runbook_session',
      label: 'Cutover runbook session',
      status: cutoverStatus,
      detail: cutoverDetail,
      route: '/operations',
      captured_at: latestCutover?.updated_at ?? null,
    },
  ];
  const launchRequirements = demoLaunchRequirements().filter((item) => !item.ready);
  const blockingCount =
    evidence.filter((item) => item.status === 'blocking').length +
    workplan.blocking_count +
    launchRequirements.filter((item) => item.severity === 'critical').length;
  const warningCount =
    evidence.filter((item) => item.status === 'warning').length +
    workplan.warning_count +
    launchRequirements.filter((item) => item.severity === 'warning').length;
  return {
    status: 'attention',
    go_live_ready: false,
    generated_at: new Date().toISOString(),
    environment: 'demo',
    core_status: 'ok',
    operational_status: 'degraded',
    launch_score: 0,
    blocking_count: blockingCount,
    warning_count: warningCount,
    evidence_ready_count: evidence.filter((item) => item.status === 'ready').length,
    evidence_total: evidence.length,
    evidence,
    open_workplan_items: workplan.items.slice(0, 8),
    latest_attestation: goLiveAttestations[0] ?? null,
  };
}

function demoLiveGate(
  key: string,
  label: string,
  status: LiveUseRehearsalGate['status'],
  detail: string,
  route: string,
  captured_at: string | null = null
): LiveUseRehearsalGate {
  return { key, label, status, detail, route, captured_at };
}

function demoLiveGateFromEvidence(
  key: string,
  label: string,
  evidence: GoLivePacket['evidence'][number] | undefined
): LiveUseRehearsalGate {
  if (!evidence)
    return demoLiveGate(key, label, 'missing', `${label} evidence is missing.`, '/operations');
  return demoLiveGate(
    key,
    label,
    evidence.status,
    evidence.detail,
    evidence.route,
    evidence.captured_at
  );
}

function liveUseNextActions(
  gates: LiveUseRehearsalGate[],
  workplan: LaunchWorkplan
): LiveUseRehearsalAction[] {
  const actions = [
    ...gates
      .filter((gate) => gate.status !== 'ready')
      .map((gate) => ({
        key: `gate_${gate.key}`,
        label: `Resolve ${gate.label}`,
        detail: gate.detail,
        route: gate.route,
        severity: (gate.status === 'warning'
          ? 'warning'
          : 'blocking') as LiveUseRehearsalAction['severity'],
      })),
    ...workplan.items.slice(0, 8).map((item) => ({
      key: `workplan_${item.key}`,
      label: item.label,
      detail: item.recommended_action,
      route: item.route,
      severity: item.severity,
    })),
  ];
  const deduped = new Map<string, LiveUseRehearsalAction>();
  actions.forEach((action) => deduped.set(action.key, action));
  return [...deduped.values()].sort(
    (a, b) =>
      (a.severity === 'blocking' ? 0 : 1) - (b.severity === 'blocking' ? 0 : 1) ||
      a.label.localeCompare(b.label)
  );
}

function liveUseRehearsal(): LiveUseRehearsal {
  const packet = goLivePacket();
  const rehearsal = productionRehearsalReport();
  const workplan = launchWorkplan();
  const preflight = demoCredentialPreflight();
  const evidence = Object.fromEntries(packet.evidence.map((item) => [item.key, item]));
  const gates: LiveUseRehearsalGate[] = [
    demoLiveGate(
      'go_live_packet',
      'Go-live packet',
      packet.go_live_ready ? 'ready' : packet.blocking_count ? 'blocking' : 'warning',
      `${packet.blocking_count} blocker(s), ${packet.warning_count} warning(s), ${packet.evidence_ready_count} of ${packet.evidence_total} evidence item(s) ready.`,
      '/operations'
    ),
    demoLiveGate(
      'production_rehearsal',
      'Production rehearsal',
      rehearsal.rehearsal_ready ? 'ready' : rehearsal.blocking_count ? 'blocking' : 'warning',
      `${rehearsal.blocking_count} blocker(s), ${rehearsal.warning_count} warning(s).`,
      '/operations'
    ),
    demoLiveGate(
      'launch_workplan',
      'Launch workplan',
      workplan.total === 0 ? 'ready' : workplan.blocking_count ? 'blocking' : 'warning',
      `${workplan.blocking_count} blocking, ${workplan.warning_count} warning, ${workplan.unassigned_count} unassigned item(s).`,
      '/operations'
    ),
    demoLiveGate(
      'credential_preflight',
      'Credential preflight',
      preflight.blocking_count ? 'blocking' : 'ready',
      `${preflight.blocking_count} blocking integration item(s), ${preflight.staged_count} staged.`,
      '/integrations'
    ),
    demoLiveGateFromEvidence('browser_qa', 'Browser QA', evidence.browser_qa_session),
    demoLiveGateFromEvidence('staff_training', 'Staff training', evidence.staff_training_session),
    demoLiveGateFromEvidence(
      'policy_approval',
      'Policy approval',
      evidence.policy_approval_session
    ),
    demoLiveGateFromEvidence('role_dry_run', 'Role dry-run', evidence.role_dry_run_session),
  ];
  const readyGates = gates.filter((gate) => gate.status === 'ready').length;
  const blockingGates = gates.filter((gate) => gate.status === 'blocking').length;
  const warningGates = gates.filter((gate) => ['warning', 'missing'].includes(gate.status)).length;
  return {
    status: blockingGates ? 'blocked' : warningGates ? 'attention' : 'ready',
    launch_ready: blockingGates === 0 && warningGates === 0 && packet.go_live_ready,
    score: Math.round((readyGates / gates.length) * 100),
    generated_at: new Date().toISOString(),
    summary: {
      ready_gates: readyGates,
      blocking_gates: blockingGates,
      warning_gates: warningGates,
      evidence_ready_count: packet.evidence_ready_count,
      evidence_total: packet.evidence_total,
      workplan_blockers: workplan.blocking_count,
      workplan_warnings: workplan.warning_count,
      workplan_unassigned: workplan.unassigned_count,
      credential_blockers: preflight.blocking_count,
      credential_staged: preflight.staged_count,
    },
    gates,
    evidence: packet.evidence,
    next_actions: liveUseNextActions(gates, workplan).slice(0, 10),
    open_workplan_items: workplan.items.slice(0, 10),
  };
}

function liveUseRehearsalCsv(dashboard: LiveUseRehearsal) {
  const rows = [['section', 'key', 'label', 'status', 'detail', 'route']];
  dashboard.gates.forEach((gate) =>
    rows.push(['gate', gate.key, gate.label, gate.status, gate.detail, gate.route])
  );
  dashboard.evidence.forEach((item) =>
    rows.push(['evidence', item.key, item.label, item.status, item.detail, item.route])
  );
  dashboard.next_actions.forEach((action) =>
    rows.push(['action', action.key, action.label, action.severity, action.detail, action.route])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function createGoLiveAttestation(data: GoLiveAttestationCreate): GoLiveAttestation {
  const packet = goLivePacket();
  if (data.decision === 'approved' && !packet.go_live_ready) {
    throw new Error(
      `Go-live approval requires a ready packet; ${packet.blocking_count} blocking item(s) remain.`
    );
  }
  const attestation: GoLiveAttestation = {
    id: uuid(1700 + goLiveAttestations.length),
    created_at: new Date().toISOString(),
    decision: data.decision,
    note: data.note ?? null,
    reviewer_id: demoUsers[0]?.id ?? null,
    reviewer_name: demoUsers[0]?.display_name ?? 'Demo Admin',
    packet_status: packet.status,
    go_live_ready: packet.go_live_ready,
    blocking_count: packet.blocking_count,
    warning_count: packet.warning_count,
    evidence_ready_count: packet.evidence_ready_count,
    evidence_total: packet.evidence_total,
  };
  goLiveAttestations = [attestation, ...goLiveAttestations];
  logDemoEvent({
    event_type: 'operations.go_live_packet_attestation',
    entity_type: 'operations',
    entity_id: uuid(903),
    payload: attestation as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return attestation;
}

function demoChecklistItem(
  key: string,
  label: string,
  detail: string,
  route: string,
  status: RoleDryRunChecklistItem['status'] = 'ready'
): RoleDryRunChecklistItem {
  return { key, label, detail, route, status };
}

function demoRoleChecklist(
  key: string,
  label: string,
  summary: string,
  items: RoleDryRunChecklistItem[]
): RoleDryRunChecklist {
  const attention = items.filter((item) => item.status !== 'ready').length;
  return {
    key,
    label,
    summary,
    status: attention ? 'attention' : 'ready',
    ready_count: items.length - attention,
    attention_count: attention,
    total: items.length,
    items,
  };
}

function roleDryRunChecklists(): RoleDryRunChecklistList {
  const closeout = dailyCloseout();
  const workplan = launchWorkplan();
  const preflight = demoCredentialPreflight();
  const roles = [
    demoRoleChecklist(
      'front_desk',
      'Front desk',
      'Own arrivals, checkout handoff, scheduling, portal intake, and communication routing.',
      [
        demoChecklistItem(
          'today_queue',
          "Review today's queue",
          'Confirm scheduled, checked-in, in-progress, and blocked patients from Command Center.',
          '/'
        ),
        demoChecklistItem(
          'checkout_handoff',
          'Complete checkout handoff',
          'Open a patient chart and complete checkout tasks before the patient leaves.',
          '/patients'
        ),
        demoChecklistItem(
          'schedule_followup',
          'Schedule follow-up',
          'Create or adjust a follow-up appointment after checkout.',
          '/scheduling'
        ),
        demoChecklistItem(
          'portal_intake',
          'Process portal intake',
          'Apply intake updates, convert document uploads, or reject invalid submissions.',
          '/portal-intake'
        ),
      ]
    ),
    demoRoleChecklist(
      'ma_nurse',
      'MA / nurse',
      'Reconcile clinical intake, documents, medications, labs, and care-plan blockers.',
      [
        demoChecklistItem(
          'outside_documents',
          'Review outside documents',
          'File, reconcile, or escalate outside records from the patient chart.',
          '/patients',
          closeout.totals.documents_needing_review ? 'attention' : 'ready'
        ),
        demoChecklistItem(
          'med_reconciliation',
          'Reconcile medications',
          'Confirm review or held medication items during rooming/check-out.',
          '/patients'
        ),
        demoChecklistItem(
          'lab_review',
          'Review labs',
          'Confirm new or needs-review lab results and route blockers to provider.',
          '/patients'
        ),
        demoChecklistItem(
          'care_plan',
          'Work care plan',
          'Update nursing-owned care-plan items and escalate blocked items.',
          '/patients'
        ),
      ]
    ),
    demoRoleChecklist(
      'provider',
      'Provider',
      'Resolve clinical flags, documents, labs, medications, encounters, and provider-owned checkout work.',
      [
        demoChecklistItem(
          'clinical_flags',
          'Review chart blockers',
          'Open a patient chart and resolve clinical flags before checkout.',
          '/patients'
        ),
        demoChecklistItem(
          'sign_encounter',
          'Sign encounter',
          'Complete draft or provider-review encounters for downstream billing.',
          '/patients',
          closeout.totals.unsigned_encounters ? 'attention' : 'ready'
        ),
        demoChecklistItem(
          'orders_tasks',
          'Create follow-up tasks',
          'Create clinical follow-up tasks for calls, orders, and outside records.',
          '/tasks'
        ),
        demoChecklistItem(
          'assistant_review',
          'Review assistant actions',
          'Confirm or reject staged assistant actions before they affect workflows.',
          '/assistant-review'
        ),
      ]
    ),
    demoRoleChecklist(
      'billing',
      'Billing',
      'Run charge capture, claim readiness, eligibility, denial rework, and remittance review.',
      [
        demoChecklistItem(
          'charge_review',
          'Review charges',
          'Convert signed encounters into billing cases and clear coding gaps.',
          '/billing'
        ),
        demoChecklistItem(
          'claim_readiness',
          'Submit ready claim',
          'Run claim readiness and submit only cases with eligibility and coding complete.',
          '/billing'
        ),
        demoChecklistItem(
          'denial_rework',
          'Rework denial',
          'Move a denied case through rework and resubmission.',
          '/billing'
        ),
        demoChecklistItem(
          'remittance',
          'Record payment',
          'Record payment or remittance placeholder and confirm timeline/audit visibility.',
          '/billing'
        ),
      ]
    ),
    demoRoleChecklist(
      'manager',
      'Manager',
      'Own readiness evidence, launch blockers, integrations, access review, audit export, and go-live sign-off.',
      [
        demoChecklistItem(
          'go_live_packet',
          'Review go-live packet',
          'Review evidence, blockers, and latest manager attestation.',
          '/operations',
          workplan.blocking_count ? 'attention' : 'ready'
        ),
        demoChecklistItem(
          'credential_preflight',
          'Review credential preflight',
          'Confirm each integration has credentials, connection tests, and sandbox evidence.',
          '/integrations',
          preflight.blocking_count ? 'attention' : 'ready'
        ),
        demoChecklistItem(
          'access_review',
          'Review staff access',
          'Review role assignments, MFA gaps, stale access reviews, and inactive accounts.',
          '/staff'
        ),
        demoChecklistItem(
          'audit_export',
          'Export audit evidence',
          'Export audit events for sensitive workflow activity and launch packet support.',
          '/operations'
        ),
      ]
    ),
  ];
  return {
    generated_at: new Date().toISOString(),
    roles,
    total_roles: roles.length,
    ready_roles: roles.filter((role) => role.status === 'ready').length,
    attention_roles: roles.filter((role) => role.status === 'attention').length,
  };
}

function recalculateDryRunSession(session: RoleDryRunSession): RoleDryRunSession {
  const itemCount = session.roles.reduce((sum, role) => sum + role.items.length, 0);
  const completeCount = session.roles.reduce(
    (sum, role) => sum + role.items.filter((item) => item.dry_run_status === 'complete').length,
    0
  );
  const blockedCount = session.roles.reduce(
    (sum, role) => sum + role.items.filter((item) => item.dry_run_status === 'blocked').length,
    0
  );
  return {
    ...session,
    item_count: itemCount,
    complete_count: completeCount,
    blocked_count: blockedCount,
    pending_count: itemCount - completeCount - blockedCount,
  };
}

function createRoleDryRunSession(data: RoleDryRunSessionStart): RoleDryRunSession {
  const checklist = roleDryRunChecklists();
  const createdAt = new Date().toISOString();
  const session = recalculateDryRunSession({
    id: uuid(1800 + roleDryRunSessions.length),
    session_id: uuid(1900 + roleDryRunSessions.length),
    session_name: data.session_name || 'Clinic dry run',
    status: 'in_progress',
    note: data.note ?? null,
    started_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    completed_by: null,
    started_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    checklist_generated_at: checklist.generated_at,
    item_count: 0,
    complete_count: 0,
    blocked_count: 0,
    pending_count: 0,
    roles: checklist.roles.map((role) => ({
      ...role,
      items: role.items.map((item) => ({
        ...item,
        dry_run_status: 'pending' as const,
        note: null,
      })),
    })),
  });
  roleDryRunSessions = [session, ...roleDryRunSessions];
  logDemoEvent({
    event_type: 'operations.role_dry_run_session',
    entity_type: 'operations',
    entity_id: session.session_id,
    payload: session as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return session;
}

function updateRoleDryRunSession(
  sessionId: string,
  data: RoleDryRunSessionUpdate
): RoleDryRunSession | null {
  const session = roleDryRunSessions.find((item) => item.session_id === sessionId);
  if (!session) return null;
  const updated: RoleDryRunSession = {
    ...session,
    note: data.note !== undefined ? data.note : session.note,
    status: data.session_status ?? session.status,
    completed_at:
      data.session_status === 'completed' && !session.completed_at
        ? new Date().toISOString()
        : session.completed_at,
    completed_by:
      data.session_status === 'completed' && !session.completed_by
        ? (demoUsers[0]?.display_name ?? 'Demo Admin')
        : session.completed_by,
    updated_at: new Date().toISOString(),
    roles: session.roles.map((role) => {
      if (role.key !== data.role_key) return role;
      return {
        ...role,
        items: role.items.map((item) => {
          if (item.key !== data.item_key) return item;
          return {
            ...item,
            dry_run_status: data.dry_run_status ?? item.dry_run_status,
            note: data.item_note !== undefined ? data.item_note : item.note,
          };
        }),
      };
    }),
  };
  const recalculated = recalculateDryRunSession(updated);
  roleDryRunSessions = [
    recalculated,
    ...roleDryRunSessions.filter((item) => item.session_id !== sessionId),
  ];
  logDemoEvent({
    event_type: 'operations.role_dry_run_session',
    entity_type: 'operations',
    entity_id: sessionId,
    payload: recalculated as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return recalculated;
}

function productionRehearsalSnapshotFromEvent(event: AuditEvent): ProductionRehearsalSnapshot {
  const payload = event.payload as Partial<ProductionRehearsalReport>;
  return {
    id: event.id,
    created_at: event.created_at,
    status: payload.status ?? 'attention',
    rehearsal_ready: Boolean(payload.rehearsal_ready),
    score: Number(payload.score ?? 0),
    blocking_count: Number(payload.blocking_count ?? 0),
    warning_count: Number(payload.warning_count ?? 0),
    recommended_action_count: payload.recommended_actions?.length ?? 0,
  };
}

function productionRehearsalCsv(report: ProductionRehearsalReport) {
  const rows = [
    [
      'section',
      'key',
      'label',
      'status',
      'score',
      'detail',
      'route',
      'severity',
      'owner',
      'assignment_status',
      'due_date',
      'note',
    ],
  ];
  report.gates.forEach((gate) =>
    rows.push([
      'gate',
      gate.key,
      gate.label,
      gate.status,
      String(gate.score),
      gate.detail,
      gate.route,
      '',
      '',
      '',
      '',
      '',
    ])
  );
  report.recommended_actions.forEach((action) =>
    rows.push([
      'action',
      action.key,
      action.label,
      '',
      '',
      action.detail,
      action.route,
      action.severity,
      action.assignment?.owner_name ?? '',
      action.assignment?.status ?? '',
      action.assignment?.due_date ?? '',
      action.assignment?.note ?? '',
    ])
  );
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

function assignProductionRehearsalAction(
  actionKey: string,
  data: RehearsalActionAssignmentUpdate
): RehearsalActionAssignment | null {
  const action = productionRehearsalReport().recommended_actions.find(
    (item) => item.key === actionKey
  );
  if (!action) return null;
  const assignment: RehearsalActionAssignment = {
    id: uuid(1600 + Object.keys(rehearsalAssignments).length),
    action_key: actionKey,
    owner_id: data.owner_id ?? null,
    owner_name: data.owner_name,
    status: data.status,
    due_date: data.due_date ?? null,
    note: data.note ?? null,
    assigned_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    assigned_at: new Date().toISOString(),
  };
  rehearsalAssignments[actionKey] = assignment;
  logDemoEvent({
    event_type: 'operations.rehearsal_action_assignment',
    entity_type: 'operations',
    entity_id: actionKey,
    payload: assignment as unknown as Record<string, unknown>,
  });
  saveDemoData();
  return assignment;
}

function assignIntegrationCutoverLane(
  integration: string,
  data: RehearsalActionAssignmentUpdate
): RehearsalActionAssignment | null {
  const lane = integrationCutoverReadinessPacket().items.find(
    (item) => item.integration === integration
  );
  if (!lane) return null;
  const assignment: RehearsalActionAssignment = {
    id: uuid(2600 + Object.keys(integrationCutoverAssignments).length),
    action_key: integration,
    owner_id: data.owner_id ?? null,
    owner_name: data.owner_name,
    status: data.status,
    due_date: data.due_date ?? null,
    note: data.note ?? null,
    assigned_by: demoUsers[0]?.display_name ?? 'Demo Admin',
    assigned_at: new Date().toISOString(),
  };
  integrationCutoverAssignments[integration] = assignment;
  logDemoEvent({
    event_type: 'operations.integration_cutover_assignment',
    entity_type: 'operations',
    entity_id: integration,
    actor_id: demoUsers[0]?.id,
    payload: {
      ...assignment,
      label: lane.label,
      severity:
        lane.cutover_status === 'blocked'
          ? 'blocking'
          : lane.cutover_status === 'attention'
            ? 'warning'
            : 'normal',
      route: lane.route,
    },
  });
  saveDemoData();
  return assignment;
}

function readinessSnapshotFromEvent(event: AuditEvent): ReadinessSnapshot {
  const payload = event.payload as Partial<ReadinessSnapshot>;
  return {
    id: event.id,
    created_at: event.created_at,
    operational_status: payload.operational_status ?? 'degraded',
    core_status: payload.core_status ?? 'ok',
    launch_score: Number(payload.launch_score ?? 0),
    incident_count: Number(payload.incident_count ?? 0),
    critical_count: Number(payload.critical_count ?? 0),
    warning_count: Number(payload.warning_count ?? 0),
  };
}

interface DemoStore {
  patients: Patient[];
  tasks: Task[];
  appointments: Appointment[];
  faxes: Fax[];
  patientDocuments?: PatientDocument[];
  patientMedications?: PatientMedication[];
  patientCarePlan?: PatientCarePlanItem[];
  patientLabs?: PatientLabResult[];
  patientEncounters?: PatientEncounter[];
  messages: Message[];
  auditEvents?: AuditEvent[];
  integrationEvents?: IntegrationEvent[];
  providerAvailability?: ProviderAvailability[];
  clinicSettings?: ClinicSettings;
  billingCases?: BillingCase[];
  portalIntake?: PortalIntakeSubmission[];
  integrationDrafts?: Record<string, Record<string, string>>;
  integrationLastTests?: Record<string, { last_tested_at: string; last_test_status: string }>;
  integrationSandboxEvidence?: Record<string, Record<string, SandboxEvidence>>;
  integrationHandoffArchives?: Record<string, HandoffPacketArchive>;
  rehearsalAssignments?: Record<string, RehearsalActionAssignment>;
  integrationCutoverAssignments?: Record<string, RehearsalActionAssignment>;
  goLiveAttestations?: GoLiveAttestation[];
  roleDryRunSessions?: RoleDryRunSession[];
  browserQaSessions?: BrowserQaSession[];
  staffTrainingSessions?: StaffTrainingSession[];
  policyApprovalSessions?: PolicyApprovalSession[];
  restoreDrillSessions?: RestoreDrillSession[];
  cutoverRunbookSessions?: CutoverRunbookSession[];
}

interface IntegrationEvent {
  id: string;
  organization_id: string;
  integration: string;
  direction: string;
  action: string;
  status: string;
  entity_type: string | null;
  entity_id: string | null;
  idempotency_key: string | null;
  attempts: number;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

let demoUsers: User[] = [
  normalizeDemoUser({
    id: uuid(1),
    email: 'admin@clinic.example.com',
    display_name: 'Clinic Admin',
    role: 'admin',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: false,
    last_login_at: iso(-1),
    access_reviewed_at: null,
    access_reviewed_by_id: null,
    access_review_note: null,
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
  normalizeDemoUser({
    id: uuid(2),
    email: 'nora.ellis@clinic.example.com',
    display_name: 'Dr. Nora Ellis',
    role: 'provider',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: true,
    last_login_at: iso(-2),
    access_reviewed_at: iso(-30),
    access_reviewed_by_id: uuid(1),
    access_review_note: 'Provider access confirmed for pilot.',
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
  normalizeDemoUser({
    id: uuid(3),
    email: 'maya.chen@clinic.example.com',
    display_name: 'Maya Chen, MA',
    role: 'ma',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: false,
    last_login_at: iso(-3),
    access_reviewed_at: iso(-25),
    access_reviewed_by_id: uuid(1),
    access_review_note: 'MA role confirmed.',
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
  normalizeDemoUser({
    id: uuid(4),
    email: 'riley.morgan@clinic.example.com',
    display_name: 'Riley Morgan',
    role: 'manager',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: false,
    last_login_at: iso(-6),
    access_reviewed_at: iso(-120),
    access_reviewed_by_id: uuid(1),
    access_review_note: 'Review is stale for production launch.',
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
  normalizeDemoUser({
    id: uuid(5),
    email: 'sam.rivera@clinic.example.com',
    display_name: 'Sam Rivera',
    role: 'front_desk',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: false,
    last_login_at: iso(-4),
    access_reviewed_at: iso(-20),
    access_reviewed_by_id: uuid(4),
    access_review_note: 'Front desk access confirmed.',
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
  normalizeDemoUser({
    id: uuid(6),
    email: 'omar.singh@clinic.example.com',
    display_name: 'Dr. Omar Singh',
    role: 'provider',
    organization_id: uuid(900),
    is_active: true,
    mfa_enabled: true,
    last_login_at: null,
    access_reviewed_at: null,
    access_reviewed_by_id: null,
    access_review_note: null,
    created_at: iso(-720),
    updated_at: iso(-24),
  }),
];

let providerAvailability: ProviderAvailability[] = [
  { id: uuid(2501), provider_id: uuid(2), day_of_week: 1, start_time: '09:00', end_time: '17:00' },
  { id: uuid(2502), provider_id: uuid(2), day_of_week: 3, start_time: '09:00', end_time: '15:00' },
  { id: uuid(2503), provider_id: uuid(6), day_of_week: 2, start_time: '08:00', end_time: '16:00' },
];

let clinicSettings: ClinicSettings = {
  reminder_offsets_minutes: [1440, 120],
  reminder_sms_template:
    'Reminder: you have an appointment with {clinic_name} on {appointment_time}. Reply STOP to opt out.',
  reminder_email_template:
    'You have an appointment with {clinic_name} on {appointment_time}. Please arrive 10 minutes early.',
  sender_identity: 'ConciergeOS Clinic',
  audit_retention_days: 2555,
  phi_reauth_minutes: 15,
};

let billingCases: BillingCase[] = [];
let portalIntake: PortalIntakeSubmission[] = [];
const preparedUploadTokens = new Map<
  string,
  { patientId: string; fileUrl: string; contentType: string }
>();
let integrationDrafts: Record<string, Record<string, string>> = {};
let integrationLastTests: Record<string, { last_tested_at: string; last_test_status: string }> = {};
let integrationSandboxEvidence: Record<string, Record<string, SandboxEvidence>> = {};
let integrationHandoffArchives: Record<string, HandoffPacketArchive> = {};
let rehearsalAssignments: Record<string, RehearsalActionAssignment> = {};
let integrationCutoverAssignments: Record<string, RehearsalActionAssignment> = {};
let goLiveAttestations: GoLiveAttestation[] = [];
let roleDryRunSessions: RoleDryRunSession[] = [];
let browserQaSessions: BrowserQaSession[] = [];
let staffTrainingSessions: StaffTrainingSession[] = [];
let policyApprovalSessions: PolicyApprovalSession[] = [];
let restoreDrillSessions: RestoreDrillSession[] = [];
let cutoverRunbookSessions: CutoverRunbookSession[] = [];
const encounterTemplates: EncounterTemplate[] = [
  {
    id: 'office_visit',
    name: 'Office Visit SOAP',
    encounter_type: 'office_visit',
    subjective: 'Chief concern:\nHistory of present illness:\nReview of systems:',
    objective: 'Vitals reviewed.\nExam:',
    assessment: 'Assessment:',
    plan: 'Plan:\nFollow-up:',
  },
  {
    id: 'annual_wellness',
    name: 'Annual Wellness',
    encounter_type: 'annual_wellness',
    subjective: 'Interval history:\nPreventive concerns:',
    objective: 'Vitals reviewed.\nScreenings reviewed:',
    assessment: 'Preventive care assessment:',
    plan: 'Preventive plan:\nOrders/referrals:',
  },
];

let patients: Patient[] = [
  {
    id: uuid(101),
    mrn: 'MRN-10492',
    first_name: 'Mary',
    last_name: 'Collins',
    dob: '1961-04-18',
    gender: 'Female',
    phone: '(312) 555-0184',
    email: 'mary.collins@example.test',
    sms_consent: true,
    email_consent: true,
    preferred_contact_channel: 'sms',
    address: { street: '412 Prairie Ave', city: 'Chicago', state: 'IL', zip: '60616' },
    emergency_contact: { name: 'Evan Collins', relationship: 'Spouse', phone: '(312) 555-0119' },
    insurance: { provider: 'BlueCross', plan: 'PPO', member_id: 'BC-884221', group_number: '1037' },
    allergies: [{ substance: 'Penicillin', reaction: 'Hives', severity: 'moderate' }],
    problem_list: ['Hypertension', 'Type 2 diabetes', 'Hyperlipidemia'],
    is_active: true,
    created_at: iso(-240),
    updated_at: iso(-1),
  },
  {
    id: uuid(102),
    mrn: 'MRN-11807',
    first_name: 'Andre',
    last_name: 'Miller',
    dob: '1978-10-02',
    gender: 'Male',
    phone: '(312) 555-0128',
    email: 'andre.miller@example.test',
    sms_consent: true,
    email_consent: false,
    preferred_contact_channel: 'sms',
    address: { street: '88 Lake Shore Dr', city: 'Chicago', state: 'IL', zip: '60611' },
    emergency_contact: null,
    insurance: { provider: 'Aetna', plan: 'HMO', member_id: 'AET-442901', group_number: '8812' },
    allergies: [],
    problem_list: ['Asthma', 'GERD'],
    is_active: true,
    created_at: iso(-180),
    updated_at: iso(-2),
  },
  {
    id: uuid(103),
    mrn: 'MRN-12138',
    first_name: 'Sofia',
    last_name: 'Nguyen',
    dob: '1989-01-25',
    gender: 'Female',
    phone: '(312) 555-0173',
    email: 'sofia.nguyen@example.test',
    sms_consent: false,
    email_consent: true,
    preferred_contact_channel: 'email',
    address: { street: '1700 W Division St', city: 'Chicago', state: 'IL', zip: '60622' },
    emergency_contact: { name: 'Minh Nguyen', relationship: 'Brother', phone: '(312) 555-0144' },
    insurance: null,
    allergies: [{ substance: 'Sulfa', reaction: 'Rash', severity: 'mild' }],
    problem_list: ['Hypothyroidism'],
    is_active: true,
    created_at: iso(-90),
    updated_at: iso(-5),
  },
  {
    id: uuid(104),
    mrn: 'MRN-12881',
    first_name: 'James',
    last_name: 'Patel',
    dob: '1994-07-11',
    gender: 'Male',
    phone: '(312) 555-0190',
    email: 'james.patel@example.test',
    sms_consent: false,
    email_consent: false,
    preferred_contact_channel: null,
    address: null,
    emergency_contact: null,
    insurance: {
      provider: 'United Healthcare',
      plan: 'Choice Plus',
      member_id: 'UHC-099321',
      group_number: '5501',
    },
    allergies: [],
    problem_list: [],
    is_active: true,
    created_at: iso(-72),
    updated_at: iso(-6),
  },
  {
    id: uuid(105),
    mrn: 'MRN-13644',
    first_name: 'Lena',
    last_name: 'Brooks',
    dob: '1955-11-09',
    gender: 'Female',
    phone: '(312) 555-0107',
    email: 'lena.brooks@example.test',
    sms_consent: true,
    email_consent: true,
    preferred_contact_channel: 'email',
    address: { street: '205 Oak St', city: 'Oak Park', state: 'IL', zip: '60302' },
    emergency_contact: { name: 'Theo Brooks', relationship: 'Son', phone: '(312) 555-0133' },
    insurance: { provider: 'Medicare', plan: 'Part B', member_id: 'MCR-72118', group_number: '' },
    allergies: [{ substance: 'Latex', reaction: 'Contact dermatitis', severity: 'mild' }],
    problem_list: ['Atrial fibrillation', 'Osteoarthritis'],
    is_active: true,
    created_at: iso(-48),
    updated_at: iso(-3),
  },
];

let tasks: Task[] = [
  withDeliveryDefaults({
    id: uuid(201),
    title: 'Call Mary Collins with potassium result',
    description: 'Critical lab callback and medication reconciliation.',
    priority: 'urgent',
    status: 'open',
    due_date: iso(1),
    assigned_to_id: uuid(3),
    assigned_to_name: 'Maya Chen, MA',
    patient_id: uuid(101),
    patient_name: 'Mary Collins',
    source_type: null,
    source_id: null,
    creator_id: uuid(1),
    created_at: iso(-8),
    updated_at: iso(-1),
  }),
  withDeliveryDefaults({
    id: uuid(202),
    title: 'Room Andre Miller',
    description: 'Update medication list and repeat blood pressure.',
    priority: 'high',
    status: 'in_progress',
    due_date: iso(0.5),
    assigned_to_id: uuid(3),
    assigned_to_name: 'Maya Chen, MA',
    patient_id: uuid(102),
    patient_name: 'Andre Miller',
    source_type: null,
    source_id: null,
    creator_id: uuid(1),
    created_at: iso(-2),
    updated_at: iso(-0.5),
  }),
  withDeliveryDefaults({
    id: uuid(203),
    title: 'Prepare referral packet',
    description: 'Cardiology referral packet for Lena Brooks.',
    priority: 'normal',
    status: 'open',
    due_date: iso(24),
    assigned_to_id: uuid(4),
    assigned_to_name: 'Riley Morgan',
    patient_id: uuid(105),
    patient_name: 'Lena Brooks',
    source_type: null,
    source_id: null,
    creator_id: uuid(1),
    created_at: iso(-20),
    updated_at: iso(-4),
  }),
  withDeliveryDefaults({
    id: uuid(204),
    title: 'Scan new patient forms',
    description: 'Attach intake and privacy forms to chart.',
    priority: 'normal',
    status: 'completed',
    due_date: iso(-1),
    assigned_to_id: uuid(5),
    assigned_to_name: 'Sam Rivera',
    patient_id: uuid(104),
    patient_name: 'James Patel',
    source_type: null,
    source_id: null,
    creator_id: uuid(1),
    created_at: iso(-28),
    updated_at: iso(-2),
  }),
  withDeliveryDefaults({
    id: uuid(205),
    title: 'Verify insurance eligibility',
    description: 'Sofia Nguyen coverage is missing from chart.',
    priority: 'high',
    status: 'open',
    due_date: iso(3),
    assigned_to_id: uuid(5),
    assigned_to_name: 'Sam Rivera',
    patient_id: uuid(103),
    patient_name: 'Sofia Nguyen',
    source_type: null,
    source_id: null,
    creator_id: uuid(1),
    created_at: iso(-10),
    updated_at: iso(-2),
  }),
  withDeliveryDefaults({
    id: uuid(206),
    title: 'Resolve outside records blocker',
    description: 'Waiting on sending office reference before filing cardiology notes.',
    priority: 'high',
    status: 'blocked',
    due_date: iso(-6),
    assigned_to_id: null,
    assigned_to_name: null,
    patient_id: uuid(101),
    patient_name: 'Mary Collins',
    source_type: 'document_review',
    source_id: uuid(430),
    creator_id: uuid(1),
    created_at: iso(-30),
    updated_at: iso(-6),
  }),
];

let appointments: Appointment[] = [
  {
    id: uuid(301),
    patient_id: uuid(101),
    patient_name: 'Mary Collins',
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    start_time: '2026-06-03T08:30:00-04:00',
    end_time: '2026-06-03T09:00:00-04:00',
    type: 'Annual wellness',
    status: 'checked_in',
    notes: 'Vitals complete.',
    created_at: iso(-120),
    updated_at: iso(-4),
  },
  {
    id: uuid(302),
    patient_id: uuid(102),
    patient_name: 'Andre Miller',
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    start_time: '2026-06-03T09:00:00-04:00',
    end_time: '2026-06-03T09:30:00-04:00',
    type: 'Follow-up',
    status: 'in_progress',
    notes: 'Medication list needs review.',
    created_at: iso(-110),
    updated_at: iso(-1),
  },
  {
    id: uuid(303),
    patient_id: uuid(103),
    patient_name: 'Sofia Nguyen',
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    start_time: '2026-06-03T09:30:00-04:00',
    end_time: '2026-06-03T10:00:00-04:00',
    type: 'Lab review',
    status: 'scheduled',
    notes: null,
    created_at: iso(-100),
    updated_at: iso(-12),
  },
  {
    id: uuid(304),
    patient_id: uuid(104),
    patient_name: 'James Patel',
    provider_id: uuid(6),
    provider_name: 'Dr. Omar Singh',
    start_time: '2026-06-03T10:00:00-04:00',
    end_time: '2026-06-03T10:45:00-04:00',
    type: 'New patient',
    status: 'scheduled',
    notes: 'Forms pending.',
    created_at: iso(-98),
    updated_at: iso(-9),
  },
  {
    id: uuid(305),
    patient_id: uuid(105),
    patient_name: 'Lena Brooks',
    provider_id: uuid(6),
    provider_name: 'Dr. Omar Singh',
    start_time: '2026-06-04T10:30:00-04:00',
    end_time: '2026-06-04T11:00:00-04:00',
    type: 'Medication check',
    status: 'scheduled',
    notes: null,
    created_at: iso(-80),
    updated_at: iso(-7),
  },
];

let faxes: Fax[] = [
  {
    id: uuid(401),
    direction: 'inbound',
    status: 'received',
    from_number: '+13125550100',
    to_number: '+13125550999',
    pages: 4,
    file_url: null,
    patient_id: uuid(101),
    patient_name: 'Mary Collins',
    matched_by: 'MRN detected',
    ocr_text: 'LabCorp final report. Potassium 5.9 mmol/L. Please review urgently.',
    created_at: iso(-1.4),
  },
  {
    id: uuid(402),
    direction: 'inbound',
    status: 'processing',
    from_number: '+13125550177',
    to_number: '+13125550999',
    pages: 2,
    file_url: null,
    patient_id: null,
    patient_name: null,
    matched_by: null,
    ocr_text: 'Referral authorization notice. Patient name partially obscured.',
    created_at: iso(-2.5),
  },
  {
    id: uuid(403),
    direction: 'outbound',
    status: 'sent',
    from_number: '+13125550999',
    to_number: '+13125550122',
    pages: 7,
    file_url: null,
    patient_id: uuid(105),
    patient_name: 'Lena Brooks',
    matched_by: 'manual',
    ocr_text: 'Cardiology referral packet and medication history.',
    created_at: iso(-24),
  },
  {
    id: uuid(404),
    direction: 'outbound',
    status: 'failed',
    from_number: '+13125550999',
    to_number: '+13125550188',
    pages: 3,
    file_url: null,
    patient_id: uuid(103),
    patient_name: 'Sofia Nguyen',
    matched_by: 'manual',
    ocr_text: 'Insurance appeal documentation.',
    created_at: iso(-5),
  },
];

let patientDocuments: PatientDocument[] = [
  {
    id: uuid(451),
    patient_id: uuid(101),
    title: 'LabCorp final report',
    source: 'LabCorp Chicago Central',
    document_type: 'Lab result',
    status: 'needs_review',
    matched_by: 'MRN detected',
    source_contact: 'LabCorp client services',
    source_phone: '+13125550144',
    source_fax: '+13125550145',
    source_reference: 'LC-CRIT-20260603',
    requested_by: 'Maya Chen, MA',
    routed_to_role: 'provider',
    review_priority: 'urgent',
    pages: 4,
    file_url: null,
    summary: 'CMP and A1c received. Potassium is flagged critical and requires same-day review.',
    received_at: '2026-06-03T10:42:00-04:00',
    created_at: iso(-1.4),
    updated_at: iso(-1.4),
  },
  {
    id: uuid(452),
    patient_id: uuid(101),
    title: 'Cardiology consult note',
    source: 'North Shore Cardiology',
    document_type: 'Consult note',
    status: 'filed',
    matched_by: 'manual',
    source_contact: 'Dr. Priya Rao',
    source_phone: '+13125550177',
    source_fax: '+13125550178',
    source_reference: 'NSC consult 1028',
    requested_by: 'Dr. Nora Ellis',
    routed_to_role: 'provider',
    review_priority: 'normal',
    review_note: 'Filed after provider review; follow-up EKG plan already added.',
    reviewed_by: 'Dr. Nora Ellis',
    reviewed_at: iso(-138),
    pages: 7,
    file_url: null,
    summary: 'Medication recommendations and follow-up EKG plan after cardiology evaluation.',
    received_at: '2026-05-28T15:16:00-04:00',
    created_at: iso(-140),
    updated_at: iso(-140),
  },
  {
    id: uuid(453),
    patient_id: uuid(101),
    title: 'Hospital discharge summary',
    source: 'Mercy Medical Center',
    document_type: 'Discharge',
    status: 'reconciled',
    matched_by: 'patient DOB + name',
    source_contact: 'Mercy records desk',
    source_phone: '+13125550190',
    source_fax: '+13125550191',
    source_reference: 'Discharge 2026-05-21',
    requested_by: 'Care coordinator',
    routed_to_role: 'ma_nurse',
    review_priority: 'high',
    review_note: 'Medication changes reconciled with active list.',
    reviewed_by: 'Maya Chen, MA',
    reviewed_at: iso(-260),
    pages: 11,
    file_url: null,
    summary: 'Observation stay summary, medication changes, and discharge instructions.',
    received_at: '2026-05-22T09:04:00-04:00',
    created_at: iso(-280),
    updated_at: iso(-280),
  },
  {
    id: uuid(454),
    patient_id: uuid(105),
    title: 'Cardiology referral response',
    source: 'Lakeview Heart Group',
    document_type: 'Referral',
    status: 'received',
    matched_by: 'manual',
    source_contact: 'Lakeview referral desk',
    source_phone: '+13125550210',
    source_fax: '+13125550211',
    source_reference: 'Referral response LVH-778',
    requested_by: 'Front desk',
    routed_to_role: 'care_coordinator',
    review_priority: 'normal',
    pages: 3,
    file_url: null,
    summary: 'Referral accepted with suggested anticoagulation follow-up window.',
    received_at: '2026-06-02T14:20:00-04:00',
    created_at: iso(-23),
    updated_at: iso(-23),
  },
].map((document) => normalizeDocument(document as PatientDocument));

let patientMedications: PatientMedication[] = [
  {
    id: uuid(461),
    patient_id: uuid(101),
    name: 'Lisinopril',
    dose: '20 mg',
    directions: '1 tablet daily',
    source: 'Active med list',
    status: 'active',
    note: null,
    created_at: iso(-20),
    updated_at: iso(-2),
  },
  {
    id: uuid(462),
    patient_id: uuid(101),
    name: 'Metformin ER',
    dose: '500 mg',
    directions: '2 tablets with dinner',
    source: 'Active med list',
    status: 'review',
    note: 'Review A1c during visit.',
    created_at: iso(-20),
    updated_at: iso(-2),
  },
  {
    id: uuid(463),
    patient_id: uuid(101),
    name: 'Atorvastatin',
    dose: '40 mg',
    directions: '1 tablet nightly',
    source: 'Cardiology note',
    status: 'active',
    note: null,
    created_at: iso(-120),
    updated_at: iso(-120),
  },
  {
    id: uuid(464),
    patient_id: uuid(101),
    name: 'Potassium chloride',
    dose: '10 mEq',
    directions: 'Historical supplement',
    source: 'Discharge summary',
    status: 'held',
    note: 'Hold pending provider review.',
    created_at: iso(-240),
    updated_at: iso(-1),
  },
];

let patientCarePlan: PatientCarePlanItem[] = [
  {
    id: uuid(471),
    patient_id: uuid(101),
    assigned_to_id: uuid(2),
    assigned_to_name: 'Dr. Nora Ellis',
    owner_role: 'Provider',
    item: 'Review critical potassium and decide medication changes before checkout.',
    due: 'Today',
    status: 'open',
    escalation: 'same_day',
    note: null,
    created_at: iso(-2),
    updated_at: iso(-2),
  },
  {
    id: uuid(472),
    patient_id: uuid(101),
    assigned_to_id: uuid(3),
    assigned_to_name: 'Maya Chen, MA',
    owner_role: 'MA',
    item: 'Repeat blood pressure and reconcile outside medication list.',
    due: 'Before provider',
    status: 'in_progress',
    escalation: null,
    note: null,
    created_at: iso(-2),
    updated_at: iso(-1),
  },
  {
    id: uuid(473),
    patient_id: uuid(101),
    assigned_to_id: null,
    assigned_to_name: null,
    owner_role: 'Front desk',
    item: 'Schedule 3 month chronic care follow-up and confirm preferred pharmacy.',
    due: 'Checkout',
    status: 'open',
    escalation: null,
    note: null,
    created_at: iso(-2),
    updated_at: iso(-2),
  },
  {
    id: uuid(474),
    patient_id: uuid(101),
    assigned_to_id: null,
    assigned_to_name: null,
    owner_role: 'Care coordinator',
    item: 'Confirm cardiology follow-up was completed and request missing EKG if needed.',
    due: 'This week',
    status: 'open',
    escalation: null,
    note: null,
    created_at: iso(-2),
    updated_at: iso(-2),
  },
];

let patientLabs: PatientLabResult[] = [
  {
    id: uuid(481),
    patient_id: uuid(101),
    collected_at: '2026-06-03T08:00:00-04:00',
    panel: 'CMP',
    result: 'Potassium 5.9 mmol/L',
    flag: 'Critical',
    status: 'needs_review',
    source: 'LabCorp',
    note: null,
    created_at: iso(-4),
    updated_at: iso(-4),
  },
  {
    id: uuid(482),
    patient_id: uuid(101),
    collected_at: '2026-06-03T08:00:00-04:00',
    panel: 'A1c',
    result: '7.4%',
    flag: 'High',
    status: 'needs_review',
    source: 'LabCorp',
    note: null,
    created_at: iso(-4),
    updated_at: iso(-4),
  },
  {
    id: uuid(483),
    patient_id: uuid(101),
    collected_at: '2026-03-12T08:00:00-04:00',
    panel: 'Lipid panel',
    result: 'LDL 92 mg/dL',
    flag: 'Normal',
    status: 'filed',
    source: 'LabCorp',
    note: null,
    created_at: iso(-500),
    updated_at: iso(-500),
  },
];

let patientEncounters: PatientEncounter[] = [
  {
    id: uuid(491),
    patient_id: uuid(101),
    appointment_id: uuid(301),
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    encounter_type: 'Annual wellness',
    status: 'provider_review',
    summary: 'Preventive visit, medication reconciliation, and chronic condition review.',
    subjective: 'Patient reports feeling well overall with questions about recent lab alert.',
    objective: 'Vitals reviewed. Outside CMP and A1c available in chart.',
    assessment: 'Hypertension, diabetes, hyperlipidemia with potassium requiring review.',
    plan: 'Review potassium supplement, call patient with medication plan, follow up in 3 months.',
    signed_at: null,
    created_at: iso(-3),
    updated_at: iso(-1),
  },
  {
    id: uuid(492),
    patient_id: uuid(101),
    appointment_id: uuid(306),
    provider_id: uuid(2),
    provider_name: 'Dr. Nora Ellis',
    encounter_type: 'Follow-up',
    status: 'signed',
    summary: 'Blood pressure improved after dose adjustment.',
    subjective: null,
    objective: null,
    assessment: null,
    plan: 'Continue medication and home BP monitoring.',
    signed_at: iso(-190),
    created_at: iso(-200),
    updated_at: iso(-190),
  },
];

let messages: Message[] = [
  {
    id: uuid(501),
    sender_id: uuid(101),
    sender_name: 'Mary Collins',
    recipient_id: uuid(1),
    recipient_name: 'Clinic Admin',
    subject: 'Lab result question',
    body: 'I saw a lab alert in the portal. Should I change anything before my visit?',
    thread_id: uuid(601),
    is_read: false,
    created_at: iso(-2),
  },
  {
    id: uuid(502),
    sender_id: uuid(1),
    sender_name: 'Clinic Admin',
    recipient_id: uuid(101),
    recipient_name: 'Mary Collins',
    subject: 'Lab result question',
    body: 'We received it and the provider is reviewing. We will call you this afternoon.',
    thread_id: uuid(601),
    is_read: true,
    created_at: iso(-1.5),
  },
  {
    id: uuid(503),
    sender_id: uuid(103),
    sender_name: 'Sofia Nguyen',
    recipient_id: uuid(1),
    recipient_name: 'Clinic Admin',
    subject: 'Medication refill',
    body: 'Can you send my thyroid medication refill to the usual pharmacy?',
    thread_id: uuid(602),
    is_read: false,
    created_at: iso(-4),
  },
  {
    id: uuid(504),
    sender_id: uuid(5),
    sender_name: 'Sam Rivera',
    recipient_id: uuid(1),
    recipient_name: 'Clinic Admin',
    subject: 'Front desk handoff',
    body: 'James Patel forms are missing insurance card images.',
    thread_id: uuid(603),
    is_read: true,
    created_at: iso(-6),
  },
];

let auditEvents: AuditEvent[] = [
  {
    id: uuid(801),
    actor_id: uuid(1),
    event_type: 'demo.workspace_ready',
    entity_type: 'workspace',
    entity_id: uuid(1),
    payload: { summary: 'Demo workspace initialized for frontend review' },
    created_at: iso(-0.25),
  },
];

let integrationEvents: IntegrationEvent[] = [
  {
    id: uuid(850),
    organization_id: 'default',
    integration: 'fax_provider',
    direction: 'outbound',
    action: 'send_document',
    status: 'failed',
    entity_type: 'fax',
    entity_id: uuid(404),
    idempotency_key: 'demo-fax-send-404',
    attempts: 1,
    error: 'Demo provider unavailable',
    payload: { to_number: '+13125550188' },
    created_at: iso(-3),
    updated_at: iso(-3),
  },
  {
    id: uuid(851),
    organization_id: 'default',
    integration: 'portal',
    direction: 'inbound',
    action: 'message.received',
    status: 'succeeded',
    entity_type: 'message',
    entity_id: uuid(501),
    idempotency_key: 'demo-portal-message-501',
    attempts: 1,
    error: null,
    payload: { subject: 'Lab result question' },
    created_at: iso(-2),
    updated_at: iso(-2),
  },
];

function readStoredDemoData(): DemoStore | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DemoStore) : null;
  } catch {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
    return null;
  }
}

function saveDemoData() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    DEMO_STORAGE_KEY,
    JSON.stringify({
      patients,
      tasks,
      appointments,
      faxes,
      patientDocuments,
      patientMedications,
      patientCarePlan,
      patientLabs,
      patientEncounters,
      messages,
      auditEvents,
      integrationEvents,
      providerAvailability,
      clinicSettings,
      billingCases,
      portalIntake,
      integrationDrafts,
      integrationLastTests,
      integrationSandboxEvidence,
      integrationHandoffArchives,
      rehearsalAssignments,
      integrationCutoverAssignments,
      goLiveAttestations,
      roleDryRunSessions,
      browserQaSessions,
      staffTrainingSessions,
      policyApprovalSessions,
      restoreDrillSessions,
      cutoverRunbookSessions,
    })
  );
}

function findDemoHandoffSource(patientId: string, sourceType: string, sourceId: string) {
  if (sourceType === 'document') {
    const source = patientDocuments.find(
      (item) =>
        item.patient_id === patientId && item.id === sourceId && item.status === 'needs_review'
    );
    return source
      ? {
          title: `Review document: ${source.title}`,
          description: `${source.document_type} from ${source.source}; status ${source.status}.`,
        }
      : null;
  }
  if (sourceType === 'medication') {
    const source = patientMedications.find(
      (item) =>
        item.patient_id === patientId &&
        item.id === sourceId &&
        ['review', 'held'].includes(item.status)
    );
    return source
      ? {
          title: `Resolve medication: ${source.name}`,
          description: `${source.name} requires checkout reconciliation; status ${source.status}.`,
        }
      : null;
  }
  if (sourceType === 'lab') {
    const source = patientLabs.find(
      (item) =>
        item.patient_id === patientId &&
        item.id === sourceId &&
        ['new', 'needs_review'].includes(item.status)
    );
    return source
      ? {
          title: `Review lab: ${source.panel}`,
          description: `${source.panel}: ${source.result}; status ${source.status}.`,
        }
      : null;
  }
  if (sourceType === 'care_plan') {
    const source = patientCarePlan.find(
      (item) =>
        item.patient_id === patientId &&
        item.id === sourceId &&
        ['open', 'in_progress', 'blocked'].includes(item.status)
    );
    return source
      ? {
          title: source.item,
          description:
            source.note ?? `${source.owner_role} checkout work item; status ${source.status}.`,
          assigned_to_id: source.assigned_to_id,
          assigned_to_name: source.assigned_to_name,
        }
      : null;
  }
  const source = patientEncounters.find(
    (item) =>
      item.patient_id === patientId &&
      item.id === sourceId &&
      ['draft', 'provider_review'].includes(item.status)
  );
  return source
    ? {
        title: `Sign encounter: ${source.encounter_type}`,
        description: source.summary ?? `${source.encounter_type} is ${source.status}.`,
        assigned_to_id: source.provider_id,
        assigned_to_name: source.provider_name,
      }
    : null;
}

function demoIntegrationConfigs() {
  const specs = [
    [
      'ehr',
      'EHR',
      ['EHR_API_BASE_URL'],
      false,
      ['Chart sync', 'Medication reconciliation', 'Lab import'],
      'Connect the chosen EHR API and validate sync.',
      [
        'Fetch a test patient demographic record',
        'Import medication and lab fixtures',
        'Write or reconcile one encounter note in sandbox',
      ],
      [
        [
          'patient_search',
          'Patient search',
          'Find patients by name, DOB, MRN, or vendor identifier.',
        ],
        [
          'demographics_sync',
          'Demographics sync',
          'Import and update patient demographics from the EHR source of truth.',
        ],
        [
          'medication_sync',
          'Medication sync',
          'Import active medication lists for reconciliation.',
        ],
        ['lab_import', 'Lab import', 'Import lab results and clinical review status.'],
        [
          'encounter_writeback',
          'Encounter writeback',
          'Write or reconcile encounter notes in the vendor sandbox.',
        ],
      ],
    ],
    [
      'fax',
      'Fax provider',
      ['FAX_PROVIDER_API_KEY'],
      true,
      ['Inbound fax matching', 'Outbound referrals', 'Delivery status'],
      'Set provider credentials and verify inbound/outbound callbacks.',
      [
        'Send a sandbox outbound fax',
        'Receive an inbound fax webhook',
        'Download the source document and confirm patient matching',
      ],
      [
        [
          'send_document',
          'Send document',
          'Send outbound documents and referrals through the provider.',
        ],
        [
          'receive_webhook',
          'Receive webhook',
          'Map inbound fax callbacks into integration events.',
        ],
        ['delivery_status', 'Delivery status sync', 'Capture sent, failed, and delivered states.'],
        [
          'document_download',
          'Document download',
          'Download source documents or hand off signed object URLs.',
        ],
        [
          'patient_document_match',
          'Patient document match',
          'Create patient document review records from matched inbound faxes.',
        ],
      ],
    ],
    [
      'portal',
      'Patient portal',
      ['PORTAL_API_BASE_URL'],
      false,
      ['Portal messages', 'Patient intake', 'Document import'],
      'Connect portal API and validate webhook mapping.',
      [
        'Sync a patient portal message thread',
        'Receive an intake submission',
        'Import a portal-uploaded document',
      ],
      [
        ['send_message', 'Send message', 'Send portal messages through the external portal.'],
        ['thread_lookup', 'Thread lookup', 'Fetch and reconcile portal message threads.'],
        ['intake_webhook', 'Intake webhook', 'Map portal intake submissions into intake review.'],
        [
          'document_import',
          'Document import',
          'Import portal-uploaded documents into patient document review.',
        ],
      ],
    ],
    [
      'calendar',
      'Calendar',
      ['CALENDAR_API_BASE_URL'],
      false,
      ['Appointment sync', 'Conflict checks', 'Provider availability'],
      'Connect calendar API and validate appointment sync.',
      [
        'Create a sandbox appointment',
        'Update and cancel the appointment',
        'Fetch provider availability and conflict results',
      ],
      [
        ['create_event', 'Create event', 'Create appointments in the external calendar.'],
        ['update_event', 'Update event', 'Update and cancel external calendar appointments.'],
        [
          'availability_sync',
          'Availability sync',
          'Fetch provider availability and conflict results.',
        ],
        [
          'reminder_source',
          'Reminder source of truth',
          'Preserve reminder and schedule source-of-truth behavior.',
        ],
      ],
    ],
    [
      'communications',
      'Communications',
      ['COMMUNICATIONS_PROVIDER', 'COMMUNICATIONS_PROVIDER_API_KEY'],
      true,
      ['Patient outreach', 'Appointment reminders', 'Delivery callbacks'],
      'Select SMS/email provider and validate delivery callbacks.',
      [
        'Queue a consent-approved outreach message',
        'Receive queued, delivered, failed, and blocked callbacks',
        'Confirm audit and retry states update',
      ],
      [
        ['send_outreach', 'Send outreach', 'Send consent-approved SMS, email, or portal outreach.'],
        ['queue_callback', 'Queued callback', 'Capture queued provider delivery callbacks.'],
        ['delivery_callback', 'Delivery callback', 'Capture delivered provider callbacks.'],
        ['failure_callback', 'Failure callback', 'Capture failed and blocked provider callbacks.'],
        ['retry_state', 'Retry state', 'Update retry and audit state after provider callbacks.'],
      ],
    ],
    [
      'copilotkit',
      'CopilotKit runtime',
      ['COPILOTKIT_RUNTIME_URL'],
      false,
      ['Assistant runtime', 'Tool policy', 'Confirmation gates'],
      'Deploy runtime and approve model/tool policy.',
      [
        'Reach the CopilotKit runtime health endpoint',
        'Run a non-PHI assistant action in sandbox',
        'Verify tool authorization and audit logging',
      ],
      [
        ['runtime_health', 'Runtime health', 'Reach the configured CopilotKit runtime.'],
        [
          'tenant_authorization',
          'Tenant authorization',
          'Forward tenant and user authorization context.',
        ],
        [
          'tool_allowlist',
          'Tool allowlist',
          'Restrict runtime tools to approved confirmation-gated actions.',
        ],
        ['audit_capture', 'Audit capture', 'Capture assistant tool invocation audit evidence.'],
      ],
    ],
    [
      'clearinghouse',
      'Clearinghouse',
      ['CLEARINGHOUSE_API_BASE_URL', 'CLEARINGHOUSE_API_KEY'],
      true,
      ['Claim submission', 'Eligibility verification', 'ERA/remittance import'],
      'Connect clearinghouse credentials and validate claim, denial, and remittance workflows.',
      [
        'Submit a sandbox claim and capture the clearinghouse reference',
        'Receive denial or acceptance callback',
        'Import ERA/remittance fixture into the billing timeline',
      ],
      [
        [
          'claim_submission',
          'Claim submission',
          'Submit claims and retain clearinghouse references.',
        ],
        ['eligibility_check', 'Eligibility check', 'Run payer eligibility checks when supported.'],
        [
          'denial_callback',
          'Denial callback',
          'Map denial and acceptance callbacks to billing cases.',
        ],
        ['payment_callback', 'Payment callback', 'Capture payment status callbacks.'],
        [
          'remittance_import',
          'ERA/remittance import',
          'Import ERA/remittance data into the billing timeline.',
        ],
      ],
    ],
    [
      'labs_hie',
      'Labs / HIE',
      ['LABS_HIE_API_BASE_URL'],
      false,
      ['Lab order submission', 'Lab result import', 'HIE patient query'],
      'Configure a vendor-specific labs/HIE adapter and set LABS_HIE_API_BASE_URL.',
      [
        'Submit a sandbox lab order',
        'Receive a lab result callback',
        'Query HIE for patient records',
      ],
      [
        ['submit_lab_order', 'Submit lab order', 'Submit lab orders to the external vendor.'],
        ['receive_lab_result', 'Receive lab result', 'Import lab results from vendor callbacks.'],
        ['hie_patient_query', 'HIE patient query', 'Query HIE for patient clinical summaries.'],
      ],
    ],
    [
      'payments',
      'Payments',
      ['PAYMENTS_API_KEY'],
      true,
      ['Patient payment collection', 'Refund processing', 'Payment reconciliation'],
      'Configure a PCI-compliant payment processor and set PAYMENTS_API_KEY.',
      ['Process a sandbox payment', 'Process a sandbox refund', 'Reconcile payment report'],
      [
        ['process_payment', 'Process payment', 'Charge a patient payment method.'],
        ['process_refund', 'Process refund', 'Refund a previous payment.'],
        ['reconcile_report', 'Reconcile report', 'Import and reconcile payment reports.'],
      ],
    ],
    [
      'erx',
      'eRx',
      ['ERX_API_BASE_URL'],
      false,
      ['New prescription transmission', 'Refill processing', 'Medication history query'],
      'Configure a certified eRx adapter and set ERX_API_BASE_URL.',
      ['Send a sandbox prescription', 'Process a refill request', 'Query medication history'],
      [
        ['send_prescription', 'Send prescription', 'Transmit new prescriptions to the pharmacy.'],
        ['process_refill', 'Process refill', 'Handle refill requests from the pharmacy.'],
        ['medication_history', 'Medication history', 'Query patient medication history.'],
      ],
    ],
    [
      'identity',
      'Identity / MFA',
      ['IDENTITY_PROVIDER_ISSUER_URL'],
      false,
      ['Single sign-on', 'Multi-factor authentication', 'Access review automation'],
      'Configure an identity provider and set IDENTITY_PROVIDER_ISSUER_URL.',
      ['Authenticate via SSO sandbox', 'Verify MFA challenge flow', 'Run access review automation'],
      [
        [
          'sso_authentication',
          'SSO authentication',
          'Authenticate users through the identity provider.',
        ],
        ['mfa_challenge', 'MFA challenge', 'Verify multi-factor authentication flows.'],
        ['access_review', 'Access review', 'Automate periodic access reviews.'],
      ],
    ],
  ] as const;
  return specs.map(
    ([key, label, fields, secret, workflows, action, sandboxTests, adapterMethods]) => {
      const draft = integrationDrafts[key] ?? {};
      const configured = fields.every((field) => Boolean(draft[field]));
      const missingProfileFields = VENDOR_PROFILE_REQUIRED.filter((field) => !draft[field]).map(
        (field) => VENDOR_PROFILE_FIELDS[field]
      );
      const missingCutoverFields = CUTOVER_EVIDENCE_REQUIRED.filter((field) => !draft[field]).map(
        (field) => CUTOVER_EVIDENCE_FIELDS[field]
      );
      const liveRehearsalApproved = truthyDemoValue(draft.LIVE_REHEARSAL_APPROVED);
      const cutoverMissingFields = liveRehearsalApproved
        ? missingCutoverFields
        : Array.from(new Set([...missingCutoverFields, 'live_rehearsal_approved'])).sort();
      const riskTitle = draft.RISK_TITLE?.trim() ?? '';
      const riskSeverity = normalizeRiskSeverity(draft.RISK_SEVERITY);
      const riskStatus = draft.RISK_MITIGATION_STATUS?.trim().toLowerCase() || 'open';
      const risk = riskTitle
        ? {
            key: 'primary',
            title: riskTitle,
            severity: riskSeverity,
            mitigation_owner: draft.RISK_MITIGATION_OWNER?.trim() ?? '',
            mitigation_status: riskStatus,
            blocks_live_rehearsal: truthyDemoValue(draft.RISK_BLOCKS_REHEARSAL),
            resolved: MITIGATED_RISK_STATUSES.includes(riskStatus),
          }
        : null;
      const risks = risk ? [risk] : [];
      const riskBlockingCount = risks.filter(
        (item) => item.blocks_live_rehearsal && !item.resolved
      ).length;
      const lastTest = integrationLastTests[key] ?? {};
      const adapterImplemented = key === 'copilotkit';
      const adapterDetail = adapterImplemented
        ? 'CopilotKit runtime URL is configured and reachable by the API.'
        : `Configure a vendor-specific ${label.toLowerCase()} adapter before live use.`;
      const methods = adapterMethods.map(([methodKey, methodLabel, description]) => ({
        key: methodKey,
        label: methodLabel,
        description,
        required: true,
        status: adapterImplemented ? ('ready' as const) : ('blocked' as const),
      }));
      return {
        key,
        label,
        configured,
        healthy: false,
        adapter_implemented: adapterImplemented,
        adapter_detail: adapterDetail,
        adapter_methods: methods,
        adapter_method_ready_count: methods.filter((method) => method.status === 'ready').length,
        adapter_method_total: methods.length,
        readiness_mode: 'production_vendor' as const,
        sandbox_ready: false,
        production_ready: false,
        mode: configured ? 'setup_draft' : 'demo',
        status: configured ? 'draft' : 'missing',
        fields: fields.map((field) => ({
          key: field,
          label: field.replaceAll('_', ' '),
          required: true,
          secret: secret || field.includes('KEY'),
          configured: Boolean(draft[field]),
          source: draft[field] ? 'setup_draft' : 'missing',
          value_preview: draft[field]
            ? field.includes('KEY')
              ? `****${draft[field].slice(-4)}`
              : draft[field]
            : null,
        })),
        vendor_profile: {
          vendor_name: draft.VENDOR_NAME ?? '',
          environment: draft.VENDOR_ENVIRONMENT ?? '',
          owner_name: draft.OWNER_NAME ?? '',
          owner_email: draft.OWNER_EMAIL ?? '',
          support_contact: draft.SUPPORT_CONTACT ?? '',
          escalation_notes: draft.ESCALATION_NOTES ?? '',
          contract_reference_url: draft.CONTRACT_REFERENCE_URL ?? '',
          profile_complete: missingProfileFields.length === 0,
          missing_fields: missingProfileFields,
        },
        cutover_evidence: {
          planned_cutover_at: draft.CUTOVER_PLANNED_AT ?? '',
          last_vendor_test_at: draft.LAST_VENDOR_TEST_AT ?? '',
          rollback_owner: draft.ROLLBACK_OWNER ?? '',
          go_no_go_notes: draft.GO_NO_GO_NOTES ?? '',
          live_rehearsal_approved: liveRehearsalApproved,
          evidence_complete: cutoverMissingFields.length === 0,
          missing_fields: cutoverMissingFields,
        },
        risk_register: {
          risks,
          risk_count: risks.length,
          blocking_count: riskBlockingCount,
        },
        workflows: [...workflows],
        action,
        sandbox_tests: [...sandboxTests],
        docs: ['docs/integrations/vendor-adapter-plan.md'],
        last_tested_at: lastTest.last_tested_at ?? null,
        last_test_status: lastTest.last_test_status ?? null,
      };
    }
  );
}

function demoCredentialPreflight(): CredentialPreflight {
  const data: CredentialPreflightItem[] = demoIntegrationConfigs().map(
    (config): CredentialPreflightItem => {
      const missingFields = config.fields
        .filter((field) => field.required && !field.configured)
        .map((field) => field.key);
      const evidenceByTest = integrationSandboxEvidence[config.key] ?? {};
      const sandboxEvidence = config.sandbox_tests.map(
        (testLabel) =>
          evidenceByTest[demoSandboxTestKey(testLabel)] ?? {
            id: null,
            integration: config.key,
            test_key: demoSandboxTestKey(testLabel),
            test_label: testLabel,
            status: 'missing',
            notes: '',
            reference_url: null,
            recorded_by: null,
            recorded_at: null,
          }
      );
      const passedEvidenceCount = sandboxEvidence.filter((item) => item.status === 'passed').length;
      const failedEvidence = sandboxEvidence.filter((item) => item.status === 'failed');
      const sandboxComplete =
        sandboxEvidence.length > 0 && passedEvidenceCount === sandboxEvidence.length;
      const vendorReferenceComplete =
        sandboxComplete && sandboxEvidence.every((item) => isVendorReference(item.reference_url));
      const sandboxReady = config.sandbox_ready && sandboxComplete;
      const productionReady = config.production_ready && sandboxComplete && vendorReferenceComplete;
      const status = productionReady
        ? 'ready'
        : missingFields.length
          ? 'missing'
          : !config.adapter_implemented ||
              failedEvidence.length ||
              config.last_test_status === 'failed'
            ? 'blocked'
            : 'staged';
      const blockers = missingFields.length
        ? [`Missing required values: ${missingFields.join(', ')}`]
        : !config.adapter_implemented
          ? [config.adapter_detail]
          : failedEvidence.length
            ? [
                `Failed sandbox workflow evidence requires vendor review: ${failedEvidence.map((item) => item.test_label).join(', ')}.`,
              ]
            : status === 'blocked'
              ? ['Latest connection test failed; vendor adapter or credentials need review.']
              : status === 'staged' && sandboxReady
                ? [
                    'Local sandbox workflows passed; production vendor credentials, adapter, and vendor sandbox references are still required before live use.',
                  ]
                : status === 'staged' &&
                    config.readiness_mode === 'production_vendor' &&
                    sandboxComplete &&
                    !vendorReferenceComplete
                  ? [
                      'Vendor sandbox reference URLs are required for every passed workflow before production readiness.',
                    ]
                  : status === 'staged'
                    ? ['Credentials are staged, but sandbox evidence is still pending.']
                    : [];
      if (!config.vendor_profile.profile_complete) {
        blockers.push(
          `Vendor profile is incomplete: ${config.vendor_profile.missing_fields.join(', ')}`
        );
      }
      if (!config.cutover_evidence.evidence_complete) {
        blockers.push(
          `Cutover rehearsal evidence is incomplete: ${config.cutover_evidence.missing_fields.join(', ')}`
        );
      }
      if (config.risk_register.blocking_count) {
        blockers.push(
          `${config.risk_register.blocking_count} unresolved vendor risk(s) block live-use rehearsal.`
        );
      }
      return {
        key: config.key,
        label: config.label,
        status,
        configured: config.configured,
        healthy: config.healthy,
        adapter_implemented: config.adapter_implemented,
        adapter_detail: config.adapter_detail,
        adapter_methods: config.adapter_methods,
        adapter_method_ready_count: config.adapter_method_ready_count,
        adapter_method_total: config.adapter_method_total,
        readiness_mode: config.readiness_mode,
        sandbox_ready: sandboxReady,
        production_ready: productionReady,
        mode: config.mode,
        vendor_profile: config.vendor_profile,
        cutover_evidence: config.cutover_evidence,
        risk_register: config.risk_register,
        missing_fields: missingFields,
        configured_fields: config.fields
          .filter((field) => field.configured)
          .map((field) => field.key),
        workflows: config.workflows,
        sandbox_tests: config.sandbox_tests,
        sandbox_evidence: sandboxEvidence,
        blockers,
        steps: [
          {
            key: 'credentials',
            label: 'Credentials captured',
            status: missingFields.length ? 'missing' : 'ready',
            detail: missingFields.length
              ? `Missing ${missingFields.join(', ')}.`
              : 'All required credential fields are present.',
          },
          {
            key: 'adapter',
            label: 'Vendor adapter implementation',
            status: config.adapter_implemented
              ? 'ready'
              : missingFields.length
                ? 'pending'
                : 'blocked',
            detail: config.adapter_implemented
              ? `Vendor adapter is implemented for live-use testing; ${config.adapter_method_ready_count} of ${config.adapter_method_total} required methods ready.`
              : missingFields.length
                ? 'Capture required credentials before validating the vendor adapter.'
                : `${config.adapter_detail} ${config.adapter_method_ready_count} of ${config.adapter_method_total} required methods ready.`,
          },
          {
            key: 'connection_test',
            label: 'Connection test',
            status: config.healthy
              ? 'ready'
              : config.last_test_status === 'failed'
                ? 'blocked'
                : 'pending',
            detail: config.healthy
              ? 'Latest connection test succeeded.'
              : config.last_test_status === 'failed'
                ? 'Latest connection test failed.'
                : 'Run a connection test after credentials are staged.',
          },
          {
            key: 'vendor_profile',
            label: 'Vendor owner and escalation profile',
            status: config.vendor_profile.profile_complete ? 'ready' : 'pending',
            detail: config.vendor_profile.profile_complete
              ? `${config.vendor_profile.vendor_name} ${config.vendor_profile.environment} owned by ${config.vendor_profile.owner_name}.`
              : 'Capture vendor name, environment, owner, owner email, and support contact before live-use rehearsal.',
          },
          {
            key: 'cutover_evidence',
            label: 'Cutover rehearsal evidence',
            status: config.cutover_evidence.evidence_complete ? 'ready' : 'pending',
            detail: config.cutover_evidence.evidence_complete
              ? `Cutover planned for ${config.cutover_evidence.planned_cutover_at}; rollback owner ${config.cutover_evidence.rollback_owner}.`
              : 'Capture planned cutover date, last vendor test date, rollback owner, go/no-go notes, and live-use rehearsal approval.',
          },
          {
            key: 'vendor_risks',
            label: 'Vendor risk register',
            status: config.risk_register.blocking_count ? 'blocked' : 'ready',
            detail: config.risk_register.blocking_count
              ? `${config.risk_register.blocking_count} unresolved blocking risk(s); ${config.risk_register.risk_count} total risk(s).`
              : `${config.risk_register.risk_count} vendor risk(s) tracked with no blocking unresolved risks.`,
          },
          {
            key: 'sandbox_workflows',
            label: 'Sandbox workflow evidence',
            status:
              sandboxComplete && vendorReferenceComplete
                ? 'ready'
                : failedEvidence.length
                  ? 'blocked'
                  : 'pending',
            detail:
              sandboxComplete && vendorReferenceComplete
                ? 'All vendor sandbox workflow checks have passing evidence with vendor reference URLs.'
                : sandboxComplete
                  ? 'Passing vendor sandbox evidence needs reference URLs for every workflow before production readiness.'
                  : failedEvidence.length
                    ? `${failedEvidence.length} sandbox workflow check(s) failed and need vendor review.`
                    : `${passedEvidenceCount} of ${sandboxEvidence.length} sandbox checks have passing evidence with notes or reference.`,
          },
        ],
        docs: config.docs,
        last_tested_at: config.last_tested_at,
        last_test_status: config.last_test_status,
      };
    }
  );
  return {
    generated_at: new Date().toISOString(),
    ready_count: data.filter((item) => item.status === 'ready').length,
    staged_count: data.filter((item) => item.status === 'staged').length,
    blocking_count: data.filter((item) => ['missing', 'blocked'].includes(item.status)).length,
    total: data.length,
    data,
  };
}

function demoSandboxTestKey(testLabel: string) {
  return (
    testLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'sandbox_check'
  );
}

function isVendorReference(referenceUrl: string | null | undefined) {
  const normalized = referenceUrl?.trim() ?? '';
  return Boolean(normalized) && !normalized.toLowerCase().startsWith('sandbox://');
}

function truthyDemoValue(value: string | undefined) {
  return ['true', 'yes', 'approved', '1'].includes((value ?? '').trim().toLowerCase());
}

function normalizeRiskSeverity(value: string | undefined): 'critical' | 'warning' | 'normal' {
  const severity = value?.trim().toLowerCase();
  return severity === 'critical' || severity === 'normal' ? severity : 'warning';
}

function demoFileName(fileUrl: string) {
  return fileUrl.replace(/\/+$/, '').split('/').pop() || 'document';
}

function demoSourcePreview(fileUrl: string) {
  if (fileUrl.startsWith('s3://')) {
    const withoutScheme = fileUrl.replace('s3://', '');
    const [bucket] = withoutScheme.split('/');
    return `s3://${bucket}/.../${demoFileName(fileUrl)}`;
  }
  return fileUrl.length > 80 ? `${fileUrl.slice(0, 42)}...${fileUrl.slice(-24)}` : fileUrl;
}

const storedDemoData = readStoredDemoData();
if (storedDemoData) {
  patients = storedDemoData.patients.map(normalizePatient);
  tasks = storedDemoData.tasks.map((task) => ({
    ...task,
    source_type: task.source_type ?? null,
    source_id: task.source_id ?? null,
    delivery_channel: task.delivery_channel ?? null,
    delivery_status: task.delivery_status ?? null,
    delivery_recipient: task.delivery_recipient ?? null,
    delivery_provider_message_id: task.delivery_provider_message_id ?? null,
    delivery_error: task.delivery_error ?? null,
    delivery_attempts: task.delivery_attempts ?? 0,
    delivered_at: task.delivered_at ?? null,
  }));
  appointments = storedDemoData.appointments;
  faxes = storedDemoData.faxes;
  patientDocuments = (storedDemoData.patientDocuments ?? patientDocuments).map(normalizeDocument);
  patientMedications = storedDemoData.patientMedications ?? patientMedications;
  patientCarePlan = storedDemoData.patientCarePlan ?? patientCarePlan;
  patientLabs = storedDemoData.patientLabs ?? patientLabs;
  patientEncounters = storedDemoData.patientEncounters ?? patientEncounters;
  messages = storedDemoData.messages;
  auditEvents = storedDemoData.auditEvents ?? auditEvents;
  integrationEvents = storedDemoData.integrationEvents ?? integrationEvents;
  providerAvailability = storedDemoData.providerAvailability ?? providerAvailability;
  clinicSettings = storedDemoData.clinicSettings ?? clinicSettings;
  billingCases = (storedDemoData.billingCases ?? billingCases).map(normalizeBillingCase);
  portalIntake = storedDemoData.portalIntake ?? portalIntake;
  demoUsers = demoUsers.map(normalizeDemoUser);
  integrationDrafts = storedDemoData.integrationDrafts ?? integrationDrafts;
  integrationLastTests = storedDemoData.integrationLastTests ?? integrationLastTests;
  integrationSandboxEvidence =
    storedDemoData.integrationSandboxEvidence ?? integrationSandboxEvidence;
  integrationHandoffArchives =
    storedDemoData.integrationHandoffArchives ?? integrationHandoffArchives;
  rehearsalAssignments = storedDemoData.rehearsalAssignments ?? rehearsalAssignments;
  integrationCutoverAssignments =
    storedDemoData.integrationCutoverAssignments ?? integrationCutoverAssignments;
  goLiveAttestations = storedDemoData.goLiveAttestations ?? goLiveAttestations;
  roleDryRunSessions = storedDemoData.roleDryRunSessions ?? roleDryRunSessions;
  browserQaSessions = storedDemoData.browserQaSessions ?? browserQaSessions;
  staffTrainingSessions = storedDemoData.staffTrainingSessions ?? staffTrainingSessions;
  policyApprovalSessions = storedDemoData.policyApprovalSessions ?? policyApprovalSessions;
  restoreDrillSessions = storedDemoData.restoreDrillSessions ?? restoreDrillSessions;
  cutoverRunbookSessions = storedDemoData.cutoverRunbookSessions ?? cutoverRunbookSessions;
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function threads(): MessageThread[] {
  const grouped = new Map<string, Message[]>();
  for (const message of messages) {
    const threadId = message.thread_id ?? message.id;
    grouped.set(threadId, [...(grouped.get(threadId) ?? []), message]);
  }

  return [...grouped.entries()]
    .map(([id, items]) => {
      const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const lastMessage = sorted[sorted.length - 1];
      const participants = new Map<string, string>();
      for (const item of sorted) {
        participants.set(item.sender_id, item.sender_name);
        participants.set(item.recipient_id, item.recipient_name);
      }
      return {
        id,
        subject: lastMessage.subject,
        participants: [...participants.entries()].map(([participantId, name]) => ({
          id: participantId,
          name,
        })),
        last_message: lastMessage,
        unread_count: sorted.filter((item) => !item.is_read).length,
      };
    })
    .sort((a, b) => b.last_message.created_at.localeCompare(a.last_message.created_at));
}

function logDemoEvent(
  event: Omit<AuditEvent, 'id' | 'actor_id' | 'created_at'> & { actor_id?: string | null }
) {
  auditEvents = [
    {
      id: uuid(1000 + auditEvents.length),
      actor_id: event.actor_id ?? uuid(1),
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      payload: event.payload,
      created_at: new Date().toISOString(),
    },
    ...auditEvents,
  ].slice(0, 100);
}

export async function demoRequest<T>(
  method: string,
  rawPath: string,
  body?: unknown
): Promise<T | undefined> {
  const url = new URL(rawPath, 'http://demo.local');
  const path = url.pathname.replace(/^\/api/, '');
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('page_size') ?? '20');

  if (method === 'GET' && path === '/health') return { status: 'ok', version: 'demo' } as T;
  if (method === 'GET' && path === '/ready') {
    return {
      status: 'ok',
      operational_status: 'degraded',
      environment: 'demo',
      checks: {
        database: { ok: true },
        redis: { ok: true },
        object_storage: { ok: true, bucket: 'concierge-os' },
      },
      integrations: {
        ehr: { ok: false, configured: false, env_var: 'EHR_API_BASE_URL', mode: 'demo' },
        fax_provider: {
          ok: false,
          configured: false,
          env_var: 'FAX_PROVIDER_API_KEY',
          mode: 'demo',
        },
        portal: { ok: false, configured: false, env_var: 'PORTAL_API_BASE_URL', mode: 'demo' },
        calendar: { ok: false, configured: false, env_var: 'CALENDAR_API_BASE_URL', mode: 'demo' },
        copilotkit: {
          ok: false,
          configured: false,
          env_var: 'COPILOTKIT_RUNTIME_URL',
          mode: 'demo',
        },
        communications: {
          ok: false,
          configured: false,
          env_var: 'COMMUNICATIONS_PROVIDER_API_KEY',
          mode: 'demo',
        },
        clearinghouse: {
          ok: false,
          configured: false,
          env_var: 'CLEARINGHOUSE_API_KEY',
          mode: 'demo',
        },
      },
      deployment: {
        production_env_template: { ok: true, path: '.env.production.example' },
        deployment_runbook: { ok: true, path: 'docs/operations/deployment-runbook.md' },
        health_report_script: { ok: true, path: 'scripts/health-report.sh' },
        local_backup_script: { ok: true, path: 'scripts/backup-local.sh' },
        latest_backup: {
          ok: false,
          path: 'backups',
          last_success_at: null,
          error: 'No backup manifest found',
        },
        latest_restore: {
          ok: false,
          path: 'backups/latest-restore.txt',
          last_success_at: null,
          error: 'No restore marker found',
        },
      },
    } as T;
  }

  if (path === '/analytics/summary' && method === 'GET') {
    return {
      schedule: {
        scheduled: appointments.filter((item) => item.status === 'scheduled').length,
        active: appointments.filter((item) =>
          ['checked_in', 'roomed', 'provider_review', 'checkout'].includes(item.status)
        ).length,
        no_show: appointments.filter((item) => item.status === 'no_show').length,
      },
      work: {
        open_tasks: tasks.filter((item) => ACTIVE_TASK_STATUSES.includes(item.status)).length,
        documents_needing_review: patientDocuments.filter((item) => item.status === 'needs_review')
          .length,
        unsigned_encounters: patientEncounters.filter((item) =>
          ['draft', 'provider_review'].includes(item.status)
        ).length,
      },
      front_office: {
        unmatched_faxes: faxes.filter((item) => !item.patient_id).length,
        intake_needing_review: portalIntake.filter((item) =>
          ['received', 'needs_review'].includes(item.status)
        ).length,
      },
      billing: {
        draft_cases: billingCases.filter((item) => item.status === 'draft').length,
        denied_cases: billingCases.filter((item) => item.status === 'denied').length,
      },
    } as T;
  }
  if (path === '/analytics/daily-closeout' && method === 'GET') {
    return dailyCloseout() as T;
  }
  if (path === '/analytics/pilot-readiness' && method === 'GET') {
    const demo_items = [
      {
        key: 'patients',
        label: 'Patient chart demo data',
        ready: patients.length > 0,
        detail: `${patients.length} patients`,
      },
      {
        key: 'users',
        label: 'Role-based staff demo data',
        ready: demoUsers.length >= 4,
        detail: `${demoUsers.length} users`,
      },
      {
        key: 'schedule',
        label: 'Scheduling workflow data',
        ready: appointments.length > 0,
        detail: `${appointments.length} appointments`,
      },
      {
        key: 'documents',
        label: 'Document workflow data',
        ready: patientDocuments.length > 0,
        detail: `${patientDocuments.length} documents`,
      },
      {
        key: 'front_office',
        label: 'Fax/intake front-office workflows',
        ready: faxes.length > 0 && portalIntake.length >= 0,
        detail: `${faxes.length} faxes, ${portalIntake.length} intake submissions`,
      },
      {
        key: 'billing',
        label: 'Billing workflow data',
        ready: true,
        detail: `${billingCases.length} billing cases plus charge capture`,
      },
      {
        key: 'integrations',
        label: 'Integration event trail',
        ready: integrationEvents.length > 0,
        detail: `${integrationEvents.length} integration events`,
      },
    ];
    const pilot_items = [
      { key: 'core', label: 'Core API dependencies', ready: true, detail: 'ok' },
      {
        key: 'deployment_assets',
        label: 'Deployment and backup assets',
        ready: true,
        detail: 'templates/scripts present',
      },
      {
        key: 'roles',
        label: 'Minimum clinic roles',
        ready: demoUsers.length >= 4,
        detail: `${demoUsers.length} users`,
      },
      {
        key: 'audit',
        label: 'Audit-visible workflows',
        ready: auditEvents.length > 0,
        detail: `${auditEvents.length} audit events`,
      },
      {
        key: 'operational_queues',
        label: 'Operational queues seeded',
        ready: tasks.length > 0 && appointments.length > 0,
        detail: `${tasks.length} tasks, ${appointments.length} appointments`,
      },
    ];
    return {
      product_demo_score: 100,
      internal_pilot_score: 100,
      product_demo_ready: true,
      internal_pilot_ready: true,
      demo_items,
      pilot_items,
      generated_at: new Date().toISOString(),
    } as T;
  }
  if (path === '/analytics/pilot-readiness/seed' && method === 'POST') {
    return { created: [], created_count: 0 } as T;
  }

  if (path === '/operations/incidents' && method === 'GET') {
    return operationsIncidents() as T;
  }
  if (path === '/operations/incident-timeline' && method === 'GET') {
    return incidentTimeline() as T;
  }
  if (path === '/operations/alert-rules' && method === 'GET') {
    return alertRules() as T;
  }
  if (path === '/operations/document-storage-readiness' && method === 'GET') {
    return documentStorageReadiness() as T;
  }
  if (path === '/operations/operator-health' && method === 'GET') {
    return operatorHealth() as T;
  }
  if (path === '/operations/production-config-audit' && method === 'GET') {
    return productionConfigAudit() as T;
  }
  if (path === '/operations/browser-qa-checklist' && method === 'GET') {
    return browserQaChecklist() as T;
  }
  if (path === '/operations/browser-qa-sessions' && method === 'POST') {
    return createBrowserQaSession((body ?? {}) as BrowserQaSessionStart) as T;
  }
  if (path === '/operations/browser-qa-sessions' && method === 'GET') {
    return {
      data: browserQaSessions,
      total: browserQaSessions.length,
    } satisfies BrowserQaSessionList as T;
  }
  const browserQaSessionMatch = path.match(/^\/operations\/browser-qa-sessions\/([^/]+)$/);
  if (browserQaSessionMatch && method === 'PATCH') {
    const session = updateBrowserQaSession(
      decodeURIComponent(browserQaSessionMatch[1]),
      (body ?? {}) as BrowserQaSessionUpdate
    );
    if (!session) {
      throw new Error('Browser QA session not found');
    }
    return session as T;
  }
  if (path === '/operations/staff-training-checklist' && method === 'GET') {
    return staffTrainingChecklist() as T;
  }
  if (path === '/operations/staff-training-sessions' && method === 'POST') {
    return createStaffTrainingSession((body ?? {}) as StaffTrainingSessionStart) as T;
  }
  if (path === '/operations/staff-training-sessions' && method === 'GET') {
    return {
      data: staffTrainingSessions,
      total: staffTrainingSessions.length,
    } satisfies StaffTrainingSessionList as T;
  }
  const staffTrainingSessionMatch = path.match(/^\/operations\/staff-training-sessions\/([^/]+)$/);
  if (staffTrainingSessionMatch && method === 'PATCH') {
    const session = updateStaffTrainingSession(
      decodeURIComponent(staffTrainingSessionMatch[1]),
      (body ?? {}) as StaffTrainingSessionUpdate
    );
    if (!session) {
      throw new Error('Staff training session not found');
    }
    return session as T;
  }
  if (path === '/operations/policy-approval-checklist' && method === 'GET') {
    return policyApprovalChecklist() as T;
  }
  if (path === '/operations/policy-approval-sessions' && method === 'POST') {
    return createPolicyApprovalSession((body ?? {}) as PolicyApprovalSessionStart) as T;
  }
  if (path === '/operations/policy-approval-sessions' && method === 'GET') {
    return {
      data: policyApprovalSessions,
      total: policyApprovalSessions.length,
    } satisfies PolicyApprovalSessionList as T;
  }
  const policyApprovalSessionMatch = path.match(
    /^\/operations\/policy-approval-sessions\/([^/]+)$/
  );
  if (policyApprovalSessionMatch && method === 'PATCH') {
    const session = updatePolicyApprovalSession(
      decodeURIComponent(policyApprovalSessionMatch[1]),
      (body ?? {}) as PolicyApprovalSessionUpdate
    );
    if (!session) {
      throw new Error('Policy approval session not found');
    }
    return session as T;
  }
  if (path === '/operations/restore-drill-checklist' && method === 'GET') {
    return restoreDrillChecklist() as T;
  }
  if (path === '/operations/restore-drill-sessions' && method === 'POST') {
    return createRestoreDrillSession((body ?? {}) as RestoreDrillSessionStart) as T;
  }
  if (path === '/operations/restore-drill-sessions' && method === 'GET') {
    return {
      data: restoreDrillSessions,
      total: restoreDrillSessions.length,
    } satisfies RestoreDrillSessionList as T;
  }
  const restoreDrillExportMatch = path.match(
    /^\/operations\/restore-drill-sessions\/([^/]+)\/export$/
  );
  if (restoreDrillExportMatch && method === 'GET') {
    const session = restoreDrillSessions.find(
      (item) => item.session_id === decodeURIComponent(restoreDrillExportMatch[1])
    );
    if (!session) {
      throw new Error('Restore drill session not found');
    }
    return restoreDrillCsv(session) as T;
  }
  const restoreDrillSessionMatch = path.match(/^\/operations\/restore-drill-sessions\/([^/]+)$/);
  if (restoreDrillSessionMatch && method === 'PATCH') {
    const session = updateRestoreDrillSession(
      decodeURIComponent(restoreDrillSessionMatch[1]),
      (body ?? {}) as RestoreDrillSessionUpdate
    );
    if (!session) {
      throw new Error('Restore drill session not found');
    }
    return session as T;
  }
  if (path === '/operations/cutover-runbook' && method === 'GET') {
    return cutoverRunbook() as T;
  }
  if (path === '/operations/cutover-runbook-sessions' && method === 'POST') {
    return createCutoverRunbookSession((body ?? {}) as CutoverRunbookSessionStart) as T;
  }
  if (path === '/operations/cutover-runbook-sessions' && method === 'GET') {
    return {
      data: cutoverRunbookSessions,
      total: cutoverRunbookSessions.length,
    } satisfies CutoverRunbookSessionList as T;
  }
  const cutoverRunbookExportMatch = path.match(
    /^\/operations\/cutover-runbook-sessions\/([^/]+)\/export$/
  );
  if (cutoverRunbookExportMatch && method === 'GET') {
    const session = cutoverRunbookSessions.find(
      (item) => item.session_id === decodeURIComponent(cutoverRunbookExportMatch[1])
    );
    if (!session) {
      throw new Error('Cutover runbook session not found');
    }
    return cutoverRunbookCsv(session) as T;
  }
  const cutoverRunbookSessionMatch = path.match(
    /^\/operations\/cutover-runbook-sessions\/([^/]+)$/
  );
  if (cutoverRunbookSessionMatch && method === 'PATCH') {
    const session = updateCutoverRunbookSession(
      decodeURIComponent(cutoverRunbookSessionMatch[1]),
      (body ?? {}) as CutoverRunbookSessionUpdate
    );
    if (!session) {
      throw new Error('Cutover runbook session not found');
    }
    return session as T;
  }
  if (path === '/operations/go-live-packet' && method === 'GET') {
    return goLivePacket() as T;
  }
  if (path === '/operations/credential-dry-run-binder' && method === 'GET') {
    return credentialDryRunBinder() as T;
  }
  if (path === '/operations/credential-dry-run-binder/export' && method === 'GET') {
    return credentialDryRunBinderCsv(credentialDryRunBinder()) as T;
  }
  if (path === '/operations/vendor-credential-request-packet' && method === 'GET') {
    return vendorCredentialRequestPacket() as T;
  }
  if (path === '/operations/vendor-credential-request-packet/export' && method === 'GET') {
    return vendorCredentialRequestPacketCsv(vendorCredentialRequestPacket()) as T;
  }
  if (path === '/operations/adapter-implementation-packet' && method === 'GET') {
    return adapterImplementationPacket() as T;
  }
  if (path === '/operations/adapter-implementation-packet/export' && method === 'GET') {
    return adapterImplementationPacketCsv(adapterImplementationPacket()) as T;
  }
  if (path === '/operations/integration-cutover-readiness-packet' && method === 'GET') {
    return integrationCutoverReadinessPacket() as T;
  }
  if (path === '/operations/integration-cutover-readiness-packet/export' && method === 'GET') {
    return integrationCutoverReadinessPacketCsv(integrationCutoverReadinessPacket()) as T;
  }
  const cutoverAssignmentMatch = path.match(
    /^\/operations\/integration-cutover-readiness-packet\/([^/]+)\/assignment$/
  );
  if (cutoverAssignmentMatch && method === 'POST') {
    const assignment = assignIntegrationCutoverLane(
      decodeURIComponent(cutoverAssignmentMatch[1]),
      (body ?? {}) as RehearsalActionAssignmentUpdate
    );
    if (!assignment) {
      throw new Error('Integration cutover lane not found');
    }
    return assignment as T;
  }
  if (path === '/operations/credential-dry-run-binder/snapshots' && method === 'POST') {
    const binder = credentialDryRunBinder();
    logDemoEvent({
      event_type: 'operations.credential_binder_snapshot',
      entity_type: 'operations',
      entity_id: uuid(903),
      payload: binder as unknown as Record<string, unknown>,
    });
    saveDemoData();
    return credentialBinderSnapshotFromEvent(auditEvents[0]) as T;
  }
  if (path === '/operations/credential-dry-run-binder/snapshots' && method === 'GET') {
    const data = auditEvents
      .filter((event) => event.event_type === 'operations.credential_binder_snapshot')
      .map(credentialBinderSnapshotFromEvent);
    return { data, total: data.length } satisfies CredentialBinderSnapshotList as T;
  }
  if (path === '/operations/live-use-rehearsal' && method === 'GET') {
    return liveUseRehearsal() as T;
  }
  if (path === '/operations/live-use-rehearsal/export' && method === 'GET') {
    return liveUseRehearsalCsv(liveUseRehearsal()) as T;
  }
  if (path === '/operations/go-live-packet/attestations' && method === 'POST') {
    return createGoLiveAttestation((body ?? {}) as GoLiveAttestationCreate) as T;
  }
  if (path === '/operations/go-live-packet/attestations' && method === 'GET') {
    return {
      data: goLiveAttestations,
      total: goLiveAttestations.length,
    } satisfies GoLiveAttestationList as T;
  }
  if (path === '/operations/role-dry-run-checklists' && method === 'GET') {
    return roleDryRunChecklists() as T;
  }
  if (path === '/operations/role-dry-run-sessions' && method === 'POST') {
    return createRoleDryRunSession((body ?? {}) as RoleDryRunSessionStart) as T;
  }
  if (path === '/operations/role-dry-run-sessions' && method === 'GET') {
    return {
      data: roleDryRunSessions,
      total: roleDryRunSessions.length,
    } satisfies RoleDryRunSessionList as T;
  }
  const roleDryRunSessionMatch = path.match(/^\/operations\/role-dry-run-sessions\/([^/]+)$/);
  if (roleDryRunSessionMatch && method === 'PATCH') {
    const session = updateRoleDryRunSession(
      decodeURIComponent(roleDryRunSessionMatch[1]),
      (body ?? {}) as RoleDryRunSessionUpdate
    );
    if (!session) {
      throw new Error('Role dry-run session not found');
    }
    return session as T;
  }
  if (path === '/operations/launch-workplan' && method === 'GET') {
    return launchWorkplan() as T;
  }
  if (path === '/operations/launch-workplan/export' && method === 'GET') {
    return launchWorkplanCsv(launchWorkplan()) as T;
  }
  if (path === '/operations/launch-workplan/snapshots' && method === 'POST') {
    const workplan = launchWorkplan();
    logDemoEvent({
      event_type: 'operations.launch_workplan_snapshot',
      entity_type: 'operations',
      entity_id: uuid(902),
      payload: workplan as unknown as Record<string, unknown>,
    });
    saveDemoData();
    return launchWorkplanSnapshotFromEvent(auditEvents[0]) as T;
  }
  if (path === '/operations/launch-workplan/snapshots' && method === 'GET') {
    const data = auditEvents
      .filter((event) => event.event_type === 'operations.launch_workplan_snapshot')
      .map(launchWorkplanSnapshotFromEvent);
    return { data, total: data.length } satisfies LaunchWorkplanSnapshotList as T;
  }
  if (path === '/operations/production-rehearsal' && method === 'GET') {
    return productionRehearsalReport() as T;
  }
  if (path === '/operations/production-rehearsal/export' && method === 'GET') {
    return productionRehearsalCsv(productionRehearsalReport()) as T;
  }
  if (path === '/operations/scope-acceptance-packet' && method === 'GET') {
    return scopeAcceptancePacket() as T;
  }
  if (path === '/operations/scope-acceptance-packet/export' && method === 'GET') {
    const packet = scopeAcceptancePacket();
    const rows = [
      'Scope Acceptance Packet',
      `Generated at,${packet.generated_at}`,
      `Generated by,${packet.generated_by}`,
      `Status,${packet.status}`,
      `Gap count,${packet.gap_count}`,
      '',
      'Parity Matrix',
      'Feature,DrChrono,Concierge OS,Gaps,Owner',
      ...packet.parity_matrix.map(
        (item) =>
          `${item.feature},${item.drchrono},${item.concierge_os},${csvCell(item.gaps)},${item.owner ?? ''}`
      ),
      '',
      'Outage Reduction Targets',
      'Target,Goal,Fallback,Owner',
      ...packet.outage_reduction_targets.map(
        (item) => `${item.target},${item.goal},${item.fallback},${item.owner}`
      ),
      '',
      'Rollback Scorecard',
      'Item,Required,Pass',
      ...packet.rollback_scorecard.criteria.map(
        (item) => `${item.item},${item.required},${item.pass}`
      ),
    ];
    return (rows.join('\n') + '\n') as T;
  }
  if (path === '/operations/drchrono-migration-packet' && method === 'GET') {
    return drchronoMigrationPacket() as T;
  }
  if (path === '/operations/drchrono-migration-packet/dry-run' && method === 'POST') {
    return runDrchronoMigrationDryRun((body ?? {}) as DrChronoMigrationDryRunStart) as T;
  }
  if (path === '/operations/drchrono-migration-packet/import-batches' && method === 'POST') {
    return createDrchronoImportBatch((body ?? {}) as DrChronoImportBatchCreate) as T;
  }
  if (path === '/operations/drchrono-migration-packet/import-batches' && method === 'GET') {
    return listDrchronoImportBatches() as T;
  }
  if (path === '/operations/drchrono-migration-packet/export' && method === 'GET') {
    const packet = drchronoMigrationPacket();
    const rows = [
      'DrChrono Migration Packet',
      `Packet ID,${packet.packet_id}`,
      `Generated at,${packet.generated_at}`,
      `Generated by,${packet.generated_by}`,
      `Status,${packet.status}`,
      `Write import blocked,${packet.write_import_blocked}`,
      `Block reason,${csvCell(packet.write_import_block_reason)}`,
      '',
      'Dry Run Analysis',
      `Total rows analyzed,${packet.dry_run_analysis.total_rows_analyzed}`,
      `Create count,${packet.dry_run_analysis.create_count}`,
      `Update count,${packet.dry_run_analysis.update_count}`,
      `Skip count,${packet.dry_run_analysis.skip_count}`,
      `Duplicate count,${packet.dry_run_analysis.duplicate_count}`,
      `Missing dependency count,${packet.dry_run_analysis.missing_dependency_count}`,
      `Needs review count,${packet.dry_run_analysis.needs_review_count}`,
      `Sample chart reviewed,${packet.dry_run_analysis.sample_chart_reviewed}`,
      `Clinic sign off,${packet.dry_run_analysis.clinic_sign_off}`,
      '',
      'Import Batches',
      'Batch ID,Section,Mode,Create,Update,Skip,Error,Status',
      ...packet.import_batches.map(
        (batch) =>
          `${batch.batch_id},${batch.section},${batch.mode},${batch.create_count},${batch.update_count},${batch.skip_count},${batch.error_count},${batch.status}`
      ),
    ];
    return (rows.join('\n') + '\n') as T;
  }
  const rehearsalAssignmentMatch = path.match(
    /^\/operations\/production-rehearsal\/actions\/([^/]+)\/assignment$/
  );
  if (rehearsalAssignmentMatch && method === 'POST') {
    const assignment = assignProductionRehearsalAction(
      decodeURIComponent(rehearsalAssignmentMatch[1]),
      (body ?? {}) as RehearsalActionAssignmentUpdate
    );
    if (!assignment) {
      throw new Error('Rehearsal action is not currently open');
    }
    return assignment as T;
  }
  if (path === '/operations/production-rehearsal/snapshots' && method === 'POST') {
    const report = productionRehearsalReport();
    logDemoEvent({
      event_type: 'operations.production_rehearsal_snapshot',
      entity_type: 'operations',
      entity_id: uuid(901),
      payload: report as unknown as Record<string, unknown>,
    });
    saveDemoData();
    return productionRehearsalSnapshotFromEvent(auditEvents[0]) as T;
  }
  if (path === '/operations/production-rehearsal/snapshots' && method === 'GET') {
    const data = auditEvents
      .filter((event) => event.event_type === 'operations.production_rehearsal_snapshot')
      .map(productionRehearsalSnapshotFromEvent);
    return { data, total: data.length } satisfies ProductionRehearsalSnapshotList as T;
  }
  if (path === '/operations/readiness-snapshots' && method === 'POST') {
    const incidents = operationsIncidents();
    logDemoEvent({
      event_type: 'operations.readiness_snapshot',
      entity_type: 'operations',
      entity_id: uuid(900),
      payload: {
        operational_status: 'degraded',
        core_status: 'ok',
        launch_score: 35,
        incident_count: incidents.open_count,
        critical_count: incidents.critical_count,
        warning_count: incidents.warning_count,
      },
    });
    saveDemoData();
    const event = auditEvents[0];
    return readinessSnapshotFromEvent(event) as T;
  }
  if (path === '/operations/readiness-snapshots' && method === 'GET') {
    const data = auditEvents
      .filter((event) => event.event_type === 'operations.readiness_snapshot')
      .map(readinessSnapshotFromEvent);
    return { data, total: data.length } satisfies ReadinessSnapshotList as T;
  }

  if (path === '/integration-capabilities' && method === 'GET') {
    return {
      ehr: {
        label: 'EHR',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['EHR_API_BASE_URL'],
        supports: ['demographics', 'medications', 'labs', 'encounters', 'fhir_placeholder'],
        workflows: ['Chart sync', 'Medication reconciliation', 'Lab import'],
        action: 'Choose an EHR adapter and set EHR_API_BASE_URL.',
      },
      portal: {
        label: 'Patient portal',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['PORTAL_API_BASE_URL'],
        supports: ['messages', 'intake', 'appointment_requests', 'document_import'],
        workflows: ['Portal messages', 'Patient intake', 'Outside document routing'],
        action: 'Connect the external portal endpoint and map inbound webhook payloads.',
      },
      fax: {
        label: 'Fax provider',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['FAX_PROVIDER_API_KEY'],
        supports: ['inbound', 'outbound', 'document_matching'],
        workflows: ['Inbound fax matching', 'Outbound referrals', 'Document queue'],
        action: 'Set FAX_PROVIDER_API_KEY and verify inbound/outbound callback delivery.',
      },
      calendar: {
        label: 'Calendar',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['CALENDAR_API_BASE_URL'],
        supports: ['appointment_create', 'appointment_update', 'conflict_sync'],
        workflows: ['Schedule sync', 'Conflict checks', 'Reminder source of truth'],
        action: 'Set CALENDAR_API_BASE_URL and verify appointment create/update sync.',
      },
      communications: {
        label: 'Communications',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['COMMUNICATIONS_PROVIDER', 'COMMUNICATIONS_PROVIDER_API_KEY'],
        supports: ['sms', 'email', 'delivery_callbacks'],
        workflows: ['Patient outreach', 'Appointment reminders', 'Delivery tracking'],
        action: 'Select the delivery provider and configure callback secrets.',
      },
      copilotkit: {
        label: 'CopilotKit runtime',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['COPILOTKIT_RUNTIME_URL'],
        supports: ['assistant_runtime', 'tool_policy', 'confirmation_gates'],
        workflows: ['Clinical assistant', 'Tool execution', 'Review queue'],
        action: 'Deploy the runtime and approve model/tool policy before live use.',
      },
      clearinghouse: {
        label: 'Clearinghouse',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['CLEARINGHOUSE_API_BASE_URL', 'CLEARINGHOUSE_API_KEY'],
        supports: ['claim_submission', 'eligibility', 'denials', 'era_remittance'],
        workflows: ['Claim submission', 'Denial callbacks', 'ERA/remittance import'],
        action:
          'Connect clearinghouse credentials and validate claim, denial, and remittance workflows.',
      },
      labs_hie: {
        label: 'Labs / HIE',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['LABS_HIE_API_BASE_URL'],
        supports: ['lab_orders', 'lab_results', 'hie_query'],
        workflows: ['Lab order submission', 'Lab result import', 'HIE patient query'],
        action: 'Configure a vendor-specific labs/HIE adapter and set LABS_HIE_API_BASE_URL.',
      },
      payments: {
        label: 'Payments',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['PAYMENTS_API_KEY'],
        supports: ['card_processing', 'refunds', 'reporting'],
        workflows: ['Patient payment collection', 'Refund processing', 'Payment reconciliation'],
        action: 'Configure a PCI-compliant payment processor and set PAYMENTS_API_KEY.',
      },
      erx: {
        label: 'eRx',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['ERX_API_BASE_URL'],
        supports: ['prescription_send', 'refill_request', 'medication_history'],
        workflows: [
          'New prescription transmission',
          'Refill processing',
          'Medication history query',
        ],
        action: 'Configure a certified eRx adapter and set ERX_API_BASE_URL.',
      },
      identity: {
        label: 'Identity / MFA',
        configured: false,
        healthy: false,
        mode: 'demo',
        env_vars: ['IDENTITY_PROVIDER_ISSUER_URL'],
        supports: ['sso', 'mfa', 'access_review'],
        workflows: ['Single sign-on', 'Multi-factor authentication', 'Access review automation'],
        action: 'Configure an identity provider and set IDENTITY_PROVIDER_ISSUER_URL.',
      },
    } as T;
  }
  if (path === '/integrations/config' && method === 'GET') {
    return { data: demoIntegrationConfigs() } as T;
  }
  if (path === '/integrations/credential-preflight' && method === 'GET') {
    return demoCredentialPreflight() as T;
  }
  const handoffPacketMatch = path.match(/^\/integrations\/config\/([^/]+)\/handoff-packet$/);
  if (handoffPacketMatch && method === 'GET') {
    const integration = handoffPacketMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    const preflight = demoCredentialPreflight().data.find((item) => item.key === integration);
    if (!config || !preflight) throw new Error('Integration handoff packet not found');
    return {
      integration: config.key,
      label: config.label,
      generated_at: new Date().toISOString(),
      export_filename: `${config.key}-vendor-handoff-packet.json`,
      status: preflight.status,
      readiness_mode:
        preflight.readiness_mode === 'local_sandbox' ? 'local_sandbox' : 'production_vendor',
      production_ready: preflight.production_ready,
      sandbox_ready: preflight.sandbox_ready,
      mode: config.mode,
      configured_fields: preflight.configured_fields,
      missing_fields: preflight.missing_fields,
      vendor_profile: preflight.vendor_profile,
      cutover_evidence: preflight.cutover_evidence,
      risk_register: preflight.risk_register,
      adapter_methods: preflight.adapter_methods,
      adapter_method_ready_count: preflight.adapter_method_ready_count,
      adapter_method_total: preflight.adapter_method_total,
      sandbox_tests: preflight.sandbox_tests,
      sandbox_evidence: preflight.sandbox_evidence,
      preflight_steps: preflight.steps,
      blockers: preflight.blockers,
      docs: preflight.docs,
      latest_archive: integrationHandoffArchives[integration] ?? null,
      sections: [
        'Vendor profile',
        'Cutover evidence',
        'Vendor risks',
        'Adapter contract',
        'Sandbox evidence',
        'Preflight blockers',
      ],
    } as T;
  }
  const handoffArchiveMatch = path.match(
    /^\/integrations\/config\/([^/]+)\/handoff-packet\/archive$/
  );
  if (handoffArchiveMatch && method === 'POST') {
    const integration = handoffArchiveMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    const preflight = demoCredentialPreflight().data.find((item) => item.key === integration);
    if (!config || !preflight) throw new Error('Integration handoff packet not found');
    const incoming = body as { archive_note?: string; archive_reference_url?: string | null };
    const archive: HandoffPacketArchive = {
      id: uuid(4550 + Object.keys(integrationHandoffArchives).length),
      integration,
      label: config.label,
      export_filename: `${config.key}-vendor-handoff-packet.json`,
      packet_status: preflight.status,
      readiness_mode:
        preflight.readiness_mode === 'local_sandbox' ? 'local_sandbox' : 'production_vendor',
      production_ready: preflight.production_ready,
      sandbox_ready: preflight.sandbox_ready,
      archive_note: incoming.archive_note ?? '',
      archive_reference_url: incoming.archive_reference_url ?? null,
      archived_by: demoUsers[0]?.display_name ?? 'Demo Admin',
      archived_at: new Date().toISOString(),
    };
    integrationHandoffArchives = { ...integrationHandoffArchives, [integration]: archive };
    auditEvents.unshift({
      id: archive.id,
      actor_id: demoUsers[0]?.id ?? null,
      event_type: 'integration.handoff_packet_archived',
      entity_type: 'integration_config',
      entity_id: integration,
      payload: { ...archive },
      created_at: archive.archived_at ?? new Date().toISOString(),
    });
    saveDemoData();
    return archive as T;
  }
  const sandboxEvidenceMatch = path.match(/^\/integrations\/config\/([^/]+)\/sandbox-evidence$/);
  if (sandboxEvidenceMatch && method === 'POST') {
    const integration = sandboxEvidenceMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    const incoming = body as {
      test_label: string;
      status?: 'passed' | 'failed';
      notes?: string;
      reference_url?: string | null;
    };
    if (!config || !(config.sandbox_tests as readonly string[]).includes(incoming.test_label))
      throw new Error('Integration sandbox test not found');
    if (
      (incoming.status ?? 'passed') === 'passed' &&
      !incoming.notes?.trim() &&
      !incoming.reference_url?.trim()
    ) {
      throw new Error('Passed sandbox evidence requires notes or reference URL');
    }
    const evidence: SandboxEvidence = {
      id: uuid(
        3900 +
          Object.values(integrationSandboxEvidence).reduce(
            (total, items) => total + Object.keys(items).length,
            0
          )
      ),
      integration,
      test_key: demoSandboxTestKey(incoming.test_label),
      test_label: incoming.test_label,
      status: incoming.status ?? 'passed',
      notes: incoming.notes ?? '',
      reference_url: incoming.reference_url ?? null,
      recorded_by: 'Clinic Admin',
      recorded_at: new Date().toISOString(),
    };
    integrationSandboxEvidence = {
      ...integrationSandboxEvidence,
      [integration]: {
        ...(integrationSandboxEvidence[integration] ?? {}),
        [evidence.test_key]: evidence,
      },
    };
    logDemoEvent({
      event_type: 'integration.sandbox_evidence',
      entity_type: 'integration_config',
      entity_id: integration,
      payload: { ...evidence },
    });
    saveDemoData();
    return evidence as T;
  }
  const sandboxWorkflowRunMatch = path.match(
    /^\/integrations\/config\/([^/]+)\/sandbox-workflows\/run$/
  );
  if (sandboxWorkflowRunMatch && method === 'POST') {
    const integration = sandboxWorkflowRunMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    const incoming = body as { test_label: string };
    if (!config || !(config.sandbox_tests as readonly string[]).includes(incoming.test_label))
      throw new Error('Integration sandbox workflow not found');
    const evidence: SandboxEvidence = {
      id: uuid(
        4200 +
          Object.values(integrationSandboxEvidence).reduce(
            (total, items) => total + Object.keys(items).length,
            0
          )
      ),
      integration,
      test_key: demoSandboxTestKey(incoming.test_label),
      test_label: incoming.test_label,
      status: 'passed',
      notes: `Sandbox workflow passed: ${incoming.test_label} returned ok`,
      reference_url: `sandbox://${integration}/${demoSandboxTestKey(incoming.test_label)}`,
      recorded_by: 'Clinic Admin',
      recorded_at: new Date().toISOString(),
    };
    integrationSandboxEvidence = {
      ...integrationSandboxEvidence,
      [integration]: {
        ...(integrationSandboxEvidence[integration] ?? {}),
        [evidence.test_key]: evidence,
      },
    };
    logDemoEvent({
      event_type: 'integration.sandbox_evidence',
      entity_type: 'integration_config',
      entity_id: integration,
      payload: { ...evidence, source: 'sandbox_workflow_runner' },
    });
    saveDemoData();
    return evidence as T;
  }
  const sandboxWorkflowRunAllMatch = path.match(
    /^\/integrations\/config\/([^/]+)\/sandbox-workflows\/run-all$/
  );
  if (sandboxWorkflowRunAllMatch && method === 'POST') {
    const integration = sandboxWorkflowRunAllMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    if (!config) throw new Error('Integration sandbox workflows not found');
    const evidence = config.sandbox_tests.map((testLabel, index) => ({
      id: uuid(
        4300 +
          index +
          Object.values(integrationSandboxEvidence).reduce(
            (total, items) => total + Object.keys(items).length,
            0
          )
      ),
      integration,
      test_key: demoSandboxTestKey(testLabel),
      test_label: testLabel,
      status: 'passed' as const,
      notes: `Sandbox workflow passed: ${testLabel} returned ok`,
      reference_url: `sandbox://${integration}/${demoSandboxTestKey(testLabel)}`,
      recorded_by: 'Clinic Admin',
      recorded_at: new Date().toISOString(),
    }));
    integrationSandboxEvidence = {
      ...integrationSandboxEvidence,
      [integration]: {
        ...(integrationSandboxEvidence[integration] ?? {}),
        ...Object.fromEntries(evidence.map((item) => [item.test_key, item])),
      },
    };
    logDemoEvent({
      event_type: 'integration.sandbox_evidence',
      entity_type: 'integration_config',
      entity_id: integration,
      payload: { source: 'sandbox_workflow_runner_all', passed_count: evidence.length },
    });
    saveDemoData();
    return { integration, passed_count: evidence.length, failed_count: 0, evidence } as T;
  }
  const integrationConfigMatch = path.match(/^\/integrations\/config\/([^/]+)$/);
  if (integrationConfigMatch && method === 'PATCH') {
    const integration = integrationConfigMatch[1];
    const incoming = body as { values?: Record<string, string> };
    integrationDrafts = {
      ...integrationDrafts,
      [integration]: {
        ...(integrationDrafts[integration] ?? {}),
        ...Object.fromEntries(
          Object.entries(incoming.values ?? {}).filter(([, value]) => value.trim())
        ),
      },
    };
    saveDemoData();
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    if (!config) throw new Error('Integration configuration not found');
    return config as T;
  }
  const integrationTestMatch = path.match(/^\/integrations\/config\/([^/]+)\/test$/);
  if (integrationTestMatch && method === 'POST') {
    const integration = integrationTestMatch[1];
    const config = demoIntegrationConfigs().find((item) => item.key === integration);
    if (!config) throw new Error('Integration configuration not found');
    const event = {
      id: uuid(4100 + auditEvents.length),
      organization_id: uuid(900),
      integration: integration === 'fax' ? 'fax_provider' : integration,
      direction: 'outbound',
      action: 'integration.connection_test',
      status: config.configured ? 'failed' : 'failed',
      entity_type: 'integration_config',
      entity_id: integration,
      idempotency_key: null,
      attempts: 1,
      error: config.configured
        ? 'Credentials are staged but no vendor adapter is connected.'
        : 'Missing required integration configuration.',
      payload: { configured: config.configured, healthy: false, mode: config.mode },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    integrationLastTests = {
      ...integrationLastTests,
      [integration]: { last_tested_at: event.created_at, last_test_status: event.status },
    };
    logDemoEvent({
      event_type: event.action,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      payload: event.payload,
    });
    saveDemoData();
    return {
      integration,
      status: event.status,
      configured: config.configured,
      healthy: false,
      mode: config.mode,
      message: event.error,
      event_id: event.id,
    } as T;
  }
  if (path === '/launch-readiness' && method === 'GET') {
    const requirements = demoLaunchRequirements();
    return {
      production_ready: false,
      score: 0,
      critical_blockers: requirements.length,
      warnings: 0,
      environment: 'demo',
      requirements,
    } as T;
  }

  if (path === '/auth/session-policy' && method === 'GET') {
    const user = demoUsers[0];
    return {
      user_id: user.id,
      role: user.role,
      access_token_expire_minutes: 480,
      mfa_required: false,
      mfa_enabled: user.mfa_enabled,
      mfa_provider: 'local_policy',
      access_review_required: true,
      access_review_window_days: ACCESS_REVIEW_WINDOW_DAYS,
      last_login_at: user.last_login_at,
      last_access_reviewed_at: user.access_reviewed_at,
      phi_reauth_required: true,
      phi_reauth_minutes: clinicSettings.phi_reauth_minutes,
      audit_retention_days: clinicSettings.audit_retention_days,
      audit_events: [
        'auth.login',
        'auth.login_blocked',
        'auth.password_rotated',
        'patient_document.accessed',
        'settings.updated',
        'user.access_reviewed',
      ],
    } as T;
  }
  if (path === '/auth/register' && method === 'POST') {
    const incoming = body as Partial<User> & { password?: string };
    const user: User = {
      id: uuid(3300 + demoUsers.length),
      email: incoming.email ?? `user-${demoUsers.length}@clinic.example.com`,
      display_name: incoming.display_name ?? 'Setup User',
      role: incoming.role ?? 'front_desk',
      organization_id: uuid(900),
      is_active: true,
      mfa_enabled: false,
      password_must_change: true,
      temporary_password_expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      last_login_at: null,
      access_reviewed_at: null,
      access_reviewed_by_id: null,
      access_review_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    demoUsers = [user, ...demoUsers];
    saveDemoData();
    return user as T;
  }
  if (path === '/portal/auth/login' && method === 'POST') {
    const incoming = body as { email: string; dob: string; access_code?: string };
    const patient = patients.find(
      (item) =>
        item.email === incoming.email &&
        item.dob === incoming.dob &&
        item.is_active &&
        incoming.access_code === DEMO_PORTAL_ACCESS_CODE
    );
    if (!patient) throw new Error('Invalid portal credentials');
    return { access_token: `demo-patient-token-${patient.id}`, token_type: 'bearer', patient } as T;
  }
  if (path === '/portal/auth/me' && method === 'GET') {
    return patients[0] as T;
  }
  if (path === '/portal/auth/intake' && method === 'POST') {
    const incoming = body as Partial<PortalIntakeSubmission>;
    const item: PortalIntakeSubmission = {
      id: uuid(3500 + portalIntake.length),
      patient_id: patients[0].id,
      status: 'received',
      source: 'patient_portal',
      request_type: incoming.request_type ?? 'intake_form',
      submitted_payload: incoming.submitted_payload ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    portalIntake = [item, ...portalIntake];
    saveDemoData();
    return item as T;
  }
  if (path === '/portal/auth/documents/upload' && method === 'POST') {
    const incoming = body as { filename: string; content_type: string };
    const safeFilename = incoming.filename.replaceAll('/', '_').replaceAll('\\', '_');
    const fileUrl = `s3://concierge-os/patients/${patients[0].id}/documents/${Date.now()}-${safeFilename}`;
    const uploadToken = `demo-upload-token:${patients[0].id}:${Date.now()}`;
    preparedUploadTokens.set(uploadToken, {
      patientId: patients[0].id,
      fileUrl,
      contentType: incoming.content_type,
    });
    return {
      upload_url: fileUrl,
      file_url: fileUrl,
      upload_token: uploadToken,
      method: 'PUT',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      headers: { 'Content-Type': incoming.content_type },
    } as T;
  }
  if (path === '/portal/auth/documents/upload/confirm' && method === 'POST') {
    return demoRequest<T>('POST', `/patients/${patients[0].id}/documents/upload/confirm`, body);
  }

  if (path === '/clinical/encounter-templates' && method === 'GET') {
    return { data: encounterTemplates, total: encounterTemplates.length } as T;
  }

  if (path === '/portal-intake' && method === 'GET')
    return { data: portalIntake, total: portalIntake.length } as T;
  if (path === '/portal-intake' && method === 'POST') {
    const incoming = body as Partial<PortalIntakeSubmission>;
    const item: PortalIntakeSubmission = {
      id: uuid(2800 + portalIntake.length),
      patient_id: incoming.patient_id ?? null,
      status: 'received',
      source: incoming.source ?? 'portal',
      request_type: incoming.request_type ?? 'intake_form',
      submitted_payload: incoming.submitted_payload ?? {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    portalIntake = [item, ...portalIntake];
    saveDemoData();
    return item as T;
  }
  const portalIntakeMatch = path.match(/^\/portal-intake\/([^/]+)$/);
  if (portalIntakeMatch && method === 'PATCH') {
    portalIntake = portalIntake.map((item) =>
      item.id === portalIntakeMatch[1]
        ? {
            ...item,
            ...(body as Partial<PortalIntakeSubmission>),
            updated_at: new Date().toISOString(),
          }
        : item
    );
    saveDemoData();
    return portalIntake.find((item) => item.id === portalIntakeMatch[1]) as T;
  }
  const portalActionMatch = path.match(
    /^\/portal-intake\/([^/]+)\/(apply-to-patient|convert-appointment|convert-document)$/
  );
  if (portalActionMatch && method === 'POST') {
    const [submissionId, action] = [portalActionMatch[1], portalActionMatch[2]];
    const submission = portalIntake.find((item) => item.id === submissionId);
    if (!submission) throw new Error('Portal intake submission not found');
    if (action === 'apply-to-patient' && submission.patient_id) {
      patients = patients.map((patient) =>
        patient.id === submission.patient_id
          ? {
              ...patient,
              ...(submission.submitted_payload as Partial<Patient>),
              updated_at: new Date().toISOString(),
            }
          : patient
      );
    }
    if (action === 'convert-appointment' && submission.patient_id) {
      const provider = demoUsers.find((user) => user.role === 'provider');
      appointments = [
        {
          id: uuid(2850 + appointments.length),
          patient_id: submission.patient_id,
          patient_name:
            patients.find((patient) => patient.id === submission.patient_id)?.last_name ??
            'Portal Patient',
          provider_id: provider?.id ?? uuid(2),
          provider_name: provider?.display_name ?? 'Provider',
          start_time: String(submission.submitted_payload.start_time ?? iso(24)),
          end_time: String(submission.submitted_payload.end_time ?? iso(24.5)),
          type: String(submission.submitted_payload.type ?? 'Portal request'),
          status: 'scheduled',
          notes: String(submission.submitted_payload.notes ?? 'Converted from portal intake.'),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...appointments,
      ];
    }
    if (action === 'convert-document' && submission.patient_id) {
      patientDocuments = [
        normalizeDocument({
          id: uuid(2860 + patientDocuments.length),
          patient_id: submission.patient_id,
          title: String(submission.submitted_payload.title ?? 'Portal uploaded document'),
          source: 'Patient portal',
          document_type: String(submission.submitted_payload.document_type ?? 'Patient upload'),
          status: 'needs_review',
          matched_by: 'portal intake',
          source_contact: null,
          source_phone: null,
          source_fax: null,
          source_reference: String(
            submission.submitted_payload.source_reference ?? 'Portal intake'
          ),
          requested_by: 'Patient portal',
          routed_to_role: 'front_desk',
          review_priority: 'normal',
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          pages: Number(submission.submitted_payload.pages ?? 1),
          file_url:
            typeof submission.submitted_payload.file_url === 'string'
              ? submission.submitted_payload.file_url
              : null,
          upload_status: 'metadata_only',
          ocr_status: 'not_started',
          classification: null,
          summary: String(
            submission.submitted_payload.summary ?? 'Patient submitted document from portal intake.'
          ),
          received_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        ...patientDocuments,
      ];
    }
    portalIntake = portalIntake.map((item) =>
      item.id === submissionId
        ? { ...item, status: 'applied', updated_at: new Date().toISOString() }
        : item
    );
    saveDemoData();
    return portalIntake.find((item) => item.id === submissionId) as T;
  }

  if (path === '/billing/cases' && method === 'GET')
    return { data: billingCases, total: billingCases.length } as T;
  if (path === '/billing/work-queue' && method === 'GET') return billingWorkQueue() as T;
  if (path === '/billing/charge-review' && method === 'GET') {
    const billedAppointmentIds = new Set(
      billingCases.map((item) => item.appointment_id).filter(Boolean)
    );
    const data = patientEncounters
      .filter(
        (encounter) =>
          encounter.status === 'signed' &&
          encounter.appointment_id &&
          !billedAppointmentIds.has(encounter.appointment_id)
      )
      .map((encounter) => {
        const patient = patients.find((item) => item.id === encounter.patient_id);
        return {
          encounter_id: encounter.id,
          patient_id: encounter.patient_id,
          patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown patient',
          appointment_id: encounter.appointment_id,
          encounter_type: encounter.encounter_type,
          signed_at: encounter.signed_at,
          summary: encounter.summary,
          recommended_cpt_codes: ['99213'],
          recommended_diagnosis_codes: [],
        };
      });
    return { data, total: data.length } as T;
  }
  if (path === '/billing/cases' && method === 'POST') {
    const incoming = body as Partial<BillingCase>;
    const patient = patients.find((item) => item.id === incoming.patient_id);
    const item: BillingCase = {
      id: uuid(2900 + billingCases.length),
      patient_id: incoming.patient_id ?? uuid(101),
      appointment_id: incoming.appointment_id ?? null,
      status: 'draft',
      payer: incoming.payer ?? patient?.insurance?.provider ?? null,
      eligibility_status: 'not_checked',
      claim_control_number: null,
      submission_ready_at: null,
      submitted_at: null,
      denied_at: null,
      denial_reason: null,
      denial_worked_at: null,
      remittance_status: 'not_received',
      allowed_amount: null,
      paid_amount: null,
      paid_at: null,
      cpt_codes: incoming.cpt_codes ?? [],
      diagnosis_codes: incoming.diagnosis_codes ?? [],
      notes: incoming.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    billingCases = [item, ...billingCases];
    saveDemoData();
    return item as T;
  }
  const billingCaseMatch = path.match(/^\/billing\/cases\/([^/]+)$/);
  if (billingCaseMatch && method === 'PATCH') {
    billingCases = billingCases.map((item) => {
      if (item.id !== billingCaseMatch[1]) return item;
      const updated = normalizeBillingCase({
        ...item,
        ...(body as Partial<BillingCase>),
        updated_at: new Date().toISOString(),
      });
      const readiness = billingReadiness(updated);
      return readiness.ready && ['draft', 'ready'].includes(updated.status)
        ? {
            ...updated,
            status: 'ready',
            submission_ready_at: updated.submission_ready_at ?? new Date().toISOString(),
          }
        : updated;
    });
    logDemoEvent({
      event_type: 'billing.case_updated',
      entity_type: 'billing_case',
      entity_id: billingCaseMatch[1],
      payload: { updated_fields: Object.keys((body as Partial<BillingCase>) ?? {}) },
    });
    saveDemoData();
    return billingCases.find((item) => item.id === billingCaseMatch[1]) as T;
  }
  const billingReadinessMatch = path.match(/^\/billing\/cases\/([^/]+)\/readiness$/);
  if (billingReadinessMatch && method === 'GET') {
    const item = billingCases.find((billingCase) => billingCase.id === billingReadinessMatch[1]);
    if (!item) throw new Error('Billing case not found');
    return billingReadiness(item) as T;
  }
  const billingTimelineMatch = path.match(/^\/billing\/cases\/([^/]+)\/timeline$/);
  if (billingTimelineMatch && method === 'GET') {
    const auditRows = auditEvents
      .filter(
        (event) =>
          event.entity_type === 'billing_case' && event.entity_id === billingTimelineMatch[1]
      )
      .map((event) => ({ ...event, source: 'audit', status: null }));
    const integrationRows = integrationEvents
      .filter(
        (event) =>
          event.entity_type === 'billing_case' && event.entity_id === billingTimelineMatch[1]
      )
      .map((event) => ({
        id: event.id,
        source: 'integration',
        event_type: `${event.integration}.${event.action}`,
        entity_type: event.entity_type ?? 'integration_event',
        entity_id: event.entity_id ?? event.id,
        actor_id: null,
        payload: event.payload,
        created_at: event.created_at,
        status: event.status,
      }));
    const data = [...auditRows, ...integrationRows].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    return { data, total: data.length } as T;
  }
  const billingActionMatch = path.match(/^\/billing\/cases\/([^/]+)\/(submit|payment|deny)$/);
  if (billingActionMatch && method === 'POST') {
    const [, caseId, action] = billingActionMatch;
    const incoming = body as Partial<BillingCase>;
    billingCases = billingCases.map((item) => {
      if (item.id !== caseId) return item;
      if (action === 'submit') {
        const readiness = billingReadiness(item);
        if (!readiness.ready)
          throw new Error(`Claim is not ready for submission: ${readiness.blockers.join('; ')}`);
        return {
          ...item,
          status: 'submitted',
          claim_control_number:
            item.claim_control_number ?? `DEMO-CLM-${item.id.slice(-8).toUpperCase()}`,
          submission_ready_at: item.submission_ready_at ?? new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          remittance_status: 'not_received',
          notes: [item.notes, 'Claim staged for clearinghouse submission.']
            .filter(Boolean)
            .join('\n'),
          updated_at: new Date().toISOString(),
        };
      }
      if (action === 'payment')
        return {
          ...item,
          status: 'paid',
          remittance_status: incoming.remittance_status ?? 'received',
          allowed_amount: incoming.allowed_amount ?? item.allowed_amount ?? null,
          paid_amount: incoming.paid_amount ?? item.paid_amount ?? null,
          paid_at: new Date().toISOString(),
          notes: [item.notes, incoming.notes ?? 'Payment recorded.'].filter(Boolean).join('\n'),
          updated_at: new Date().toISOString(),
        };
      return {
        ...item,
        status: 'denied',
        denied_at: new Date().toISOString(),
        denial_reason: incoming.notes ?? 'Denial received and queued for follow-up.',
        notes: [item.notes, incoming.notes ?? 'Denial received and queued for follow-up.']
          .filter(Boolean)
          .join('\n'),
        updated_at: new Date().toISOString(),
      };
    });
    const eventType =
      action === 'submit'
        ? 'billing.claim_submitted'
        : action === 'payment'
          ? 'billing.payment_recorded'
          : 'billing.claim_denied';
    logDemoEvent({
      event_type: eventType,
      entity_type: 'billing_case',
      entity_id: caseId,
      payload: { action },
    });
    if (action === 'submit') {
      integrationEvents = [
        {
          id: uuid(3400 + integrationEvents.length),
          organization_id: uuid(900),
          integration: 'clearinghouse',
          direction: 'outbound',
          action: 'claim.submit',
          status: 'pending',
          entity_type: 'billing_case',
          entity_id: caseId,
          idempotency_key: `claim:submit:${caseId}`,
          attempts: 1,
          error: null,
          payload: { case_id: caseId },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...integrationEvents,
      ];
    }
    saveDemoData();
    return billingCases.find((item) => item.id === caseId) as T;
  }
  const billingReworkMatch = path.match(/^\/billing\/cases\/([^/]+)\/rework$/);
  if (billingReworkMatch && method === 'POST') {
    const incoming = body as { notes?: string | null };
    billingCases = billingCases.map((item) => {
      if (item.id !== billingReworkMatch[1]) return item;
      const worked = {
        ...item,
        denial_worked_at: new Date().toISOString(),
        notes: [item.notes, incoming.notes ?? 'Denial worked and ready to resubmit.']
          .filter(Boolean)
          .join('\n'),
      };
      const readiness = billingReadiness(worked);
      return {
        ...worked,
        status: readiness.ready ? 'ready' : 'draft',
        submission_ready_at: readiness.ready ? new Date().toISOString() : item.submission_ready_at,
        updated_at: new Date().toISOString(),
      };
    });
    logDemoEvent({
      event_type: 'billing.denial_reworked',
      entity_type: 'billing_case',
      entity_id: billingReworkMatch[1],
      payload: {},
    });
    saveDemoData();
    return billingCases.find((item) => item.id === billingReworkMatch[1]) as T;
  }
  const billingFromEncounterMatch = path.match(/^\/billing\/cases\/from-encounter\/([^/]+)$/);
  if (billingFromEncounterMatch && method === 'POST') {
    const encounter = patientEncounters.find((item) => item.id === billingFromEncounterMatch[1]);
    if (!encounter) throw new Error('Encounter not found');
    const patient = patients.find((item) => item.id === encounter.patient_id);
    const item: BillingCase = {
      id: uuid(2900 + billingCases.length),
      patient_id: encounter.patient_id,
      appointment_id: encounter.appointment_id,
      status: 'draft',
      payer: patient?.insurance?.provider ?? null,
      eligibility_status: 'not_checked',
      claim_control_number: null,
      submission_ready_at: null,
      submitted_at: null,
      denied_at: null,
      denial_reason: null,
      denial_worked_at: null,
      remittance_status: 'not_received',
      allowed_amount: null,
      paid_amount: null,
      paid_at: null,
      cpt_codes: ['99213'],
      diagnosis_codes: [],
      notes: `Charge capture from ${encounter.encounter_type} encounter.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    billingCases = [item, ...billingCases];
    saveDemoData();
    return item as T;
  }
  const eligibilityMatch = path.match(/^\/billing\/eligibility\/([^/]+)$/);
  if (eligibilityMatch && method === 'POST') {
    const patient = patients.find((item) => item.id === eligibilityMatch[1]);
    const status = patient?.insurance ? 'eligible' : 'missing_insurance';
    billingCases = billingCases.map((item) => {
      if (item.patient_id !== eligibilityMatch[1] || !['draft', 'ready'].includes(item.status))
        return item;
      const updated = { ...item, eligibility_status: status, updated_at: new Date().toISOString() };
      const readiness = billingReadiness(updated);
      return readiness.ready
        ? {
            ...updated,
            status: 'ready',
            submission_ready_at: updated.submission_ready_at ?? new Date().toISOString(),
          }
        : updated;
    });
    logDemoEvent({
      event_type: 'billing.eligibility_checked',
      entity_type: 'patient',
      entity_id: eligibilityMatch[1],
      payload: { payer: patient?.insurance?.provider ?? null, status },
    });
    saveDemoData();
    return {
      patient_id: eligibilityMatch[1],
      payer: patient?.insurance?.provider ?? null,
      status,
      reference_id: `demo-elig-${eligibilityMatch[1].slice(-6)}`,
      message: patient?.insurance
        ? 'Demo eligibility staged. Configure a clearinghouse before live use.'
        : 'Insurance is missing from chart.',
    } as T;
  }
  const eligibilityHistoryMatch = path.match(/^\/billing\/eligibility\/([^/]+)\/history$/);
  if (eligibilityHistoryMatch && method === 'GET') {
    const data = auditEvents.filter(
      (event) =>
        event.event_type === 'billing.eligibility_checked' &&
        event.entity_type === 'patient' &&
        event.entity_id === eligibilityHistoryMatch[1]
    );
    return { data, total: data.length } as T;
  }

  if (path === '/settings' && method === 'GET') return clinicSettings as T;
  if (path === '/settings' && method === 'PATCH') {
    clinicSettings = { ...clinicSettings, ...(body as Partial<ClinicSettings>) };
    saveDemoData();
    return clinicSettings as T;
  }

  if (method === 'GET' && path === '/integrations/events') {
    return {
      data: paginate(integrationEvents, page, pageSize),
      total: integrationEvents.length,
      page,
      page_size: pageSize,
    } as T;
  }

  if (method === 'GET' && path === '/patients/workload/checkout') {
    const openItems = patientCarePlan.filter((item) =>
      ['open', 'in_progress', 'blocked'].includes(item.status)
    );
    const buckets = new Map<string, WorkloadSummary['data'][number]>();
    for (const item of openItems) {
      const key = `${item.owner_role}:${item.assigned_to_id ?? 'unassigned'}`;
      const bucket = buckets.get(key) ?? {
        owner_role: item.owner_role,
        assigned_to_id: item.assigned_to_id,
        assigned_to_name: item.assigned_to_name,
        open_items: 0,
        blocked_items: 0,
        escalated_items: 0,
        source_linked_tasks: 0,
        urgent_tasks: 0,
      };
      bucket.open_items += 1;
      if (item.status === 'blocked') bucket.blocked_items += 1;
      if (item.escalation) bucket.escalated_items += 1;
      buckets.set(key, bucket);
    }
    const sourceTasks = tasks.filter(
      (task) =>
        task.source_type?.startsWith('checkout_handoff:') &&
        ACTIVE_TASK_STATUSES.includes(task.status)
    );
    for (const task of sourceTasks) {
      const key = `Checkout tasks:${task.assigned_to_id ?? 'unassigned'}`;
      const bucket = buckets.get(key) ?? {
        owner_role: 'Checkout tasks',
        assigned_to_id: task.assigned_to_id,
        assigned_to_name: task.assigned_to_name,
        open_items: 0,
        blocked_items: 0,
        escalated_items: 0,
        source_linked_tasks: 0,
        urgent_tasks: 0,
      };
      bucket.source_linked_tasks += 1;
      if (task.priority === 'urgent') bucket.urgent_tasks += 1;
      buckets.set(key, bucket);
    }
    return {
      data: [...buckets.values()],
      total_open_items: openItems.length,
      unassigned_items: openItems.filter((item) => !item.assigned_to_id).length,
      source_linked_tasks: sourceTasks.length,
      urgent_tasks: sourceTasks.filter((task) => task.priority === 'urgent').length,
    } satisfies WorkloadSummary as T;
  }

  const integrationRetryMatch = path.match(/^\/integrations\/events\/([^/]+)\/retry$/);
  if (method === 'POST' && integrationRetryMatch) {
    integrationEvents = integrationEvents.map((event) =>
      event.id === integrationRetryMatch[1]
        ? {
            ...event,
            status: 'retrying',
            attempts: event.attempts + 1,
            updated_at: new Date().toISOString(),
          }
        : event
    );
    saveDemoData();
    return integrationEvents.find((event) => event.id === integrationRetryMatch[1]) as T;
  }

  if (method === 'GET' && path === '/audit') {
    const eventType = url.searchParams.get('event_type');
    const filtered = eventType
      ? auditEvents.filter((event) => event.event_type === eventType)
      : auditEvents;
    return {
      data: paginate(filtered, page, pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    } as T;
  }

  if (method === 'GET' && path === '/audit/review-summary') {
    return auditReviewSummary() as T;
  }

  const patientAccessHistoryMatch = path.match(/^\/audit\/patients\/([^/]+)\/access-history$/);
  if (patientAccessHistoryMatch && method === 'GET') {
    const patientId = patientAccessHistoryMatch[1];
    const data = auditEvents.filter(
      (event) => String(event.payload?.patient_id ?? '') === patientId
    );
    return { data, total: data.length } as T;
  }

  if (method === 'GET' && path === '/users') {
    const role = url.searchParams.get('role');
    const data = role ? demoUsers.filter((user) => user.role === role) : demoUsers;
    return { data, total: data.length } as T;
  }

  if (method === 'GET' && path === '/users/access-review') {
    return accessReviewSummary() as T;
  }

  if (method === 'GET' && path === '/users/recovery-summary') {
    return recoverySummary() as T;
  }

  if (method === 'GET' && path === '/users/role-access-matrix') {
    return roleAccessMatrix() as T;
  }

  const userPasswordResetMatch = path.match(/^\/users\/([^/]+)\/password-reset$/);
  if (userPasswordResetMatch && method === 'POST') {
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const temporaryPassword = demoTemporaryPassword();
    demoUsers = demoUsers.map((user) =>
      user.id === userPasswordResetMatch[1]
        ? {
            ...user,
            password_must_change: true,
            temporary_password_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }
        : user
    );
    const user = demoUsers.find((item) => item.id === userPasswordResetMatch[1]);
    if (!user) throw new Error('User not found');
    logDemoEvent({
      event_type: 'user.password_reset_issued',
      entity_type: 'user',
      entity_id: user.id,
      payload: { role: user.role, temporary_password_expires_at: expiresAt, source: 'demo' },
    });
    saveDemoData();
    return {
      user,
      temporary_password: temporaryPassword,
      temporary_password_expires_at: expiresAt,
    } satisfies UserPasswordResetResponse as T;
  }

  const userAccessReviewMatch = path.match(/^\/users\/([^/]+)\/access-review$/);
  if (userAccessReviewMatch && method === 'POST') {
    const incoming = body as Partial<User> & { note?: string | null };
    const reviewedAt = new Date().toISOString();
    demoUsers = demoUsers.map((user) =>
      user.id === userAccessReviewMatch[1]
        ? {
            ...user,
            mfa_enabled:
              typeof incoming.mfa_enabled === 'boolean' ? incoming.mfa_enabled : user.mfa_enabled,
            access_reviewed_at: reviewedAt,
            access_reviewed_by_id: uuid(1),
            access_review_note: incoming.note ?? user.access_review_note,
            updated_at: reviewedAt,
          }
        : user
    );
    saveDemoData();
    return demoUsers.find((user) => user.id === userAccessReviewMatch[1]) as T;
  }

  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === 'PATCH') {
    demoUsers = demoUsers.map((user) =>
      user.id === userMatch[1]
        ? { ...user, ...(body as Partial<User>), updated_at: new Date().toISOString() }
        : user
    );
    return demoUsers.find((user) => user.id === userMatch[1]) as T;
  }

  if (path === '/assistant/actions/follow-up-task' && method === 'POST') {
    const incoming = body as {
      context: string;
      title?: string;
      priority?: Task['priority'];
      patient_id?: string | null;
      due_date?: string | null;
    };
    const patient = patients.find((item) => item.id === incoming.patient_id);
    const task: Task = withDeliveryDefaults({
      id: uuid(920 + tasks.length),
      title:
        incoming.title ??
        `Assistant follow-up: ${patient ? `${patient.first_name} ${patient.last_name}` : incoming.context}`,
      description: `Assistant staged this from: ${incoming.context}. Confirm chart context before outreach.`,
      priority: incoming.priority ?? 'high',
      status: 'open',
      due_date: incoming.due_date ?? null,
      assigned_to_id: null,
      assigned_to_name: 'Clinic Admin',
      patient_id: incoming.patient_id ?? null,
      patient_name: patient ? `${patient.last_name}, ${patient.first_name}` : null,
      source_type: null,
      source_id: null,
      creator_id: uuid(1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    tasks = [task, ...tasks];
    logDemoEvent({
      event_type: 'assistant.task_created',
      entity_type: 'task',
      entity_id: task.id,
      payload: {
        title: task.title,
        patient_name: task.patient_name,
        priority: task.priority,
        source: 'clinical-assistant',
      },
    });
    saveDemoData();
    return task as T;
  }

  if (path === '/assistant/actions/portal-reply-draft' && method === 'POST') {
    const incoming = body as {
      recipient_id: string;
      subject: string;
      body: string;
      thread_id?: string;
      context: string;
    };
    const message: Message = {
      id: uuid(700 + messages.length),
      sender_id: uuid(1),
      sender_name: 'Clinic Admin',
      recipient_id: incoming.recipient_id,
      recipient_name: 'Care Team',
      subject: incoming.subject,
      body: incoming.body,
      thread_id: incoming.thread_id ?? uuid(800 + messages.length),
      is_read: true,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, message];
    logDemoEvent({
      event_type: 'assistant.message_drafted',
      entity_type: 'message',
      entity_id: message.id,
      payload: {
        subject: message.subject,
        recipient_id: message.recipient_id,
        thread_id: message.thread_id,
        context: incoming.context,
        source: 'clinical-assistant',
      },
    });
    saveDemoData();
    return message as T;
  }

  if (path === '/assistant/actions/fax-match' && method === 'POST') {
    const incoming = body as { fax_id: string; patient_id: string; context: string };
    const patient = patients.find((item) => item.id === incoming.patient_id);
    faxes = faxes.map((fax) =>
      fax.id === incoming.fax_id
        ? {
            ...fax,
            patient_id: incoming.patient_id,
            patient_name: patient
              ? `${patient.last_name}, ${patient.first_name}`
              : fax.patient_name,
            matched_by: 'assistant suggested, user confirmed',
          }
        : fax
    );
    const updated = faxes.find((fax) => fax.id === incoming.fax_id);
    if (!updated) throw new Error('Fax not found');
    logDemoEvent({
      event_type: 'assistant.fax_match_staged',
      entity_type: 'fax',
      entity_id: updated.id,
      payload: {
        patient_name: updated.patient_name,
        matched_by: updated.matched_by,
        pages: updated.pages,
        context: incoming.context,
        source: 'clinical-assistant',
      },
    });
    saveDemoData();
    return updated as T;
  }

  if (path === '/patients') {
    if (method === 'POST') {
      const incoming = body as Partial<Patient>;
      const patient: Patient = {
        id: uuid(900 + patients.length),
        mrn: `MRN-${14000 + patients.length}`,
        first_name: incoming.first_name ?? 'New',
        last_name: incoming.last_name ?? 'Patient',
        dob: incoming.dob ?? '1980-01-01',
        gender: incoming.gender ?? 'Unknown',
        phone: incoming.phone ?? null,
        email: incoming.email ?? null,
        sms_consent: incoming.sms_consent ?? false,
        email_consent: incoming.email_consent ?? false,
        preferred_contact_channel: incoming.preferred_contact_channel ?? null,
        address: null,
        emergency_contact: null,
        insurance: null,
        allergies: [],
        problem_list: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      patients = [patient, ...patients];
      logDemoEvent({
        event_type: 'patient.created',
        entity_type: 'patient',
        entity_id: patient.id,
        payload: { patient_name: `${patient.first_name} ${patient.last_name}`, source: 'demo-ui' },
      });
      saveDemoData();
      return patient as T;
    }
    const search = (url.searchParams.get('search') ?? '').toLowerCase().trim();
    const filtered = search
      ? patients.filter((patient) =>
          [patient.mrn, patient.first_name, patient.last_name, patient.email, patient.phone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search))
        )
      : patients;
    return {
      data: paginate(filtered, page, pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    } as T;
  }

  const patientMatch = path.match(/^\/patients\/([^/]+)$/);
  if (patientMatch) {
    const patient = patients.find((item) => item.id === patientMatch[1]);
    if (!patient) throw new Error('Patient not found');
    if (method === 'PATCH') {
      patients = patients.map((item) =>
        item.id === patient.id
          ? { ...item, ...(body as PatientUpdate), updated_at: new Date().toISOString() }
          : item
      );
      logDemoEvent({
        event_type: 'patient.updated',
        entity_type: 'patient',
        entity_id: patient.id,
        payload: { patient_name: `${patient.first_name} ${patient.last_name}`, source: 'demo-ui' },
      });
      saveDemoData();
      return patients.find((item) => item.id === patient.id) as T;
    }
    return patient as T;
  }

  if (path === '/patients/documents/review-queue') {
    const status = url.searchParams.get('status') ?? 'needs_review';
    const routedToRole = url.searchParams.get('routed_to_role');
    const reviewPriority = url.searchParams.get('review_priority');
    const rows: PatientDocumentQueueItem[] = patientDocuments
      .filter((document) => !status || document.status === status)
      .filter((document) => !routedToRole || document.routed_to_role === routedToRole)
      .filter((document) => !reviewPriority || document.review_priority === reviewPriority)
      .map((document) => {
        const patient = patients.find((item) => item.id === document.patient_id);
        return {
          ...document,
          patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown patient',
          patient_mrn: patient?.mrn ?? 'MRN-UNKNOWN',
          patient_dob: patient?.dob ?? '',
          patient_phone: patient?.phone ?? null,
        };
      })
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    return {
      data: paginate(rows, page, pageSize),
      total: rows.length,
      page,
      page_size: pageSize,
    } as T;
  }

  const patientDocumentsMatch = path.match(/^\/patients\/([^/]+)\/documents$/);
  if (patientDocumentsMatch) {
    const patientId = patientDocumentsMatch[1];
    if (!patients.some((patient) => patient.id === patientId)) throw new Error('Patient not found');
    if (method === 'POST') {
      const incoming = body as Partial<PatientDocument>;
      const document: PatientDocument = normalizeDocument({
        id: uuid(980 + patientDocuments.length),
        patient_id: patientId,
        title: incoming.title ?? 'Outside document',
        source: incoming.source ?? 'Outside office',
        document_type: incoming.document_type ?? 'Clinical record',
        status: incoming.status ?? 'received',
        matched_by: incoming.matched_by ?? 'manual',
        source_contact: incoming.source_contact ?? null,
        source_phone: incoming.source_phone ?? null,
        source_fax: incoming.source_fax ?? null,
        source_reference: incoming.source_reference ?? null,
        requested_by: incoming.requested_by ?? null,
        routed_to_role: incoming.routed_to_role ?? null,
        review_priority: incoming.review_priority ?? 'normal',
        review_note: incoming.review_note ?? null,
        reviewed_by: incoming.reviewed_by ?? null,
        reviewed_at: incoming.reviewed_at ?? null,
        pages: incoming.pages ?? 1,
        file_url: incoming.file_url ?? null,
        summary: incoming.summary ?? null,
        received_at: incoming.received_at ?? new Date().toISOString(),
        created_at: new Date().toISOString(),
        upload_status: incoming.upload_status ?? (incoming.file_url ? 'uploaded' : 'metadata_only'),
        ocr_status: incoming.ocr_status ?? 'not_started',
        classification: incoming.classification ?? null,
        updated_at: new Date().toISOString(),
      });
      patientDocuments = [document, ...patientDocuments];
      logDemoEvent({
        event_type: 'patient_document.created',
        entity_type: 'patient_document',
        entity_id: document.id,
        payload: {
          patient_id: patientId,
          title: document.title,
          source: document.source,
          source_mode: 'demo-ui',
        },
      });
      saveDemoData();
      return document as T;
    }
    const filtered = patientDocuments
      .filter((document) => document.patient_id === patientId)
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    return {
      data: paginate(filtered, page, pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    } as T;
  }

  const patientDocumentUploadMatch = path.match(/^\/patients\/([^/]+)\/documents\/upload$/);
  if (patientDocumentUploadMatch && method === 'POST') {
    const patientId = patientDocumentUploadMatch[1];
    const incoming = body as { filename: string; content_type: string };
    const safeFilename = incoming.filename.replaceAll('/', '_').replaceAll('\\', '_');
    const fileUrl = `s3://concierge-os/patients/${patientId}/documents/${Date.now()}-${safeFilename}`;
    const uploadToken = `demo-upload-token:${patientId}:${Date.now()}`;
    preparedUploadTokens.set(uploadToken, {
      patientId,
      fileUrl,
      contentType: incoming.content_type,
    });
    return {
      upload_url: fileUrl,
      file_url: fileUrl,
      upload_token: uploadToken,
      method: 'PUT',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      headers: { 'Content-Type': incoming.content_type },
    } as T;
  }

  const patientDocumentUploadConfirmMatch = path.match(
    /^\/patients\/([^/]+)\/documents\/upload\/confirm$/
  );
  if (patientDocumentUploadConfirmMatch && method === 'POST') {
    const patientId = patientDocumentUploadConfirmMatch[1];
    const incoming = body as {
      title: string;
      source: string;
      document_type: string;
      file_url: string;
      filename: string;
      content_type: string;
      checksum?: string;
      pages?: number;
      upload_token?: string;
    };
    const preparedUpload = incoming.upload_token
      ? preparedUploadTokens.get(incoming.upload_token)
      : null;
    if (
      !preparedUpload ||
      preparedUpload.patientId !== patientId ||
      preparedUpload.fileUrl !== incoming.file_url ||
      preparedUpload.contentType !== incoming.content_type
    ) {
      throw new Error('Upload confirmation does not match a prepared upload');
    }
    preparedUploadTokens.delete(incoming.upload_token ?? '');
    const duplicate = patientDocuments.find(
      (item) =>
        item.patient_id === patientId &&
        (item.file_url === incoming.file_url ||
          (incoming.checksum && item.summary?.includes(incoming.checksum)))
    );
    if (duplicate) {
      logDemoEvent({
        event_type: 'patient_document.upload_duplicate_detected',
        entity_type: 'patient_document',
        entity_id: duplicate.id,
        payload: {
          patient_id: patientId,
          file_url: incoming.file_url,
          filename: incoming.filename,
          checksum: incoming.checksum ?? null,
        },
      });
      saveDemoData();
      return duplicate as T;
    }
    const document = normalizeDocument({
      id: uuid(3200 + patientDocuments.length),
      patient_id: patientId,
      title: incoming.title,
      source: incoming.source,
      document_type: incoming.document_type,
      status: 'needs_review',
      matched_by: 'upload confirmation',
      source_contact: null,
      source_phone: null,
      source_fax: null,
      source_reference: null,
      requested_by: null,
      routed_to_role: 'front_desk',
      review_priority: 'normal',
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      pages: incoming.pages ?? 1,
      file_url: incoming.file_url,
      upload_status: 'uploaded',
      ocr_status: 'queued',
      classification: null,
      summary: `Uploaded ${incoming.filename} (${incoming.content_type}). Checksum: ${incoming.checksum ?? 'not provided'}.`,
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as PatientDocument);
    patientDocuments = [document, ...patientDocuments];
    logDemoEvent({
      event_type: 'patient_document.upload_confirmed',
      entity_type: 'patient_document',
      entity_id: document.id,
      payload: {
        patient_id: patientId,
        file_url: incoming.file_url,
        filename: incoming.filename,
        content_type: incoming.content_type,
        checksum: incoming.checksum ?? null,
      },
    });
    saveDemoData();
    return document as T;
  }

  const patientDocumentMatch = path.match(/^\/patients\/([^/]+)\/documents\/([^/]+)$/);
  if (patientDocumentMatch && method === 'PATCH') {
    const [patientId, documentId] = [patientDocumentMatch[1], patientDocumentMatch[2]];
    const existing = patientDocuments.find(
      (document) => document.patient_id === patientId && document.id === documentId
    );
    if (!existing) throw new Error('Document not found');
    const incoming = body as Partial<PatientDocument>;
    const reviewedAt =
      (incoming.reviewed_by || incoming.review_note) && !existing.reviewed_at
        ? new Date().toISOString()
        : incoming.reviewed_at;
    patientDocuments = patientDocuments.map((document) =>
      document.id === documentId
        ? {
            ...document,
            ...incoming,
            reviewed_at: reviewedAt ?? document.reviewed_at,
            updated_at: new Date().toISOString(),
          }
        : document
    );
    const updated = patientDocuments.find((document) => document.id === documentId);
    if (updated) {
      logDemoEvent({
        event_type: 'patient_document.updated',
        entity_type: 'patient_document',
        entity_id: updated.id,
        payload: {
          patient_id: patientId,
          title: updated.title,
          status: updated.status,
          source_mode: 'demo-ui',
        },
      });
    }
    saveDemoData();
    return updated as T;
  }

  const patientDocumentAccessMatch = path.match(
    /^\/patients\/([^/]+)\/documents\/([^/]+)\/access$/
  );
  if (patientDocumentAccessMatch && method === 'GET') {
    const [patientId, documentId] = [patientDocumentAccessMatch[1], patientDocumentAccessMatch[2]];
    const document = patientDocuments.find(
      (item) => item.patient_id === patientId && item.id === documentId
    );
    if (!document) throw new Error('Document not found');
    const expiresAt = document.file_url
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : null;
    const accessToken = document.file_url ? `demo-doc-access:${document.id}:${expiresAt}` : null;
    const contentType = document.file_url?.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : null;
    logDemoEvent({
      event_type: 'patient_document.accessed',
      entity_type: 'patient_document',
      entity_id: document.id,
      payload: {
        patient_id: patientId,
        reason: url.searchParams.get('reason') ?? null,
        has_file: Boolean(document.file_url),
        storage_status: document.file_url ? 'signed_handoff' : 'metadata_only',
        viewer_mode: document.file_url ? 'inline' : 'metadata',
        content_type: contentType,
        expires_at: expiresAt,
        source_mode: 'demo-ui',
      },
    });
    return {
      document_id: document.id,
      available: Boolean(document.file_url),
      url: document.file_url
        ? `/api/patients/${patientId}/documents/${documentId}/download?token=${accessToken}`
        : null,
      expires_at: expiresAt,
      reason: document.file_url ? null : 'No file URL is attached to this document yet.',
      preview_supported: contentType === 'application/pdf',
      content_type: contentType,
      viewer_mode: document.file_url ? 'inline' : 'metadata',
      access_token: accessToken,
      storage_status: document.file_url ? 'signed_handoff' : 'metadata_only',
      file_name: document.file_url ? demoFileName(document.file_url) : null,
      source_uri_preview: document.file_url ? demoSourcePreview(document.file_url) : null,
    } as T;
  }

  const patientDocumentDownloadMatch = path.match(
    /^\/patients\/([^/]+)\/documents\/([^/]+)\/download$/
  );
  if (patientDocumentDownloadMatch && method === 'GET') {
    const [patientId, documentId] = [
      patientDocumentDownloadMatch[1],
      patientDocumentDownloadMatch[2],
    ];
    const document = patientDocuments.find(
      (item) => item.patient_id === patientId && item.id === documentId
    );
    if (!document?.file_url) throw new Error('Document access expired');
    const token = url.searchParams.get('token') ?? '';
    const expiresAt = token.startsWith(`demo-doc-access:${document.id}:`)
      ? token.replace(`demo-doc-access:${document.id}:`, '')
      : null;
    logDemoEvent({
      event_type: 'patient_document.download_handoff',
      entity_type: 'patient_document',
      entity_id: document.id,
      payload: {
        patient_id: patientId,
        storage_status: 'signed_handoff',
        viewer_mode: document.file_url.toLowerCase().endsWith('.pdf') ? 'inline' : 'download',
        content_type: document.file_url.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'application/octet-stream',
        presigned: false,
        expires_at: expiresAt,
        source_mode: 'demo-ui',
      },
    });
    return {
      document_id: document.id,
      title: document.title,
      file_name: demoFileName(document.file_url),
      content_type: document.file_url.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'application/octet-stream',
      viewer_mode: document.file_url.toLowerCase().endsWith('.pdf') ? 'inline' : 'download',
      storage_status: 'signed_handoff',
      source_uri_preview: demoSourcePreview(document.file_url),
      presigned_url: null,
      expires_at: expiresAt,
      message:
        'Signed document access is prepared. Configure object-storage signing to stream or redirect the file.',
    } as T;
  }

  const patientDocumentProcessMatch = path.match(
    /^\/patients\/([^/]+)\/documents\/([^/]+)\/process$/
  );
  if (patientDocumentProcessMatch && method === 'POST') {
    const [patientId, documentId] = [
      patientDocumentProcessMatch[1],
      patientDocumentProcessMatch[2],
    ];
    const document = patientDocuments.find(
      (item) => item.patient_id === patientId && item.id === documentId
    );
    if (!document) throw new Error('Document not found');
    const classification = document.document_type.toLowerCase().includes('lab')
      ? 'lab_result'
      : 'clinical_record';
    patientDocuments = patientDocuments.map((item) =>
      item.id === documentId
        ? {
            ...item,
            status: 'needs_review',
            upload_status: item.file_url ? 'uploaded' : 'metadata_only',
            ocr_status: item.file_url ? 'completed' : 'not_available',
            classification,
            summary:
              item.summary ??
              `${item.document_type} from ${item.source} was processed and needs chart review.`,
            updated_at: new Date().toISOString(),
          }
        : item
    );
    const updated = patientDocuments.find((item) => item.id === documentId) as PatientDocument;
    saveDemoData();
    return { document: updated, created_task_id: null } as T;
  }

  const patientChartSummaryMatch = path.match(/^\/patients\/([^/]+)\/chart-summary$/);
  if (patientChartSummaryMatch && method === 'GET') {
    const patientId = patientChartSummaryMatch[1];
    if (!patients.some((patient) => patient.id === patientId)) throw new Error('Patient not found');
    const documents = patientDocuments
      .filter((document) => document.patient_id === patientId)
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 5);
    const openTasks = tasks
      .filter((task) => task.patient_id === patientId && ACTIVE_TASK_STATUSES.includes(task.status))
      .slice(0, 5);
    const recentFaxes = faxes
      .filter((fax) => fax.patient_id === patientId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5);
    const upcomingAppointments = appointments
      .filter(
        (appointment) =>
          patientId === appointment.patient_id &&
          ['scheduled', 'checked_in', 'in_progress'].includes(appointment.status)
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 5);
    const documentsNeedingReview = patientDocuments.filter(
      (document) => document.patient_id === patientId && document.status === 'needs_review'
    ).length;
    const urgentTasks = tasks.filter(
      (task) =>
        task.patient_id === patientId &&
        task.priority === 'urgent' &&
        ACTIVE_TASK_STATUSES.includes(task.status)
    ).length;
    const unsignedEncounters = patientEncounters.filter(
      (encounter) =>
        encounter.patient_id === patientId &&
        ['draft', 'provider_review'].includes(encounter.status)
    ).length;
    const medicationsNeedingReview = patientMedications.filter(
      (medication) => medication.patient_id === patientId && medication.status === 'review'
    ).length;
    const labsNeedingReview = patientLabs.filter(
      (lab) => lab.patient_id === patientId && ['new', 'needs_review'].includes(lab.status)
    ).length;
    const carePlanBlockers = patientCarePlan.filter(
      (item) => item.patient_id === patientId && item.status === 'blocked'
    ).length;
    const summary: PatientChartSummary = {
      patient_id: patientId,
      checkout_readiness:
        documentsNeedingReview ||
        urgentTasks ||
        unsignedEncounters ||
        medicationsNeedingReview ||
        labsNeedingReview ||
        carePlanBlockers
          ? 'blocked'
          : 'ready',
      blockers: [
        ...(documentsNeedingReview
          ? [`${documentsNeedingReview} outside document needs review`]
          : []),
        ...(urgentTasks ? [`${urgentTasks} urgent task is still open`] : []),
        ...(unsignedEncounters ? [`${unsignedEncounters} encounter note needs sign-off`] : []),
        ...(medicationsNeedingReview
          ? [`${medicationsNeedingReview} medication needs reconciliation`]
          : []),
        ...(labsNeedingReview ? [`${labsNeedingReview} lab result needs review`] : []),
        ...(carePlanBlockers ? [`${carePlanBlockers} care plan item is blocked`] : []),
      ],
      counts: {
        documents_total: patientDocuments.filter((document) => document.patient_id === patientId)
          .length,
        documents_needing_review: documentsNeedingReview,
        open_tasks: openTasks.length,
        urgent_tasks: urgentTasks,
        recent_faxes: recentFaxes.length,
        upcoming_appointments: upcomingAppointments.length,
        unsigned_encounters: unsignedEncounters,
        medications_needing_review: medicationsNeedingReview,
        labs_needing_review: labsNeedingReview,
        care_plan_blockers: carePlanBlockers,
      },
      documents,
      open_tasks: openTasks,
      recent_faxes: recentFaxes,
      upcoming_appointments: upcomingAppointments,
    };
    return summary as T;
  }

  const patientCheckoutHandoffMatch = path.match(/^\/patients\/([^/]+)\/checkout-handoff$/);
  if (patientCheckoutHandoffMatch && method === 'GET') {
    const patientId = patientCheckoutHandoffMatch[1];
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) throw new Error('Patient not found');
    const chartSummary = await demoRequest<PatientChartSummary>(
      'GET',
      `/patients/${patientId}/chart-summary`
    );
    if (!chartSummary) throw new Error('Chart summary not found');
    const handoff: PatientCheckoutHandoff = {
      patient,
      chart_summary: chartSummary,
      documents_needing_review: patientDocuments.filter(
        (document) => document.patient_id === patientId && document.status === 'needs_review'
      ),
      medications_needing_review: patientMedications.filter(
        (medication) =>
          medication.patient_id === patientId && ['review', 'held'].includes(medication.status)
      ),
      labs_needing_review: patientLabs.filter(
        (lab) => lab.patient_id === patientId && ['new', 'needs_review'].includes(lab.status)
      ),
      care_plan_open_items: patientCarePlan.filter(
        (item) =>
          item.patient_id === patientId && ['open', 'in_progress', 'blocked'].includes(item.status)
      ),
      unsigned_encounters: patientEncounters.filter(
        (encounter) =>
          encounter.patient_id === patientId &&
          ['draft', 'provider_review'].includes(encounter.status)
      ),
    };
    return handoff as T;
  }

  const patientCheckoutHandoffTaskMatch = path.match(
    /^\/patients\/([^/]+)\/checkout-handoff\/tasks$/
  );
  if (patientCheckoutHandoffTaskMatch && method === 'POST') {
    const patientId = patientCheckoutHandoffTaskMatch[1];
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) throw new Error('Patient not found');
    const incoming = body as Partial<Task> & { source_type?: string; source_id?: string };
    if (!incoming.source_type || !incoming.source_id)
      throw new Error('Checkout handoff source not found');
    const sourceType = `checkout_handoff:${incoming.source_type}`;
    const existing = tasks.find(
      (task) =>
        task.patient_id === patientId &&
        task.source_type === sourceType &&
        task.source_id === incoming.source_id &&
        ACTIVE_TASK_STATUSES.includes(task.status)
    );
    if (existing) return existing as T;
    const source = findDemoHandoffSource(patientId, incoming.source_type, incoming.source_id);
    if (!source) throw new Error('Checkout handoff source not found');
    const task: Task = withDeliveryDefaults({
      id: uuid(920 + tasks.length),
      title: incoming.title ?? source.title,
      description: incoming.description ?? source.description,
      priority: incoming.priority ?? 'high',
      status: 'open',
      due_date: null,
      assigned_to_id: source.assigned_to_id ?? null,
      assigned_to_name: source.assigned_to_name ?? null,
      patient_id: patientId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      source_type: sourceType,
      source_id: incoming.source_id,
      creator_id: uuid(1),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    tasks = [task, ...tasks];
    logDemoEvent({
      event_type: 'checkout_handoff.task_created',
      entity_type: 'task',
      entity_id: task.id,
      payload: {
        patient_id: patientId,
        source_type: incoming.source_type,
        source_id: incoming.source_id,
      },
    });
    saveDemoData();
    return task as T;
  }

  const patientEncountersMatch = path.match(/^\/patients\/([^/]+)\/encounters$/);
  if (patientEncountersMatch && method === 'GET') {
    const patientId = patientEncountersMatch[1];
    const data = patientEncounters.filter((encounter) => encounter.patient_id === patientId);
    return { data, total: data.length } as T;
  }
  if (patientEncountersMatch && method === 'POST') {
    const patientId = patientEncountersMatch[1];
    const incoming = body as Partial<PatientEncounter>;
    const provider = demoUsers.find((user) => user.id === incoming.provider_id);
    const encounter: PatientEncounter = {
      id: uuid(3000 + patientEncounters.length),
      patient_id: patientId,
      appointment_id: incoming.appointment_id ?? null,
      provider_id: incoming.provider_id ?? null,
      provider_name: provider?.display_name ?? null,
      encounter_type: incoming.encounter_type ?? 'office_visit',
      status: incoming.status ?? 'draft',
      summary: incoming.summary ?? null,
      subjective: incoming.subjective ?? null,
      objective: incoming.objective ?? null,
      assessment: incoming.assessment ?? null,
      plan: incoming.plan ?? null,
      signed_at: incoming.status === 'signed' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    patientEncounters = [encounter, ...patientEncounters];
    saveDemoData();
    return encounter as T;
  }

  const patientEncounterMatch = path.match(/^\/patients\/([^/]+)\/encounters\/([^/]+)$/);
  if (patientEncounterMatch && method === 'PATCH') {
    const [patientId, encounterId] = [patientEncounterMatch[1], patientEncounterMatch[2]];
    patientEncounters = patientEncounters.map((encounter) =>
      encounter.patient_id === patientId && encounter.id === encounterId
        ? {
            ...encounter,
            ...(body as Partial<PatientEncounter>),
            signed_at:
              (body as Partial<PatientEncounter>).status === 'signed'
                ? new Date().toISOString()
                : encounter.signed_at,
            updated_at: new Date().toISOString(),
          }
        : encounter
    );
    saveDemoData();
    return patientEncounters.find((encounter) => encounter.id === encounterId) as T;
  }

  const patientMedicationsMatch = path.match(/^\/patients\/([^/]+)\/medications$/);
  if (patientMedicationsMatch && method === 'GET') {
    const patientId = patientMedicationsMatch[1];
    const data = patientMedications.filter((medication) => medication.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientMedicationMatch = path.match(/^\/patients\/([^/]+)\/medications\/([^/]+)$/);
  if (patientMedicationMatch && method === 'PATCH') {
    const [patientId, medicationId] = [patientMedicationMatch[1], patientMedicationMatch[2]];
    patientMedications = patientMedications.map((medication) =>
      medication.patient_id === patientId && medication.id === medicationId
        ? {
            ...medication,
            ...(body as Partial<PatientMedication>),
            updated_at: new Date().toISOString(),
          }
        : medication
    );
    saveDemoData();
    return patientMedications.find((medication) => medication.id === medicationId) as T;
  }

  const patientCarePlanMatch = path.match(/^\/patients\/([^/]+)\/care-plan$/);
  if (patientCarePlanMatch && method === 'GET') {
    const patientId = patientCarePlanMatch[1];
    const data = patientCarePlan.filter((item) => item.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientCarePlanItemMatch = path.match(/^\/patients\/([^/]+)\/care-plan\/([^/]+)$/);
  if (patientCarePlanItemMatch && method === 'PATCH') {
    const [patientId, itemId] = [patientCarePlanItemMatch[1], patientCarePlanItemMatch[2]];
    patientCarePlan = patientCarePlan.map((item) =>
      item.patient_id === patientId && item.id === itemId
        ? {
            ...item,
            ...(body as Partial<PatientCarePlanItem>),
            updated_at: new Date().toISOString(),
          }
        : item
    );
    saveDemoData();
    return patientCarePlan.find((item) => item.id === itemId) as T;
  }

  const patientLabsMatch = path.match(/^\/patients\/([^/]+)\/labs$/);
  if (patientLabsMatch && method === 'GET') {
    const patientId = patientLabsMatch[1];
    const data = patientLabs.filter((lab) => lab.patient_id === patientId);
    return { data, total: data.length } as T;
  }

  const patientLabMatch = path.match(/^\/patients\/([^/]+)\/labs\/([^/]+)$/);
  if (patientLabMatch && method === 'PATCH') {
    const [patientId, labId] = [patientLabMatch[1], patientLabMatch[2]];
    patientLabs = patientLabs.map((lab) =>
      lab.patient_id === patientId && lab.id === labId
        ? { ...lab, ...(body as Partial<PatientLabResult>), updated_at: new Date().toISOString() }
        : lab
    );
    saveDemoData();
    return patientLabs.find((lab) => lab.id === labId) as T;
  }

  if (path === '/tasks') {
    if (method === 'POST') {
      const incoming = body as Partial<Task>;
      const task: Task = withDeliveryDefaults({
        id: uuid(920 + tasks.length),
        title: incoming.title ?? 'New task',
        description: incoming.description ?? null,
        priority: incoming.priority ?? 'normal',
        status: incoming.status ?? 'open',
        due_date: incoming.due_date ?? null,
        assigned_to_id: null,
        assigned_to_name: incoming.assigned_to_name ?? 'Clinic Admin',
        patient_id: incoming.patient_id ?? null,
        patient_name: incoming.patient_name ?? null,
        source_type: incoming.source_type ?? null,
        source_id: incoming.source_id ?? null,
        creator_id: uuid(1),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      tasks = [task, ...tasks];
      logDemoEvent({
        event_type: incoming.description?.includes('Assistant staged')
          ? 'assistant.task_created'
          : 'task.created',
        entity_type: 'task',
        entity_id: task.id,
        payload: {
          title: task.title,
          patient_name: task.patient_name,
          priority: task.priority,
          source: incoming.description?.includes('Assistant staged')
            ? 'clinical-assistant'
            : 'demo-ui',
        },
      });
      saveDemoData();
      return task as T;
    }
    const status = url.searchParams.get('status');
    const filtered = status ? tasks.filter((task) => task.status === status) : tasks;
    return {
      data: paginate(filtered, page, pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    } as T;
  }

  const taskMatch = path.match(/^\/tasks\/([^/]+)$/);
  const taskOutreachMatch = path.match(/^\/tasks\/([^/]+)\/patient-outreach$/);
  if (taskOutreachMatch && method === 'POST') {
    const task = tasks.find((item) => item.id === taskOutreachMatch[1]);
    const patient = patients.find((item) => item.id === task?.patient_id);
    if (!task || !patient) throw new Error('Patient task not found');
    return {
      task_id: task.id,
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      patient_email: patient.email,
      patient_phone: patient.phone,
      preferred_contact_channel: patient.preferred_contact_channel,
      channel_options: [
        outreachChannelOption(patient, 'sms'),
        outreachChannelOption(patient, 'email'),
      ],
      subject: `Follow-up from your care team: ${task.title}`,
      body: `Hi ${patient.first_name},\n\nYour care team is following up on an item from your visit. We are reviewing: ${task.title}.\n\nPlease contact the office if you have new symptoms, medication changes, or questions before we reach you.\n\nThank you,\nYour care team`,
    } as T;
  }

  if (path === '/tasks/patient-outreach/summary' && method === 'GET') {
    return outreachSummary() as T;
  }

  if (path === '/tasks/work-queue' && method === 'GET') {
    return taskWorkQueue() as T;
  }

  const taskOutreachDeliverMatch = path.match(/^\/tasks\/([^/]+)\/patient-outreach\/deliver$/);
  if (taskOutreachDeliverMatch && method === 'POST') {
    const task = tasks.find((item) => item.id === taskOutreachDeliverMatch[1]);
    const patient = patients.find((item) => item.id === task?.patient_id);
    if (!task || !patient) throw new Error('Patient task not found');
    const incoming = body as { channel: 'sms' | 'email'; subject: string; body: string };
    const option = outreachChannelOption(patient, incoming.channel);
    const recipient = option.recipient;
    const deliveryStatus = option.eligible ? 'queued' : 'blocked';
    tasks = tasks.map((item) =>
      item.id === task.id
        ? {
            ...item,
            delivery_channel: incoming.channel,
            delivery_status: deliveryStatus,
            delivery_recipient: recipient,
            delivery_provider_message_id: option.eligible ? `pending-${task.id}` : null,
            delivery_error: option.blocked_reason,
            delivery_attempts: item.delivery_attempts + 1,
            updated_at: new Date().toISOString(),
          }
        : item
    );
    logDemoEvent({
      event_type: 'patient_outreach.staged',
      entity_type: 'task',
      entity_id: task.id,
      payload: {
        patient_id: patient.id,
        channel: incoming.channel,
        recipient,
        subject: incoming.subject,
        delivery_status: deliveryStatus,
        blocked_reason: option.blocked_reason,
      },
    });
    saveDemoData();
    return {
      task_id: task.id,
      patient_id: patient.id,
      channel: incoming.channel,
      delivery_status: deliveryStatus,
      recipient,
      subject: incoming.subject,
      provider_message_id: option.eligible ? `pending-${task.id}` : null,
      attempts: task.delivery_attempts + 1,
      eligible: option.eligible,
      blocked_reason: option.blocked_reason,
      retryable: deliveryStatus === 'blocked',
    } as T;
  }

  if (taskMatch && method === 'PATCH') {
    const previous = tasks.find((task) => task.id === taskMatch[1]);
    const incoming = body as Partial<Task>;
    const assignee =
      incoming.assigned_to_id === null
        ? null
        : incoming.assigned_to_id
          ? demoUsers.find((user) => user.id === incoming.assigned_to_id)
          : undefined;
    tasks = tasks.map((task) =>
      task.id === taskMatch[1]
        ? {
            ...task,
            ...incoming,
            assigned_to_name:
              assignee === null ? null : (assignee?.display_name ?? task.assigned_to_name),
            updated_at: new Date().toISOString(),
          }
        : task
    );
    const updated = tasks.find((task) => task.id === taskMatch[1]);
    if (updated) {
      logDemoEvent({
        event_type: 'task.updated',
        entity_type: 'task',
        entity_id: updated.id,
        payload: {
          title: updated.title,
          previous_status: previous?.status,
          status: updated.status,
          source: 'demo-ui',
        },
      });
    }
    saveDemoData();
    return tasks.find((task) => task.id === taskMatch[1]) as T;
  }

  if (path === '/schedule/appointments') {
    return { data: appointments, total: appointments.length } as T;
  }

  if (path === '/schedule/today-queue') {
    const data = appointments.map((appointment) => {
      const documentsNeedingReview = patientDocuments.filter(
        (document) =>
          document.patient_id === appointment.patient_id && document.status === 'needs_review'
      ).length;
      const openTasks = tasks.filter(
        (task) =>
          task.patient_id === appointment.patient_id && ACTIVE_TASK_STATUSES.includes(task.status)
      );
      const urgentTasks = openTasks.filter((task) => task.priority === 'urgent').length;
      const unsignedEncounters = patientEncounters.filter(
        (encounter) =>
          encounter.patient_id === appointment.patient_id &&
          ['draft', 'provider_review'].includes(encounter.status)
      ).length;
      const medicationsNeedingReview = patientMedications.filter(
        (medication) =>
          medication.patient_id === appointment.patient_id && medication.status === 'review'
      ).length;
      const labsNeedingReview = patientLabs.filter(
        (lab) =>
          lab.patient_id === appointment.patient_id && ['new', 'needs_review'].includes(lab.status)
      ).length;
      const carePlanBlockers = patientCarePlan.filter(
        (item) => item.patient_id === appointment.patient_id && item.status === 'blocked'
      ).length;
      return {
        appointment,
        checkout_readiness: (documentsNeedingReview ||
        urgentTasks ||
        unsignedEncounters ||
        medicationsNeedingReview ||
        labsNeedingReview ||
        carePlanBlockers
          ? 'blocked'
          : 'ready') as TodayQueue['data'][number]['checkout_readiness'],
        blockers: [
          ...(documentsNeedingReview
            ? [`${documentsNeedingReview} outside document needs review`]
            : []),
          ...(urgentTasks ? [`${urgentTasks} urgent task is still open`] : []),
          ...(unsignedEncounters ? [`${unsignedEncounters} encounter note needs sign-off`] : []),
          ...(medicationsNeedingReview
            ? [`${medicationsNeedingReview} medication needs reconciliation`]
            : []),
          ...(labsNeedingReview ? [`${labsNeedingReview} lab result needs review`] : []),
          ...(carePlanBlockers ? [`${carePlanBlockers} care plan item is blocked`] : []),
        ],
        documents_needing_review: documentsNeedingReview,
        open_tasks: openTasks.length,
        urgent_tasks: urgentTasks,
        unsigned_encounters: unsignedEncounters,
        medications_needing_review: medicationsNeedingReview,
        labs_needing_review: labsNeedingReview,
        care_plan_blockers: carePlanBlockers,
      };
    });
    return {
      data,
      total: data.length,
      checked_in: data.filter((item) =>
        ['checked_in', 'roomed', 'provider_review', 'checkout', 'in_progress'].includes(
          item.appointment.status
        )
      ).length,
      blocked: data.filter((item) => item.checkout_readiness === 'blocked').length,
    } satisfies TodayQueue as T;
  }

  if (path === '/schedule/appointments/conflicts/check' && method === 'GET') {
    const providerId = url.searchParams.get('provider_id') ?? '';
    const start = new Date(url.searchParams.get('start_time') ?? '');
    const end = new Date(url.searchParams.get('end_time') ?? '');
    const hasConflict = appointments.some(
      (appointment) =>
        appointment.provider_id === providerId &&
        !['cancelled', 'no_show'].includes(appointment.status) &&
        new Date(appointment.start_time) < end &&
        new Date(appointment.end_time) > start
    );
    const dayOfWeek = start.getDay();
    const hhmm = start.toTimeString().slice(0, 5);
    const endHhmm = end.toTimeString().slice(0, 5);
    const windows = providerAvailability.filter(
      (item) => item.provider_id === providerId && item.day_of_week === dayOfWeek
    );
    const inAvailability =
      windows.length === 0 ||
      windows.some((item) => item.start_time <= hhmm && item.end_time >= endHhmm);
    const warnings = [
      ...(hasConflict ? ['Provider has a conflicting appointment in this time window'] : []),
      ...(!inAvailability ? ['Appointment is outside configured provider availability'] : []),
    ];
    const duration = end.getTime() - start.getTime();
    const suggested_slots: { start_time: string; end_time: string }[] = [];
    let cursor = new Date(start.getTime() + 30 * 60 * 1000);
    for (let index = 0; index < 32 && suggested_slots.length < 3; index += 1) {
      const candidateEnd = new Date(cursor.getTime() + duration);
      const candidateConflict = appointments.some(
        (appointment) =>
          appointment.provider_id === providerId &&
          !['cancelled', 'no_show'].includes(appointment.status) &&
          new Date(appointment.start_time) < candidateEnd &&
          new Date(appointment.end_time) > cursor
      );
      if (!candidateConflict)
        suggested_slots.push({
          start_time: cursor.toISOString(),
          end_time: candidateEnd.toISOString(),
        });
      cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
    }
    return {
      provider_id: providerId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      has_conflict: hasConflict,
      in_availability: inAvailability,
      warnings,
      suggested_slots,
    } as T;
  }

  const availabilityMatch = path.match(/^\/schedule\/availability\/([^/]+)$/);
  if (availabilityMatch && method === 'GET') {
    const data = providerAvailability.filter((item) => item.provider_id === availabilityMatch[1]);
    return data as T;
  }

  if (path === '/schedule/availability' && method === 'POST') {
    const incoming = body as Omit<ProviderAvailability, 'id'>;
    const availability = {
      ...incoming,
      id: uuid(2600 + providerAvailability.length),
    } satisfies ProviderAvailability;
    providerAvailability = [...providerAvailability, availability];
    saveDemoData();
    return availability as T;
  }

  if ((path === '/schedule' || path === '/schedule/appointments') && method === 'POST') {
    const appointment = {
      id: uuid(940),
      patient_id: uuid(104),
      patient_name: 'New Patient',
      provider_id: uuid(2),
      provider_name: 'Dr. Nora Ellis',
      start_time: '2026-06-05T11:00:00-04:00',
      end_time: '2026-06-05T11:30:00-04:00',
      type: 'Office visit',
      status: 'scheduled',
      notes: null,
      ...(body as Partial<Appointment>),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } satisfies Appointment;
    appointments = [...appointments, appointment];
    logDemoEvent({
      event_type: 'appointment.created',
      entity_type: 'appointment',
      entity_id: appointment.id,
      payload: {
        patient_name: appointment.patient_name,
        start_time: appointment.start_time,
        source: 'demo-ui',
      },
    });
    saveDemoData();
    return appointment as T;
  }

  const appointmentMatch = path.match(/^\/schedule\/appointments\/([^/]+)$/);
  if (appointmentMatch && method === 'PATCH') {
    const incoming = body as Partial<Appointment>;
    const appointment = appointments.find((item) => item.id === appointmentMatch[1]);
    if (appointment && incoming.status === 'completed') {
      const documentsNeedingReview = patientDocuments.filter(
        (document) =>
          document.patient_id === appointment.patient_id && document.status === 'needs_review'
      ).length;
      const urgentTasks = tasks.filter(
        (task) =>
          task.patient_id === appointment.patient_id &&
          task.priority === 'urgent' &&
          ACTIVE_TASK_STATUSES.includes(task.status)
      ).length;
      const unsignedEncounters = patientEncounters.filter(
        (encounter) =>
          encounter.patient_id === appointment.patient_id &&
          ['draft', 'provider_review'].includes(encounter.status)
      ).length;
      if (documentsNeedingReview || urgentTasks || unsignedEncounters) {
        throw new Error('Chart blockers must be resolved before completion');
      }
    }
    appointments = appointments.map((appointment) =>
      appointment.id === appointmentMatch[1]
        ? { ...appointment, ...incoming, updated_at: new Date().toISOString() }
        : appointment
    );
    saveDemoData();
    return appointments.find((appointment) => appointment.id === appointmentMatch[1]) as T;
  }

  const appointmentReminderMatch = path.match(/^\/schedule\/appointments\/([^/]+)\/reminders$/);
  if (appointmentReminderMatch && method === 'POST') {
    const appointment = appointments.find((item) => item.id === appointmentReminderMatch[1]);
    if (!appointment) throw new Error('Appointment not found');
    const channels = clinicSettings.reminder_offsets_minutes.flatMap((offset) =>
      ['sms', 'email'].map((channel) => ({ channel, offset }))
    );
    const eventIds = channels.map(({ channel, offset }, index) => {
      const eventId = uuid(2700 + integrationEvents.length + index);
      integrationEvents = [
        {
          id: eventId,
          organization_id: uuid(900),
          integration: 'communications',
          direction: 'outbound',
          action: `appointment.reminder.${channel}`,
          status: 'pending',
          entity_type: 'appointment',
          entity_id: appointment.id,
          idempotency_key: `demo:appointment:reminder:${channel}:${offset}:${appointment.id}`,
          attempts: 1,
          error: null,
          payload: {
            patient_id: appointment.patient_id,
            appointment_start: appointment.start_time,
            channel,
            offset_minutes: offset,
            sender_identity: clinicSettings.sender_identity,
            template:
              channel === 'sms'
                ? clinicSettings.reminder_sms_template
                : clinicSettings.reminder_email_template,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...integrationEvents,
      ];
      return eventId;
    });
    saveDemoData();
    return { appointment_id: appointment.id, queued: eventIds.length, event_ids: eventIds } as T;
  }

  if (path === '/faxes') {
    if (method === 'POST') {
      const incoming = body as Partial<Fax>;
      const fax: Fax = {
        id: uuid(960 + faxes.length),
        direction: 'outbound',
        status: 'pending',
        from_number: '+13125550999',
        to_number: incoming.to_number ?? '+13125550000',
        pages: incoming.pages ?? 1,
        file_url: null,
        patient_id: incoming.patient_id ?? null,
        patient_name: incoming.patient_name ?? null,
        matched_by: incoming.patient_id ? 'manual' : null,
        ocr_text: incoming.ocr_text ?? 'Queued outbound fax.',
        created_at: new Date().toISOString(),
      };
      faxes = [fax, ...faxes];
      logDemoEvent({
        event_type: 'fax.created',
        entity_type: 'fax',
        entity_id: fax.id,
        payload: {
          direction: fax.direction,
          patient_name: fax.patient_name,
          pages: fax.pages,
          source: 'demo-ui',
        },
      });
      saveDemoData();
      return fax as T;
    }
    const direction = url.searchParams.get('direction');
    const filtered = direction ? faxes.filter((fax) => fax.direction === direction) : faxes;
    return {
      data: paginate(filtered, page, pageSize),
      total: filtered.length,
      page,
      page_size: pageSize,
    } as T;
  }

  const faxMatch = path.match(/^\/faxes\/([^/]+)$/);
  if (faxMatch && method === 'PATCH') {
    faxes = faxes.map((fax) =>
      fax.id === faxMatch[1] ? { ...fax, ...(body as Partial<Fax>) } : fax
    );
    const updated = faxes.find((fax) => fax.id === faxMatch[1]);
    if (updated) {
      logDemoEvent({
        event_type: updated.matched_by?.includes('assistant')
          ? 'assistant.fax_match_staged'
          : 'fax.updated',
        entity_type: 'fax',
        entity_id: updated.id,
        payload: {
          patient_name: updated.patient_name,
          matched_by: updated.matched_by,
          pages: updated.pages,
          source: updated.matched_by?.includes('assistant') ? 'clinical-assistant' : 'demo-ui',
        },
      });
    }
    saveDemoData();
    return faxes.find((fax) => fax.id === faxMatch[1]) as T;
  }

  if (path === '/messages/threads') {
    const data = threads();
    return { data, total: data.length } as T;
  }

  const threadMatch = path.match(/^\/messages\/threads\/([^/]+)$/);
  if (threadMatch) {
    return messages.filter((message) => message.thread_id === threadMatch[1]) as T;
  }

  if (path === '/messages' && method === 'POST') {
    const incoming = body as {
      recipient_id: string;
      subject: string;
      body: string;
      thread_id?: string;
    };
    const message: Message = {
      id: uuid(700 + messages.length),
      sender_id: uuid(1),
      sender_name: 'Clinic Admin',
      recipient_id: incoming.recipient_id,
      recipient_name: 'Care Team',
      subject: incoming.subject,
      body: incoming.body,
      thread_id: incoming.thread_id ?? uuid(800 + messages.length),
      is_read: true,
      created_at: new Date().toISOString(),
    };
    messages = [...messages, message];
    logDemoEvent({
      event_type: incoming.body.includes('your care team is reviewing')
        ? 'assistant.message_drafted'
        : 'message.created',
      entity_type: 'message',
      entity_id: message.id,
      payload: {
        subject: message.subject,
        recipient_id: message.recipient_id,
        thread_id: message.thread_id,
        source: incoming.body.includes('your care team is reviewing')
          ? 'clinical-assistant'
          : 'demo-ui',
      },
    });
    saveDemoData();
    return message as T;
  }

  return undefined;
}

function csvCell(value: string) {
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function scopeAcceptancePacket(): ScopeAcceptancePacket {
  const parity: ScopeAcceptancePacket['parity_matrix'] = [
    { feature: 'Patient chart', drchrono: true, concierge_os: true, gaps: '', owner: null },
    { feature: 'Scheduling', drchrono: true, concierge_os: true, gaps: '', owner: null },
    { feature: 'Documents', drchrono: true, concierge_os: true, gaps: '', owner: null },
    { feature: 'Messages', drchrono: true, concierge_os: true, gaps: '', owner: null },
    {
      feature: 'Fax',
      drchrono: true,
      concierge_os: true,
      gaps: 'External vendor required',
      owner: 'operations',
    },
    {
      feature: 'Billing',
      drchrono: true,
      concierge_os: true,
      gaps: 'Clearinghouse integration required',
      owner: 'operations',
    },
    {
      feature: 'Labs',
      drchrono: true,
      concierge_os: true,
      gaps: 'Labs/HIE integration required',
      owner: 'operations',
    },
    {
      feature: 'Prescriptions',
      drchrono: true,
      concierge_os: true,
      gaps: 'eRx integration required',
      owner: 'operations',
    },
    { feature: 'Reporting', drchrono: true, concierge_os: true, gaps: '', owner: null },
    {
      feature: 'Staff administration',
      drchrono: true,
      concierge_os: true,
      gaps: 'Identity/MFA integration required',
      owner: 'operations',
    },
  ];
  const gaps = parity.filter((p) => p.gaps);
  return {
    packet_id: uuid(9000),
    generated_at: iso(),
    generated_by: 'Demo Manager',
    status: gaps.length > 0 ? 'blocked' : 'accepted',
    parity_matrix: parity,
    outage_reduction_targets: [
      {
        target: 'Planned downtime',
        goal: '< 15 minutes per month',
        fallback: 'DrChrono read-only mode',
        owner: 'operations',
      },
      {
        target: 'Unplanned downtime',
        goal: '< 5 minutes RTO',
        fallback: 'DrChrono read-only mode',
        owner: 'operations',
      },
      {
        target: 'Data loss',
        goal: 'Zero',
        fallback: 'Daily backups + 4-hour RPO',
        owner: 'operations',
      },
    ],
    rollback_scorecard: {
      criteria: [
        { item: 'Go-Live Packet approved', required: true, pass: false },
        { item: 'Backup validated within 24h', required: true, pass: false },
        { item: 'Staff trained and signed off', required: true, pass: false },
        { item: 'Vendor credentials staged', required: true, pass: false },
        { item: 'DrChrono freeze plan documented', required: true, pass: false },
        { item: 'Rollback owner assigned', required: true, pass: false },
      ],
      approval_required_from: ['clinic_owner', 'operations_manager'],
    },
    gaps,
    gap_count: gaps.length,
    signoff_required_from: ['clinic_owner'],
    export_filename: 'concierge-os-scope-acceptance-packet.json',
  };
}

function drchronoMigrationPacket(): DrChronoMigrationPacket {
  return {
    packet_id: uuid(9001),
    generated_at: iso(),
    generated_by: 'Demo Manager',
    status: 'blocked',
    dry_run_analysis: {
      total_rows_analyzed: 0,
      create_count: 0,
      update_count: 0,
      skip_count: 0,
      duplicate_count: 0,
      missing_dependency_count: 0,
      needs_review_count: 0,
      sections: {
        patients: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
        appointments: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
        documents: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
        billing: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
        medications: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
        labs: { total: 0, create: 0, update: 0, skip: 0, errors: [] },
      },
      accepted_gaps: [],
      fallback_owner: null,
      freeze_timing: null,
      sample_chart_reviewed: false,
      clinic_sign_off: false,
    },
    import_batches: [],
    write_import_blocked: true,
    write_import_block_reason:
      'Final write import is blocked until: (1) production migration approval, (2) final DrChrono export reconciliation, and (3) a write-capable importer exists.',
    export_filename: 'concierge-os-drchrono-migration-packet.json',
  };
}

let demoDrchronoDryRuns: DrChronoMigrationDryRun[] = [];
let demoImportBatches: DrChronoImportBatch[] = [];

function runDrchronoMigrationDryRun(data: DrChronoMigrationDryRunStart): DrChronoMigrationDryRun {
  const dryRunId = uuid(9002 + demoDrchronoDryRuns.length);
  const analysis = drchronoMigrationPacket().dry_run_analysis;
  analysis.total_rows_analyzed = data.total_rows ?? 0;
  analysis.create_count = data.create_count ?? 0;
  analysis.update_count = data.update_count ?? 0;
  analysis.skip_count = data.skip_count ?? 0;
  analysis.duplicate_count = data.duplicate_count ?? 0;
  analysis.missing_dependency_count = data.missing_dependency_count ?? 0;
  analysis.needs_review_count = data.needs_review_count ?? 0;
  if (data.sections) {
    for (const [section, values] of Object.entries(data.sections)) {
      if (analysis.sections[section]) {
        analysis.sections[section] = { ...analysis.sections[section], ...values };
      }
    }
  }
  const dryRun: DrChronoMigrationDryRun = {
    dry_run_id: dryRunId,
    analysis,
    event_id: uuid(9100 + demoDrchronoDryRuns.length),
    generated_at: iso(),
  };
  demoDrchronoDryRuns.push(dryRun);
  return dryRun;
}

function createDrchronoImportBatch(data: DrChronoImportBatchCreate): DrChronoImportBatch {
  const batch: DrChronoImportBatch = {
    batch_id: uuid(9200 + demoImportBatches.length),
    status: 'planned',
    mode: 'no_write',
    section: data.section ?? 'patients',
    create_count: data.create_count ?? 0,
    update_count: data.update_count ?? 0,
    skip_count: data.skip_count ?? 0,
    error_count: data.error_count ?? 0,
    summary: data.summary ?? '',
    source_dry_run_id: data.source_dry_run_id ?? null,
    note: data.note ?? null,
    created_by: 'Demo Manager',
    created_at: iso(),
    event_id: uuid(9300 + demoImportBatches.length),
  };
  demoImportBatches.push(batch);
  return batch;
}

function listDrchronoImportBatches(): DrChronoImportBatchList {
  return { data: demoImportBatches, total: demoImportBatches.length };
}
