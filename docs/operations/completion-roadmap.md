# Completion Roadmap

This roadmap defines the remaining path from the current Concierge OS worktree to a production clinical replacement for DrChrono at the target clinic. It is intentionally stricter than a demo roadmap: live patient use waits until infrastructure, migration, identity, compliance, and production vendor evidence are all complete.

## Current Baseline

- Concierge OS has local/demo workflows for Command Center, patient charts, document intake, portal intake, scheduling, tasks, billing work queues, reports, audit review, staff role review, Operations evidence, and launch readiness.
- Operations already includes Go-Live Packet, Launch Workplan, Live-Use Rehearsal Board, Production Config Audit, Credential Dry-Run Binder, Vendor Credential Request Packet, Adapter Implementation Packet, Integration Cutover Readiness Packet, DrChrono Migration Packet, DrChrono migration dry-run analysis, browser QA, role dry-run, staff training, policy approval, restore drill, cutover runbook, vendor handoff archive, and production rehearsal evidence.
- DrChrono is treated as the legacy migration source, not the long-term system of record.
- Remaining blockers are real external accounts, vendor credentials and BAAs, production infrastructure, live data exports, staff validation, legal/compliance approval, and final clinic go/no-go evidence.

## Completion Phases

### Phase 0: Scope Freeze And Acceptance

**Goal:** Freeze the exact DrChrono replacement scope for the clinic before production work broadens.

**Build items:**

- Maintain this roadmap as the top-level completion plan.
- Convert current DrChrono feature expectations into a parity matrix for patient chart, scheduling, documents, messages, fax, billing, labs, prescriptions, reporting, and staff administration.
- Define an outage-reduction operating target, including expected uptime, vendor fallback behavior, manual downtime packet, and support escalation ownership.
- Define the launch acceptance scorecard the clinic owner will sign.
- Completed: `/api/operations/scope-acceptance-packet` now produces the DrChrono parity matrix, outage targets, rollback/signoff scorecard, and exportable blocked evidence for Phase 0 scope acceptance before production credentials are used.

**External inputs:** Clinic workflow validation, owner names, role coverage, current DrChrono pain points, and go/no-go approvers.

**Exit criteria:** Scope, acceptance scorecard, and rollback expectations are signed off before production credentials are used.

### Phase 1: Production Foundation

**Goal:** Stand up a production environment that can safely hold PHI.

**Build items:**

- Provision managed Postgres, Redis with TLS, S3-compatible object storage with KMS/encryption, production secret storage, structured logs, alert routing, and backup storage.
- Configure `APP_ENV=production`, `AUTO_CREATE_SCHEMA=false`, `ALLOW_SEED_ENDPOINT=false`, production CORS, webhook signing, and unique production secrets.
- Smoke-test container or deployment profile with migrations, health checks, and `scripts/health-report.sh`.
- Run backup and restore against a disposable stack and record restore drill evidence.

**External inputs:** Cloud account, BAA, DNS, production host, alert destination, and backup retention owner.

**Exit criteria:** `/api/operations/production-config-audit`, `/api/ready`, backup evidence, restore evidence, and deployment runbook ownership are ready.

### Phase 2: Identity And Staff Access

**Goal:** Make staff access production-safe before live data appears.

**Build items:**

- Connect the chosen identity provider or production MFA workflow.
- Map clinic roles to Concierge OS roles and Staff Role Access Matrix expectations.
- Verify user provisioning, temporary credential expiry, password recovery, emergency access, MFA enforcement, and deprovisioning.
- Review privileged access and sensitive audit categories with clinic management.

**External inputs:** Identity provider account, staff roster, MFA policy, emergency access owner, and clinic manager approval.

**Exit criteria:** Production login blocks non-MFA staff, role coverage warnings are resolved or assigned, and access-review evidence is current.

### Phase 3: DrChrono Migration Lane

**Goal:** Move the clinic off DrChrono with measured, reviewable migration evidence.

**Build items:**

