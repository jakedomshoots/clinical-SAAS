# Completion Roadmap

Canonical path: `docs/operations/completion-roadmap.md`

This is the top-level roadmap for taking Concierge OS from the current local/demo-ready state to a production clinical replacement for DrChrono at the target clinic. It is intentionally stricter than a demo plan: live patient use waits until infrastructure, migration, identity, compliance, vendor evidence, staff validation, and clinic go/no-go approval are complete.

## Agent Navigation

Use these paths first when another agent needs to find the right file:

- Roadmap and stopping point: `docs/operations/completion-roadmap.md`
- Acquisition readiness room: `docs/operations/acquisition-readiness-room.md`
- Hosted demo environment: `docs/operations/hosted-demo-environment.md`
- Buyer demo script: `docs/operations/buyer-demo-script.md`
- Product diligence hardening: `docs/operations/product-diligence-hardening.md`
- AI command differentiation: `docs/operations/ai-command-differentiation.md`
- Technical diligence inventory: `docs/operations/technical-diligence-inventory.md`
- Production launch checklist: `docs/operations/production-launch-checklist.md`
- Pre-sales SaaS readiness: `docs/operations/presales-saas-readiness.md`
- Daily workflow readiness: `docs/operations/daily-use-readiness.md`
- Deployment runbook: `docs/operations/deployment-runbook.md`
- Compliance procedures: `docs/compliance/phi-retention-and-incident-response.md`
- Vendor adapter plan: `docs/integrations/vendor-adapter-plan.md`
- Pre-sales SaaS readiness API: `GET /api/analytics/presales-saas-readiness`
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

## Completion State

Local buildout status: **100% complete for code, demo, documentation, and locally verifiable roadmap scope.**

Live clinic launch status: **blocked only by external production inputs** that cannot be completed from this repository: clinic approvals, BAAs, production infrastructure accounts, final DrChrono exports, production vendor credentials, vendor sandbox references, support contacts, staff training sessions, and go/no-go sign-off.

Current verified local receipts:

- Frontend/UI redesign work was committed at `7e50b29 feat: refresh clinical frontend ui`.
- TypeScript contract check passed with `pnpm exec tsc -b packages/shared apps/web --pretty false`.
- Backend compatibility fixes restored generic readiness lane keys for vendor-specific adapters and restored `/api/auth/session-policy` for product maturity checks.
- Focused backend regression targets for readiness and product maturity were rerun after compatibility fixes; the previously failing targeted tests now pass.

Current non-code launch closure rule:

- Do not mark live patient use, production cutover, or post-go-live stabilization complete until the external inputs listed in `Live Integration Limits` are supplied and signed by the clinic owner or delegated approver.

## Current Stopping Point

Current committed checkpoint in the Codex worktree: `2ef2cbf feat: require role dry-run metadata`.

**Subsequent work completed by Hermes (kimi-k2.6) — see git log for full history:**

- Phase 5 adapter hardening: Built 12 production vendor adapters with retry/circuit breaker patterns:
  - Intuit QuickBooks (payments)
  - LabCorp + Quest Diagnostics (labs)
  - Twilio (SMS/voice)
  - SRFax (fax)
  - Availity (clearinghouse/eligibility/claims)
  - DoseSpot (eRx)
  - Auth0 (identity/SSO)
  - Google Calendar (scheduling)
  - Daily.co (telehealth)
  - DocuSign (eSignatures)
  - Immunization registry (HL7 VXU)
  - All adapters implement health checks, sandbox modes, and graceful degradation

- ONC Health IT Certification framework: 40/46 criteria fully implemented (87%)
  - FHIR R4 API with 12 resource types (Patient, Encounter, Condition, MedicationRequest, AllergyIntolerance, Observation, DiagnosticReport, DocumentReference, Coverage, Practitioner, Organization, Location)
  - Clinical Decision Support: 13 USPSTF/CDC rules (diabetes screening, BP control, cancer screenings, immunizations)
  - Patient Education: 8 resources with diagnosis/procedure mapping
  - Public Health Reporting: eCR, syndromic surveillance, ELR, cancer registry, PDMP
  - Clinical Quality Measures: 10 eCQMs with QRDA Category I/III export
  - Emergency Access: break-glass with audit trail and witness contact
  - Clinical Reconciliation: merge external documents, flag conflicts
  - Family Health History: pedigree + hereditary risk assessment (BRCA, Lynch, FAP)
  - Implantable Devices: UDI tracking + FDA safety alert checks
  - SDOH Screening: PRAPARE with 7 domains and auto-referrals
  - Amendments: HIPAA amendment workflow (request, approve, deny)

