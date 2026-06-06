from app.integrations.calendar import CalendarClient
from app.integrations.clearinghouse import ClearinghouseClient
from app.integrations.communications import CommunicationsClient
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient


class SandboxEHRClient(EHRClient):
    adapter_implemented = True
    adapter_detail = "Sandbox EHR adapter implements the local contract harness."
    readiness_mode = "local_sandbox"

    async def search_patient(self, query: str) -> list[dict]:
        self.require_configured()
        return [
            {
                "id": "sandbox-ehr-patient-1",
                "source": "sandbox",
                "query": query,
                "first_name": "Ada",
                "last_name": "Lovelace",
                "date_of_birth": "1815-12-10",
                "medications": [{"name": "Lisinopril", "status": "active"}],
                "labs": [{"name": "A1c", "value": "6.8", "status": "needs_review"}],
            }
        ]


class SandboxFaxProviderClient(FaxProviderClient):
    adapter_implemented = True
    adapter_detail = "Sandbox fax adapter implements outbound and inbound document harnesses."
    readiness_mode = "local_sandbox"

    async def send_document(self, to_number: str, file_url: str | None) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-fax-1",
            "status": "queued",
            "to_number": to_number,
            "file_url": file_url,
            "delivery_status": "queued",
        }


class SandboxPortalClient(PortalClient):
    adapter_implemented = True
    adapter_detail = "Sandbox portal adapter implements message and intake harnesses."
    readiness_mode = "local_sandbox"

    async def send_message(self, recipient_id: str, subject: str, body: str) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-portal-message-1",
            "status": "queued",
            "recipient_id": recipient_id,
            "subject": subject,
            "body_preview": body[:80],
        }


class SandboxCalendarClient(CalendarClient):
    adapter_implemented = True
    adapter_detail = "Sandbox calendar adapter implements appointment sync harnesses."
    readiness_mode = "local_sandbox"

    async def create_event(self, appointment: dict) -> dict:
        self.require_configured()
        return {
            "external_id": f"sandbox-calendar-{appointment.get('patient_id', 'appointment')}",
            "status": "created",
            "appointment": appointment,
        }

    async def update_event(self, appointment: dict) -> dict:
        self.require_configured()
        return {
            "external_id": f"sandbox-calendar-{appointment.get('patient_id', 'appointment')}",
            "status": "updated",
            "appointment": appointment,
        }


class SandboxCommunicationsClient(CommunicationsClient):
    adapter_implemented = True
    adapter_detail = "Sandbox communications adapter implements outreach delivery harnesses."
    readiness_mode = "local_sandbox"

    async def send(self, *, channel: str, recipient: str, subject: str, body: str) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-communication-1",
            "status": "queued",
            "channel": channel,
            "recipient": recipient,
            "subject": subject,
            "body_preview": body[:80],
        }


class SandboxClearinghouseClient(ClearinghouseClient):
    adapter_implemented = True
    adapter_detail = "Sandbox clearinghouse adapter implements claim and remittance harnesses."
    readiness_mode = "local_sandbox"

    async def submit_claim(self, claim_payload: dict) -> dict:
        self.require_configured()
        return {
            "reference_id": "sandbox-claim-1",
            "status": "submitted",
            "claim": claim_payload,
        }

    async def import_remittance(self, reference_id: str) -> dict:
        self.require_configured()
        return {
            "reference_id": reference_id,
            "status": "imported",
            "amount_cents": 12500,
        }