- Use `/api/operations/drchrono-migration-packet/dry-run` against exported DrChrono CSV files to measure patients, appointments, documents, clinical notes, medications, allergies, problems, labs, billing, and communications.
- Add import planner from dry-run output so each row is classified as create, update, skip, duplicate, missing dependency, or needs clinic review before any write import runs.
- Add migration batch execution after the planner exists, with resumable imports, row-level errors, sample chart review, and final counts.
- Completed: `/api/operations/drchrono-migration-packet/import-batches` now records a no-write planner-derived import batch artifact with create/update/skip/error counts, per-section summaries, source dry-run linkage, and audit evidence before any final write import is allowed. Final import mode stays blocked in this no-write endpoint until production migration approval, final DrChrono export reconciliation, and a write-capable importer are available.
- Record accepted gaps, fallback owner, DrChrono read-only/freeze timing, sample chart review, and clinic sign-off in the DrChrono Migration Packet.

**External inputs:** DrChrono API/export access, complete export files, attachment/document files, clinic chart-review staff, final DrChrono freeze window, and DrChrono fallback owner.

**Exit criteria:** Dry migration is clean or accepted, sample charts match, counts reconcile, final freeze is scheduled, and `/api/operations/drchrono-migration-packet` is exported into Go-Live Packet evidence.

### Phase 4: Native Clinical Workflow Completion

**Goal:** Make daily clinic work complete enough that staff do not need DrChrono for routine operations.

**Build items:**

- Close remaining gaps in patient chart, schedule, tasks, document review, intake, checkout, billing queue, reports, messaging, and daily closeout workflows.
- Verify each role can complete a dry-run day from Command Center through closeout.
- Expand browser QA for any workflow that becomes part of the signed acceptance scorecard.
- Keep assistant actions confirmation-gated and audit-backed.

**External inputs:** Staff workflow review, clinic-specific language, and acceptance examples from real appointments.

**Exit criteria:** Browser QA, role dry-run, staff training, policy approval, and daily closeout review are complete with no blocking evidence.

### Phase 5: Replacement External Accounts And Adapters

**Goal:** Replace DrChrono-dependent external functions with production vendor lanes.

**Build items:**

- Decide and connect production accounts for cloud/object storage, identity/MFA, SMS/voice/email, fax, clearinghouse/eligibility, labs/HIE, payments, and optional calendar or AI runtime.
- Implement vendor-backed adapters behind the existing integration contracts.
- Add queue, retry, webhook verification, manual fallback, and audit evidence for each live lane.
- Use Credential Dry-Run Binder, Vendor Credential Request Packet, Adapter Implementation Packet, and Integration Cutover Readiness Packet to track each lane.

**External inputs:** Vendor accounts, BAAs, API keys, callback URLs, enrollment approvals, sandbox references, support contacts, and go-live windows.

**Exit criteria:** Every live integration reports `readiness_mode: production_vendor` and `production_ready=true`; no placeholder adapter, missing credential, unresolved blocking vendor risk, or unarchived vendor handoff remains.

### Phase 6: Billing And Revenue Cycle Readiness

**Goal:** Make billing operational enough for real revenue work instead of demo-only charge review.

**Build items:**

- Connect clearinghouse eligibility checks, claim submission, claim status, denial/rework, ERA/remittance import, and payment reconciliation.
- Verify billing closeout, failed submission recovery, payer enrollment blockers, and remittance reconciliation.
- Record sandbox and production-vendor evidence in the integration packets.

**External inputs:** Clearinghouse account, payer enrollment, billing owner, remittance setup, and payment account.

**Exit criteria:** Eligibility, claims, denial handling, remittance, and reconciliation have passing vendor evidence and billing owner sign-off.

### Phase 7: Compliance And Operating Procedures

**Goal:** Ensure the clinic can operate the system under clinical, privacy, and incident obligations.

**Build items:**

- Finalize PHI retention, incident response, access review, session policy, backup/restore, deployment ownership, patient outreach consent, assistant policy, and downtime procedures.
- Record staff training evidence for front desk, MA/nurse, provider, billing, and manager roles.
- Confirm audit export review cadence and incident escalation ownership.

**External inputs:** Clinic owner, compliance/legal reviewer, staff training schedule, and incident contacts.

**Exit criteria:** Policy approval evidence and staff training evidence are complete and current.

