# Vendor Adapter Plan

Concierge OS currently exposes vendor-neutral integration boundaries. Live use requires vendor-specific adapters behind these interfaces.

## EHR

- Environment: `EHR_API_BASE_URL`
- Current boundary: `app.integrations.ehr.EHRClient`
- Required live methods:
  - Patient search
  - Patient demographics sync
  - Encounter or note lookup if needed

## Fax Provider

- Environment: `FAX_PROVIDER_API_KEY`
- Current boundary: `app.integrations.fax_provider.FaxProviderClient`
- Required live methods:
  - Send document
  - Receive webhook
  - Delivery status sync
  - Document download

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
