# Completion Roadmap

Canonical path: `docs/operations/completion-roadmap.md`

This is the top-level roadmap for taking Concierge OS from the current local/demo-ready state to a production clinical replacement for DrChrono at the target clinic. It is intentionally stricter than a demo plan: live patient use waits until infrastructure, migration, identity, compliance, vendor evidence, staff validation, and clinic go/no-go approval are complete.

## Agent Navigation

Use these paths first when another agent needs to find the right file:

- Roadmap and stopping point: `docs/operations/completion-roadmap.md`
- Production launch checklist: `docs/operations/production-launch-checklist.md`
- Daily workflow readiness: `docs/operations/daily-use-readiness.md`
- Deployment runbook: `docs/operations/deployment-runbook.md`
- Compliance procedures: `docs/compliance/phi-retention-and-incident-response.md`
- Vendor adapter plan: `docs/integrations/vendor-adapter-plan.md`
- Operations backend service: `apps/api/app/services/operations_service.py`
- Launch readiness backend service: `apps/api/app/services/launch_readiness_service.py`
- Integration readiness backend service: `apps/api/app/services/integration_config_service.py`
- Operations API router: `apps/api/app/routers/operations.py`
- Operations API schemas: `apps/api/app/schemas/operations.py`
- Operations UI: `apps/web/src/router/routes/operations/index.tsx`
- Demo/offline API parity: `apps/web/src/lib/demo-api.ts`
- Shared operations types: `packages/shared/src/types/operations.ts`
- Product maturity tests: `apps/api/tests/routers/test_product_maturity.py`
- Readiness tests: `apps/api/tests/test_readiness.py`

## Current Stopping Point

Current committed checkpoint in the Codex worktree: `2ef2cbf feat: require role dry-run metadata`.

That checkpoint added:

- Role dry-run Go-Live Packet evidence now requires a facilitator and session date.
- Cutover runbook evidence already requires cutover owner and scheduled cutover time.
- No-write final DrChrono import batches are blocked until production migration approval, final DrChrono export reconciliation, and a write-capable importer exist.
- Launch readiness requires extended clinical integrations, including Labs/HIE, payments, Identity/MFA, and eRx.
- Adapter evidence contracts have been hardened across EHR, fax, portal, communications, clearinghouse, Labs/HIE, payments, eRx, identity, calendar, and CopilotKit runtime lanes.

**Subsequent work completed (not yet in a tagged release):**

- Phase 5 adapter hardening: Added 4 missing integration adapters (`labs_hie`, `payments`, `erx`, `identity`) with sandbox stubs and production placeholders. All 11 lanes now have adapter contracts.
- Phase 3 DrChrono migration: Built `drchrono-migration-packet` and `scope-acceptance-packet` endpoints with dry-run analysis, import batch tracking, write-import blocker, CSV export, and audit logging.
- Phase 4 native workflows: Verified existing checklists cover all 5 clinic roles (front desk, MA/nurse, provider, billing, manager) with no gaps.
- Full layer sync: Updated `operations_service.py`, `operations.py` router, `operations.py` schemas, `demo-api.ts`, `packages/shared/src/types/operations.ts`, `config.py`, `integration_config_service.py`, `launch_readiness_service.py`, and `sandbox.py`.
- Tests: Added integration tests for all 4 new sandbox adapters; all pass.

Files modified in this work block:
- `apps/api/app/integrations/labs_hie.py` (new)
- `apps/api/app/integrations/payments.py` (new)
- `apps/api/app/integrations/erx.py` (new)
- `apps/api/app/integrations/identity.py` (new)
- `apps/api/app/integrations/factory.py`
- `apps/api/app/integrations/sandbox.py`
- `apps/api/app/config.py`
- `apps/api/app/services/integration_config_service.py`
- `apps/api/app/services/launch_readiness_service.py`
- `apps/api/app/services/operations_service.py`
- `apps/api/app/routers/operations.py`
- `apps/api/app/schemas/operations.py`
- `apps/web/src/lib/demo-api.ts`
- `packages/shared/src/types/operations.ts`
- `apps/api/tests/test_integrations.py`

The main checkout now also contains this roadmap at `docs/operations/completion-roadmap.md` so other agents can locate it without needing the Codex worktree path.

## Current Baseline