### Phase 8: Rehearsals

**Goal:** Prove the cutover path in a production-like environment before final launch.

**Build items:**

- Run a full dry-run day with production-like infrastructure and vendor sandbox or pre-production lanes.
- Save Live-Use Rehearsal Board, Launch Workplan, Production Rehearsal Report, Restore Drill, Cutover Runbook, browser QA, role dry-run, staff training, and policy evidence.
- Assign and clear every warning, blocker, and unassigned launch item.

**External inputs:** Clinic staff availability, production-like environment, vendor test windows, and manager review time.

**Exit criteria:** Go-Live Packet has no blocking or warning evidence except final approval timing.

### Phase 9: Production Cutover

**Goal:** Switch the clinic from DrChrono to Concierge OS with an auditable go/no-go record.

**Build items:**

- Take final DrChrono export, enter DrChrono read-only/freeze, run final import, reconcile counts, sample charts, attachments, appointments, and billing handoff state.
- Switch DNS/secrets/vendor callbacks as needed.
- Run health report, production config audit, ready check, integration preflight, and daily workflow smoke checks.
- Keep support watch active through first-day closeout.

**External inputs:** Clinic go/no-go approver, vendor support windows, final DrChrono export, and rollback owner.

**Exit criteria:** Go-Live Packet is approved, first-day closeout is clear, and rollback remains available until clinic owner accepts stabilization.

### Phase 10: Post-Go-Live Stabilization

**Goal:** Keep the first production period quiet, measurable, and reversible.

**Build items:**

- Review incidents, adapter retries, failed webhooks, billing errors, closeout risks, audit categories, backup freshness, and staff feedback daily.
- Patch launch blockers quickly and record evidence.
- Run a two-week stabilization review covering outages avoided, workflow misses, vendor issues, and next feature priorities.

**External inputs:** Clinic feedback, vendor support, billing review, and compliance review as needed.

**Exit criteria:** Two weeks of stable clinic operation with no critical daily blockers, no unresolved PHI/security incidents, current backups, and accepted post-launch backlog.

## Do Not Proceed To Real Patients Until

- Production infrastructure, deployment, health checks, and rollback path pass.
- Real backup and restore have been tested and recorded.
- DrChrono migration dry-run, sample chart review, accepted gaps, DrChrono read-only/freeze plan, and clinic sign-off are complete.
- Production vendor accounts, BAAs, credentials, callback URLs, and support contacts are in place.
- Identity/MFA and role access review are production-ready.
- Staff training and policy approvals are complete.
- Go-Live Packet is approved and newer evidence has not invalidated the approval.
- Manual downtime and DrChrono fallback/read-only procedures are ready.

## Immediate Next Build Items

