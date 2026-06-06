# Vendor Adapter Plan

Concierge OS currently exposes vendor-neutral integration boundaries. Live use requires vendor-specific adapters behind these interfaces.

The Integration Setup screen and `/api/integrations/credential-preflight` publish the same adapter contract methods listed below. A vendor lane is not live-ready until every required method is implemented, the connection test passes, sandbox workflow evidence is recorded, vendor ownership metadata is captured, cutover rehearsal evidence is approved, and unresolved blocking vendor risks are cleared or accepted.

For local contract rehearsal before real credentials are available, `USE_SANDBOX_ADAPTERS=true` swaps the placeholder clients for deterministic sandbox harnesses. Keep this disabled in production; sandbox adapters prove app-side wiring only, not vendor connectivity.
When sandbox adapters are enabled, Integration Setup can run each sandbox workflow through `/api/integrations/config/{integration}/sandbox-workflows/run`, or all workflows through `/api/integrations/config/{integration}/sandbox-workflows/run-all`, and record passing audit-backed evidence automatically.
Sandbox harnesses report `readiness_mode: local_sandbox` and can make an item `sandbox_ready`, but they deliberately keep `production_ready=false` and preflight `status: staged`. Treat that as local rehearsal evidence only; production vendor readiness requires the real adapter lane to report `readiness_mode: production_vendor`, every sandbox workflow to pass, and every passed workflow to carry a vendor sandbox reference URL.

## EHR

- Environment: `EHR_API_BASE_URL`
- Current boundary: `app.integrations.ehr.EHRClient`
- Required live methods:
  - Patient search
  - Patient demographics sync
  - Medication list sync
  - Care-plan or order/task sync if supported
  - Lab result import
  - Encounter or note lookup if needed

## Fax Provider

- Environment: `FAX_PROVIDER_API_KEY`
- Current boundary: `app.integrations.fax_provider.FaxProviderClient`
- Required live methods:
  - Send document
  - Receive webhook
  - Delivery status sync
  - Document download
  - Signed source document URL or object-storage handoff
  - Inbound fax match callback into patient documents

## Portal

- Environment: `PORTAL_API_BASE_URL`
- Current boundary: `app.integrations.portal.PortalClient`
- Required live methods:
  - Send message
  - Thread lookup
  - Attachment handling if needed

## Calendar

- Environment: `CALENDAR_API_BASE_URL`
- Current boundary: `app.integrations.calendar.CalendarClient`
- Required live methods:
  - Create event
  - Update event
  - Cancel event
  - Provider availability sync

## CopilotKit Runtime

- Environment: `COPILOTKIT_RUNTIME_URL`
- Current boundary: `app.integrations.copilotkit.CopilotRuntimeClient`
- Required live controls:
  - Model allowlist
  - Tool allowlist
  - Tenant/user authorization forwarding
  - Audit event capture for tool invocations

## Clearinghouse

- Environment: `CLEARINGHOUSE_API_BASE_URL`, `CLEARINGHOUSE_API_KEY`
- Current boundary: `app.integrations.clearinghouse.ClearinghouseClient`
- Required live methods:
  - Claim submission
  - Eligibility verification if handled by the clearinghouse
  - Denial or acceptance callbacks
  - Payment status callbacks
  - ERA/remittance import
  - Billing timeline reconciliation

## Credential Preflight Gate

- Use `/api/integrations/credential-preflight` before any live-use rehearsal.
- Every integration should have required credentials captured from environment variables or setup drafts.
- Every integration should have a vendor profile captured with vendor name, environment, internal owner, owner email, support contact, escalation notes, and contract/reference link.
- Every integration should have cutover rehearsal evidence captured with planned cutover date, last vendor test date, rollback owner, go/no-go notes, and explicit live-use rehearsal approval.
- Every integration should track vendor risks with severity, mitigation owner, mitigation status, and whether the risk blocks live-use rehearsal.
- Export the vendor handoff packet from Integration Setup before launch review so vendor profile, risks, cutover evidence, sandbox evidence, adapter contract, and blockers are archived together.
- Archive the exported handoff packet from Integration Setup so the latest packet reference appears in the vendor lane and audit evidence.
- Credential preflight blocks integrations whose Python client is still a placeholder adapter, even when credentials and sandbox notes are present.
- Credential preflight shows the adapter method checklist and ready/blocked counts for each vendor lane.
- Inbound callbacks must send `X-Concierge-Webhook-Secret`, `X-Concierge-Webhook-Timestamp`, `X-Concierge-Webhook-Signature`, and a stable vendor `event_id`; sign `timestamp.raw_body` with `WEBHOOK_SHARED_SECRET` as `sha256=<hmac>`. Stale timestamps outside the replay window, invalid signatures, and callbacks without `event_id` are rejected.
- Run each connection test and resolve any failed result before go-live.
- Record sandbox workflow evidence for the listed workflows in the Integration Setup screen.
- In local sandbox-adapter mode, use the workflow runner to generate evidence directly from the harness before replacing it with real vendor sandbox references.
- Do not use `local_sandbox` readiness as go-live evidence. Replace it with production vendor credentials, adapter health, and vendor sandbox references before live-use rehearsal.
- Passing evidence must include a short note or reference URL so the audit trail is never empty. Production vendor readiness additionally requires a vendor sandbox reference URL or ticket link for every passed workflow.
- Failed sandbox evidence blocks credential preflight until the vendor issue is resolved and a new passing evidence record is captured.
