# Vendor Adapter Plan

Concierge OS currently exposes vendor-neutral integration boundaries. Live use requires vendor-specific adapters behind these interfaces.

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
- Run each connection test and resolve any failed result before go-live.
- Record sandbox workflow evidence for the listed workflows in the Integration Setup screen.
- Passing evidence should include a short note and, when available, the vendor sandbox reference URL or ticket link.