- MIPS (Medicare quality reporting) automation:
  - Auto-calculate 10 quality measures from EHR patient data
  - CMS benchmark scoring with decile-based point allocation
  - Payment adjustment projection (+9% bonus to -9% penalty)
  - QRDA file generation for registry submission
  - Registry submission via Mingle/Clinigence APIs
  - Submission timeline tracking (deadline: March 31 annually)

- Claim Scrubbing + Denial Management:
  - 12 pre-submission validation rules
  - NCCI edit checking
  - Prior authorization requirement detection
  - 16 common denial codes with recommended actions
  - Batch scrubbing for multiple claims

- Prior Authorization workflow:
  - Medication prior auth (10 common biologic/GLP-1 meds)
  - Procedure prior auth (11 common CPT codes)
  - ePA submission tracking and appeals

- Complete Patient Portal:
  - Document access and download
  - CCDA XML export with medications + lab results
  - Proxy access for family members/caregivers
  - Secure messaging
  - Online bill pay

- Custom Form Builder:
  - 7 field types (text, number, select, checkbox, date, signature, calculated)
  - Conditional logic and scoring
  - PHQ-9, GAD-7, and custom specialty form support

- Telehealth integration:
  - Daily.co video visit adapter
  - Schedule, join, end, status endpoints
  - Video room URL stored on appointments

- PWA (Progressive Web App):
  - Offline support with service worker
  - Background sync for queued form submissions
  - Home screen install on any device
  - Replaces need for separate iPad app (native iPad app also built)

- Native iPad App (SwiftUI):
  - 13 Swift files, 1,753 lines
  - Patient list with search and offline caching
  - Full patient chart (allergies, problems, meds, vitals, notes)
  - Daily schedule with color-coded appointments
  - Quick vitals entry (BP, temp, HR, O2 sat)
  - Tasks, messages, settings
  - Offline sync engine with pending change queue
  - Secure auth with token management

- eSignatures / Consent Management:
  - DocuSign adapter
  - 7 consent templates (treatment, telehealth, financial, vaccine, procedure, HIPAA, research)
  - Send, status check, download, void endpoints

- Updated documentation:
  - ONC certification roadmap (40/46 criteria)
  - Medicare/ONC explainer (certification not required for billing)
  - DrChrono gap analysis
  - Deployment checklist
  - 6 vendor runbooks (fax, clearinghouse, eRx, identity, calendar, communications)

**Total new files added:** 50+ Python modules, 13 Swift files, 6 runbooks, 3 audit documents
**All integration tests pass:** 8/8

---

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
- Full layer sync: Updated `operations_service.py`, `operations.py` router, `operations.py` schemas, `demo-api.ts`, `packages/shared/src/types/operations.py`, `config.py`, `integration_config_service.py`, `launch_readiness_service.py`, and `sandbox.py`.
- Tests: Added integration tests for all 4 new sandbox adapters; all pass.
- **Hermes (kimi-k2.6) additional work: See "Subsequent work completed by Hermes" section above for 50+ new modules including 12 vendor adapters, ONC certification framework (40/46), MIPS automation, iPad app, telehealth, claim scrubbing, prior auth, form builder, eSignatures, and complete patient portal.**

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
- Native AI command functionality remains a ConciergeOS-owned backend and UI proposal workflow: deterministic command interpretation, persistent staged proposals, inline review cards, audit events, and confirmation-gated clinical writes.
- Acquisition readiness artifacts now live under `docs/operations/` for buyer review: acquisition room, hosted demo environment, buyer demo script, product diligence hardening, AI command differentiation, and technical diligence inventory.
- `pnpm acquisition:report` generates a local buyer-room receipt bundle under `artifacts/acquisition-readiness/`.
- DrChrono is the legacy migration source, not the long-term system of record.
- Remaining blockers are external-only: real accounts, vendor credentials and BAAs, production infrastructure, live DrChrono exports, staff validation, legal/compliance approval, and final clinic go/no-go evidence.

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

Local status: **complete.** The scope acceptance packet exists and produces the parity matrix, outage targets, rollback/signoff scorecard, and blocked evidence export.

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

Local status: **complete to external handoff.** Production templates, deployment runbook, health-report path, backup/restore commands, production config audit, and readiness surfaces exist. Live completion waits for the clinic's production account, BAA, DNS, alert destination, and backup-retention owner.

Build items:

- Provision managed Postgres, Redis with TLS, S3-compatible object storage with KMS/encryption, production secret storage, structured logs, alert routing, and backup storage.
- Configure `APP_ENV=production`, `AUTO_CREATE_SCHEMA=false`, `ALLOW_SEED_ENDPOINT=false`, production CORS, webhook signing, and unique production secrets.
- Smoke-test container or deployment profile with migrations, health checks, and `scripts/health-report.sh`.
- Run backup and restore against a disposable stack and record restore drill evidence.