- Concierge OS has local/demo workflows for Command Center, patient charts, document intake, portal intake, scheduling, tasks, billing work queues, reports, audit review, staff role review, Operations evidence, and launch readiness.
- Operations includes Go-Live Packet, Launch Workplan, Live-Use Rehearsal Board, Production Config Audit, Credential Dry-Run Binder, Vendor Credential Request Packet, Adapter Implementation Packet, Integration Cutover Readiness Packet, DrChrono Migration Packet, DrChrono migration dry-run analysis, browser QA, role dry-run, staff training, policy approval, restore drill, cutover runbook, vendor handoff archive, production rehearsal evidence, and scope acceptance evidence.
- DrChrono is the legacy migration source, not the long-term system of record.
- Remaining blockers are real external accounts, vendor credentials and BAAs, production infrastructure, live data exports, staff validation, legal/compliance approval, and final clinic go/no-go evidence.

## Do Not Proceed To Real Patients Until

- Production infrastructure, deployment, health checks, and rollback path pass.
- Real backup and restore have been tested and recorded.
- DrChrono migration dry-run, sample chart review, accepted gaps, DrChrono read-only/freeze plan, and clinic sign-off are complete.
- Production vendor accounts, BAAs, credentials, callback URLs, and support contacts are in place.
- Identity/MFA and role access review are production-ready.
- Staff training and policy approvals are complete.
- Go-Live Packet is approved and newer evidence has not invalidated the approval.
- Manual downtime and DrChrono fallback/read-only procedures are ready.

## Phase Roadmap

### Phase 0: Scope Freeze And Acceptance

Goal: freeze the exact DrChrono replacement scope for the clinic before production work broadens.

Build items:

- Maintain this roadmap as the top-level completion plan.
- Convert current DrChrono feature expectations into a parity matrix for patient chart, scheduling, documents, messages, fax, billing, labs, prescriptions, reporting, and staff administration.
- Define outage-reduction targets, vendor fallback behavior, manual downtime packet, and support escalation ownership.
- Define the launch acceptance scorecard the clinic owner will sign.
- Completed: `/api/operations/scope-acceptance-packet` produces the DrChrono parity matrix, outage targets, rollback/signoff scorecard, and exportable blocked evidence before production credentials are used.

External inputs: clinic workflow validation, owner names, role coverage, current DrChrono pain points, and go/no-go approvers.

Exit criteria: scope, acceptance scorecard, and rollback expectations are signed off before production credentials are used.

### Phase 1: Production Foundation

Goal: stand up a production environment that can safely hold PHI.

Build items:

- Provision managed Postgres, Redis with TLS, S3-compatible object storage with KMS/encryption, production secret storage, structured logs, alert routing, and backup storage.
- Configure `APP_ENV=production`, `AUTO_CREATE_SCHEMA=false`, `ALLOW_SEED_ENDPOINT=false`, production CORS, webhook signing, and unique production secrets.
- Smoke-test container or deployment profile with migrations, health checks, and `scripts/health-report.sh`.
- Run backup and restore against a disposable stack and record restore drill evidence.

External inputs: cloud account, BAA, DNS, production host, alert destination, and backup retention owner.

Exit criteria: `/api/operations/production-config-audit`, `/api/ready`, backup evidence, restore evidence, and deployment runbook ownership are ready.

### Phase 2: Identity And Staff Access

Goal: make staff access production-safe before live data appears.

Build items:

- Connect the chosen identity provider or production MFA workflow.
- Map clinic roles to Concierge OS roles and Staff Role Access Matrix expectations.
- Verify user provisioning, temporary credential expiry, password recovery, emergency access, MFA enforcement, and deprovisioning.
- Review privileged access and sensitive audit categories with clinic management.

External inputs: identity provider account, staff roster, MFA policy, emergency access owner, and clinic manager approval.

Exit criteria: production login blocks non-MFA staff, role coverage warnings are resolved or assigned, and access-review evidence is current.

### Phase 3: DrChrono Migration Lane

Goal: move the clinic off DrChrono with measured, reviewable migration evidence.

Build items:

- Use `/api/operations/drchrono-migration-packet/dry-run` against exported DrChrono CSV files.
- Keep each exported row classified as create, update, skip, duplicate, missing dependency, or needs clinic review before write import.
- Add final write migration execution only after planner output, resumable imports, row-level errors, sample chart review, and final counts are ready.
- Completed: `/api/operations/drchrono-migration-packet/import-batches` records no-write planner-derived import batch artifacts with create/update/skip/error counts, per-section summaries, source dry-run linkage, and audit evidence.
- Completed: final import mode stays blocked in the no-write endpoint until production migration approval, final DrChrono export reconciliation, and a write-capable importer are available.
- Record accepted gaps, fallback owner, DrChrono read-only/freeze timing, sample chart review, and clinic sign-off in the DrChrono Migration Packet.

External inputs: DrChrono API/export access, complete export files, attachment/document files, clinic chart-review staff, final DrChrono freeze window, and DrChrono fallback owner.

Exit criteria: dry migration is clean or accepted, sample charts match, counts reconcile, final freeze is scheduled, and `/api/operations/drchrono-migration-packet` is exported into Go-Live Packet evidence.

### Phase 4: Native Clinical Workflow Completion

Goal: make daily clinic work complete enough that staff do not need DrChrono for routine operations.

Build items:

- Close remaining gaps in patient chart, schedule, tasks, document review, intake, checkout, billing queue, reports, messaging, and daily closeout workflows.
- Verify each role can complete a dry-run day from Command Center through closeout.
- Expand browser QA for any workflow that becomes part of the signed acceptance scorecard.
- Keep assistant actions confirmation-gated and audit-backed.
- Completed: role dry-run evidence now requires facilitator and session-date metadata before it can count as ready Go-Live Packet evidence.

External inputs: staff workflow review, clinic-specific language, and acceptance examples from real appointments.

Exit criteria: browser QA, role dry-run, staff training, policy approval, and daily closeout review are complete with no blocking evidence.

### Phase 5: Replacement External Accounts And Adapters

Goal: replace DrChrono-dependent external functions with production vendor lanes.

Build items:

- Decide and connect production accounts for cloud/object storage, identity/MFA, SMS/voice/email, fax, clearinghouse/eligibility, Labs/HIE, payments, eRx, and optional calendar or AI runtime.
- Implement vendor-backed adapters behind the existing integration contracts.
- Add queue, retry, webhook verification, manual fallback, and audit evidence for each live lane.
- Use Credential Dry-Run Binder, Vendor Credential Request Packet, Adapter Implementation Packet, and Integration Cutover Readiness Packet to track each lane.
- In progress: sandbox/local evidence contracts exist for EHR, fax, portal, communications, clearinghouse, Labs/HIE, payments, eRx, identity, calendar, and CopilotKit runtime.
- Completed: all 11 lanes have adapter contracts, sandbox stubs, and production placeholders. Production adapters/accounts, credentials, sandbox references, callback URLs, BAAs, enrollment approvals, prescriber identity proofing, approved tool policy, and support contacts remain external.

External inputs: vendor accounts, BAAs, API keys, callback URLs, enrollment approvals, sandbox references, support contacts, and go-live windows.

Exit criteria: every live integration reports `readiness_mode: production_vendor` and `production_ready=true`; no placeholder adapter, missing credential, unresolved blocking vendor risk, or unarchived vendor handoff remains.

### Phase 6: Billing And Revenue Cycle Readiness

Goal: make billing operational enough for real revenue work instead of demo-only charge review.

Build items:

- Connect clearinghouse eligibility checks, claim submission, claim status, denial/rework, ERA/remittance import, and payment reconciliation.
- Verify billing closeout, failed submission recovery, payer enrollment blockers, and remittance reconciliation.
- Record sandbox and production-vendor evidence in the integration packets.

External inputs: clearinghouse account, payer enrollment, billing owner, remittance setup, and payment account.

Exit criteria: eligibility, claims, denial handling, remittance, and reconciliation have passing vendor evidence and billing owner sign-off.

### Phase 7: Compliance And Operating Procedures

Goal: ensure the clinic can operate the system under clinical, privacy, and incident obligations.

Build items:

- Finalize PHI retention, incident response, access review, session policy, backup/restore, deployment ownership, patient outreach consent, assistant policy, and downtime procedures.
- Record staff training evidence for front desk, MA/nurse, provider, billing, and manager roles.
- Confirm audit export review cadence and incident escalation ownership.