1. Completed: Add import planner from dry-run output so DrChrono exports can be classified before any write import.
2. Completed: Add a DrChrono migration UI panel in Operations for latest dry-run findings, import planner summaries, migration packet gates, and export readiness.
3. Completed: Add audit-backed migration sessions for sample chart review, accepted gap approval, import batch status, and clinic sign-off.
4. Completed: Add production object-storage adapter configuration/runbook coverage for signed upload and download validation.
4a. Completed: Add audit-backed DrChrono import batch records from the latest dry-run planner so create/update/skip/error counts are visible before final migration, while explicitly blocking no-write `final` import batches until real write execution evidence exists.
4b. Completed: Expand `/api/launch-readiness` critical integration gates so Labs/HIE, payments, and Identity/MFA cannot be omitted from production go-live scoring.
4c. Completed: Require cutover runbook sessions to carry a cutover owner and scheduled cutover time before they can count as ready Go-Live Packet evidence.
4d. Completed: Require role dry-run sessions to carry facilitator and session-date metadata before staff workflow coverage can count as ready Go-Live Packet evidence.
5. In progress: Implement replacement production adapter lanes with queue/retry, webhook signature verification, manual fallback, and integration packet evidence. The EHR lane now records distinct local evidence for patient search, demographics sync, medication sync, lab import, and encounter writeback while DrChrono remains the legacy migration source. The fax lane now records outbound queue/retry integration events, applies signed fax webhooks into outbound delivery status or inbound fax review records, documents manual fallback, and surfaces the required methods in the vendor adapter packet. The portal lane now records intake received, patient application, document conversion, and appointment conversion events with manual portal intake fallback instructions; its sandbox adapter records distinct message, thread lookup, intake webhook, and document import evidence references. The CopilotKit assistant lane now records distinct runtime health, tenant authorization, tool allowlist, and audit-capture sandbox evidence references while preserving confirmation-gated actions. The communications lane now records consent-approved queued outreach and consent/recipient blockers as integration events with retry metadata, signed callback application, and manual patient-callback fallback instructions; its sandbox adapter records distinct send, queued-callback, delivered-callback, failed/blocked-callback, retry-state, and manual-fallback evidence references. The clearinghouse lane now records eligibility checks, claim submissions, denial callbacks, denial rework retry readiness, and remittance/payment imports as clearinghouse integration events with payer portal or phone fallback instructions; its sandbox adapter records distinct eligibility, claim submission, denial callback, denial rework retry, payment callback, remittance import, and manual payer fallback evidence references. The Labs/HIE lane now appears in credential preflight and records external lab result import/review events with manual lab portal fallback instructions; its sandbox adapter records distinct lab order, result import, abnormal-result review, result document handoff, and manual lab portal fallback evidence references. The payments lane now appears in credential preflight and records patient payment reconciliation separately from clearinghouse remittance with manual terminal or portal fallback instructions; its sandbox adapter records distinct payment-intent, payment-webhook, billing-reconciliation, refund-status, and manual payment fallback evidence references. Prescriptions/eRx now appears in credential preflight with eligibility, medication history, prescription transmission, status callback, and manual pharmacy fallback contract checks; its sandbox adapter records distinct eligibility, medication-history, prescription-transmission, status-callback, and manual pharmacy fallback evidence references. Live production readiness still requires real fax, portal, communications, clearinghouse, Labs/HIE, payments, certified eRx, and production assistant-runtime vendor adapters/accounts, credentials, sandbox references, callback URLs, BAAs, enrollment approvals, prescriber identity proofing, approved tool policy, and support contacts.
6. Completed: Add Scope Acceptance Packet coverage for DrChrono parity scope, outage-reduction targets, rollback expectations, legal/compliance review, staff validation, and clinic owner signoff blockers.

## External Account Decision Order

1. Cloud infrastructure account with BAA, production host, DNS, database, Redis, object storage, secrets, logs, and backups.
2. Identity/MFA provider for staff authentication and access policy.
   - In progress: Identity/MFA now appears in credential preflight with staff provisioning, MFA policy, deprovisioning, emergency access, and access-review contract checks. The sandbox adapter records distinct provisioning, MFA, deprovisioning, emergency-access, and access-review evidence references. Production login already blocks non-MFA staff through local policy, but live readiness still requires the clinic's chosen identity provider account, issuer/client configuration, MFA policy approval, staff roster mapping, and emergency access owner.
3. SMS/voice/email communications vendor for patient outreach and callbacks.
4. Fax vendor for inbound/outbound clinical documents.
5. Clearinghouse and eligibility vendor for claims, payer enrollment, denials, and remittance.
6. Labs/HIE vendor for lab order/result workflows and external clinical data.
7. Payments vendor for patient payments and reconciliation if in scope for launch.
8. Certified eRx vendor for medication history, prescription transmission, status callbacks, and prescriber identity proofing if prescriptions are in launch scope.
9. Calendar and AI runtime accounts only after core clinical and revenue lanes are production-ready.
   - In progress: Calendar scheduling now records appointment create/update integration events with manual calendar reconciliation fallback instructions. The sandbox adapter records distinct create, update/cancel, availability/conflict, and reminder source-of-truth evidence references. Live readiness still requires the chosen Google/Microsoft/calendar vendor account, callback URLs if used, sandbox references, support owner, and cutover timing.
   - In progress: CopilotKit runtime now records distinct runtime health, tenant/user authorization, tool allowlist, and audit-capture sandbox evidence references. Live readiness still requires the production runtime URL, approved model/tool policy, tenant forwarding validation, audit review, and support owner.