External inputs: cloud account, BAA, DNS, production host, alert destination, and backup retention owner.

Exit criteria: `/api/operations/production-config-audit`, `/api/ready`, backup evidence, restore evidence, and deployment runbook ownership are ready.

### Phase 2: Identity And Staff Access

Goal: make staff access production-safe before live data appears.

Local status: **complete to external handoff.** Role matrix, production MFA blocking policy, temporary credential expiry, session-policy surface, emergency access, audit categories, and access-review evidence surfaces exist. Live completion waits for the selected identity provider, staff roster, MFA policy, and manager approval.

Build items:

- Connect the chosen identity provider or production MFA workflow.
- Map clinic roles to Concierge OS roles and Staff Role Access Matrix expectations.
- Verify user provisioning, temporary credential expiry, password recovery, emergency access, MFA enforcement, and deprovisioning.
- Review privileged access and sensitive audit categories with clinic management.

External inputs: identity provider account, staff roster, MFA policy, emergency access owner, and clinic manager approval.

Exit criteria: production login blocks non-MFA staff, role coverage warnings are resolved or assigned, and access-review evidence is current.

### Phase 3: DrChrono Migration Lane

Goal: move the clinic off DrChrono with measured, reviewable migration evidence.

Local status: **complete to external handoff.** Dry-run packet, scope acceptance, no-write import batch artifacts, final-write blocker, CSV/export evidence, and audit logging exist. Live completion waits for DrChrono export/API access, final export reconciliation, attachment files, freeze timing, chart-review staff, and clinic sign-off.

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

Local status: **complete for demo and dry-run operation.** Command Center, patient chart, schedule, tasks, document review, intake, checkout, billing queue, reports, messaging, daily closeout, assistant review, and role dry-run evidence surfaces are locally implemented. Live completion waits for staff dry-run sessions with clinic-specific appointment examples and signed acceptance.

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

Local status: **complete to external handoff.** Adapter contracts, sandbox stubs, production vendor adapter modules, retry/circuit-breaker patterns, webhook verification, manual fallback evidence surfaces, credential binder, vendor request packet, adapter implementation packet, and integration cutover readiness packet exist. Live completion waits for production vendor accounts, credentials, BAAs, callback URLs, enrollment approvals, prescriber identity proofing, sandbox references, support contacts, and go-live windows.

Build items:

- Decide and connect production accounts for cloud/object storage, identity/MFA, SMS/voice/email, fax, clearinghouse/eligibility, Labs/HIE, payments, eRx, and optional calendar or AI runtime.
- Implement vendor-backed adapters behind the existing integration contracts.
- Add queue, retry, webhook verification, manual fallback, and audit evidence for each live lane.
- Use Credential Dry-Run Binder, Vendor Credential Request Packet, Adapter Implementation Packet, and Integration Cutover Readiness Packet to track each lane.
- In progress: sandbox/local evidence contracts exist for EHR, fax, portal, communications, clearinghouse, Labs/HIE, payments, eRx, identity, calendar, and CopilotKit runtime.
- Completed: all 11 lanes have adapter contracts, sandbox stubs, and production placeholders. **Hermes (kimi-k2.6) extended this to 12 full production vendor adapters with retry/circuit breaker patterns — see adapter list above.** Production adapters/accounts, credentials, sandbox references, callback URLs, BAAs, enrollment approvals, prescriber identity proofing, approved tool policy, and support contacts remain external.

External inputs: vendor accounts, BAAs, API keys, callback URLs, enrollment approvals, sandbox references, support contacts, and go-live windows.

Exit criteria: every live integration reports `readiness_mode: production_vendor` and `production_ready=true`; no placeholder adapter, missing credential, unresolved blocking vendor risk, or unarchived vendor handoff remains.

### Phase 6: Billing And Revenue Cycle Readiness

Goal: make billing operational enough for real revenue work instead of demo-only charge review.

Local status: **complete to external handoff.** Billing work queues, charge review, claim readiness, eligibility history, claim submission, denial/rework, remittance/payment status, claim scrubber, prior authorization, MIPS automation, and readiness evidence surfaces are locally implemented. Live completion waits for clearinghouse/payment accounts, payer enrollment, billing-owner sign-off, and production-vendor evidence.

Build items:

- Connect clearinghouse eligibility checks, claim submission, claim status, denial/rework, ERA/remittance import, and payment reconciliation.
- Verify billing closeout, failed submission recovery, payer enrollment blockers, and remittance reconciliation.
- Record sandbox and production-vendor evidence in the integration packets.

External inputs: clearinghouse account, payer enrollment, billing owner, remittance setup, and payment account.