External inputs: clinic owner, compliance/legal reviewer, staff training schedule, and incident contacts.

Exit criteria: policy approval evidence and staff training evidence are complete and current.

### Phase 8: Rehearsals

Goal: prove the cutover path in a production-like environment before final launch.

Build items:

- Run a full dry-run day with production-like infrastructure and vendor sandbox or pre-production lanes.
- Save Live-Use Rehearsal Board, Launch Workplan, Production Rehearsal Report, Restore Drill, Cutover Runbook, browser QA, role dry-run, staff training, and policy evidence.
- Assign and clear every warning, blocker, and unassigned launch item.
- Completed: cutover runbook sessions require a cutover owner and scheduled cutover time before they can count as ready Go-Live Packet evidence.

External inputs: clinic staff availability, production-like environment, vendor test windows, and manager review time.

Exit criteria: Go-Live Packet has no blocking or warning evidence except final approval timing.

### Phase 9: Production Cutover

Goal: switch the clinic from DrChrono to Concierge OS with an auditable go/no-go record.

Build items:

- Take final DrChrono export, enter DrChrono read-only/freeze, run final import, reconcile counts, sample charts, attachments, appointments, and billing handoff state.
- Switch DNS/secrets/vendor callbacks as needed.
- Run health report, production config audit, ready check, integration preflight, and daily workflow smoke checks.
- Keep support watch active through first-day closeout.

External inputs: clinic go/no-go approver, vendor support windows, final DrChrono export, and rollback owner.

Exit criteria: Go-Live Packet is approved, first-day closeout is clear, and rollback remains available until clinic owner accepts stabilization.

### Phase 10: Post-Go-Live Stabilization

Goal: keep the first production period quiet, measurable, and reversible.

Build items:

- Review incidents, adapter retries, failed webhooks, billing errors, closeout risks, audit categories, backup freshness, and staff feedback daily.
- Patch launch blockers quickly and record evidence.
- Run a two-week stabilization review covering outages avoided, workflow misses, vendor issues, and next feature priorities.

External inputs: clinic feedback, vendor support, billing review, and compliance review as needed.

Exit criteria: two weeks of stable clinic operation with no critical daily blockers, no unresolved PHI/security incidents, current backups, and accepted post-launch backlog.

## Immediate Next Build Items

1. Continue Phase 5 adapter hardening until all locally testable queue/retry/webhook/manual-fallback evidence is complete.
2. Keep final DrChrono write import blocked until production migration approval, final export reconciliation, and a write-capable importer exist.
3. Add or tighten Go-Live Packet evidence rules wherever a launch-critical packet can look ready with weak metadata.
4. Keep Operations UI, demo API, shared types, backend schemas, and product maturity tests in sync for every evidence contract change.
5. Stop local buildout only when the remaining item truly requires external accounts, clinic exports, vendor approval, or legal/compliance sign-off.

## External Account Decision Order

1. Cloud infrastructure account with BAA, production host, DNS, database, Redis, object storage, secrets, logs, and backups.
2. Identity/MFA provider for staff authentication and access policy.
3. SMS/voice/email communications vendor for patient outreach and callbacks.
4. Fax vendor for inbound/outbound clinical documents.
5. Clearinghouse and eligibility vendor for claims, payer enrollment, denials, and remittance.
6. Labs/HIE vendor for lab order/result workflows and external clinical data.
7. Payments vendor for patient payments and reconciliation if in scope for launch.
8. Certified eRx vendor for medication history, prescription transmission, status callbacks, and prescriber identity proofing if prescriptions are in launch scope.
9. Calendar and AI runtime accounts only after core clinical and revenue lanes are production-ready.

## Live Integration Limits

These cannot be completed by code alone:

- Cloud account selection, BAA acceptance, DNS, production host, alert destination, backup retention owner.
- Clinic staff roster, identity provider settings, MFA policy approval, emergency access owner.
- DrChrono API/export access, final export files, attachment/document files, freeze window, fallback owner.
- Vendor accounts and credentials for fax, communications, clearinghouse, Labs/HIE, payments, eRx, calendar, and AI runtime.
- Vendor sandbox references, callback URLs, enrollment approvals, support contacts, and go-live windows.
- Clinic owner, compliance/legal reviewer, staff training schedule, go/no-go approver, and rollback owner.