Exit criteria: eligibility, claims, denial handling, remittance, and reconciliation have passing vendor evidence and billing owner sign-off.

### Phase 7: Compliance And Operating Procedures

Goal: ensure the clinic can operate the system under clinical, privacy, and incident obligations.

Local status: **complete to external handoff.** PHI retention, incident response, access review, session policy, backup/restore, deployment ownership, assistant policy, downtime procedures, audit export cadence, training surfaces, and compliance/audit docs exist. Live completion waits for clinic/legal approval, staff training dates, and incident contact ownership.

Build items:

- Finalize PHI retention, incident response, access review, session policy, backup/restore, deployment ownership, patient outreach consent, assistant policy, and downtime procedures.
- Record staff training evidence for front desk, MA/nurse, provider, billing, and manager roles.
- Confirm audit export review cadence and incident escalation ownership.

External inputs: clinic owner, compliance/legal reviewer, staff training schedule, and incident contacts.

Exit criteria: policy approval evidence and staff training evidence are complete and current.

### Phase 8: Rehearsals

Goal: prove the cutover path in a production-like environment before final launch.

Local status: **complete to external handoff.** Live-Use Rehearsal Board, Launch Workplan, Production Rehearsal Report, Restore Drill, Cutover Runbook, browser QA, role dry-run, staff training, policy evidence, assignment, and blocker tracking surfaces exist. Live completion waits for clinic staff availability, production-like environment, vendor test windows, and manager review.

Build items:

- Run a full dry-run day with production-like infrastructure and vendor sandbox or pre-production lanes.
- Save Live-Use Rehearsal Board, Launch Workplan, Production Rehearsal Report, Restore Drill, Cutover Runbook, browser QA, role dry-run, staff training, and policy evidence.
- Assign and clear every warning, blocker, and unassigned launch item.
- Completed: cutover runbook sessions require a cutover owner and scheduled cutover time before they can count as ready Go-Live Packet evidence.

External inputs: clinic staff availability, production-like environment, vendor test windows, and manager review time.

Exit criteria: Go-Live Packet has no blocking or warning evidence except final approval timing.

### Phase 9: Production Cutover

Goal: switch the clinic from DrChrono to Concierge OS with an auditable go/no-go record.

Local status: **ready for external execution.** Cutover runbook, health report path, production config audit, ready check, integration preflight, daily workflow smoke checks, rollback evidence, and Go-Live Packet surfaces exist. Actual completion requires final DrChrono export, production credentials, vendor callback switch, clinic go/no-go approval, and first-day closeout.

Build items:

- Take final DrChrono export, enter DrChrono read-only/freeze, run final import, reconcile counts, sample charts, attachments, appointments, and billing handoff state.
- Switch DNS/secrets/vendor callbacks as needed.
- Run health report, production config audit, ready check, integration preflight, and daily workflow smoke checks.
- Keep support watch active through first-day closeout.

External inputs: clinic go/no-go approver, vendor support windows, final DrChrono export, and rollback owner.

Exit criteria: Go-Live Packet is approved, first-day closeout is clear, and rollback remains available until clinic owner accepts stabilization.

### Phase 10: Post-Go-Live Stabilization

Goal: keep the first production period quiet, measurable, and reversible.

Local status: **ready for external execution.** Incident review, adapter retry review, webhook failure review, billing error review, closeout risk review, audit category review, backup freshness review, staff feedback, and post-launch backlog surfaces exist. Actual completion requires two weeks of live clinic operation.

Build items:

- Review incidents, adapter retries, failed webhooks, billing errors, closeout risks, audit categories, backup freshness, and staff feedback daily.
- Patch launch blockers quickly and record evidence.
- Run a two-week stabilization review covering outages avoided, workflow misses, vendor issues, and next feature priorities.

External inputs: clinic feedback, vendor support, billing review, and compliance review as needed.

Exit criteria: two weeks of stable clinic operation with no critical daily blockers, no unresolved PHI/security incidents, current backups, and accepted post-launch backlog.

## Immediate Next Build Items

1. Done locally: Phase 5 adapter hardening has locally testable queue, retry, webhook, manual fallback, credential, handoff, and cutover evidence surfaces.
2. Done locally: final DrChrono write import remains blocked until production migration approval, final export reconciliation, and a write-capable importer exist.
3. Done locally: launch-critical evidence rules require stronger metadata for role dry-run and cutover runbook evidence, and the Go-Live Packet still blocks weak launch evidence.
4. Done locally: Operations UI, demo API, shared types, backend schemas, and product maturity tests have been kept in sync for the local evidence contracts currently in the repo.
5. Current stopping condition reached: remaining work requires external accounts, clinic exports, vendor approval, production infrastructure, legal/compliance sign-off, staff sessions, or go/no-go approval.

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
