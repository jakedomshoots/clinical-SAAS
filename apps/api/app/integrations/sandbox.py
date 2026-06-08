from app.integrations.calendar import CalendarClient
from app.integrations.clearinghouse import ClearinghouseClient
from app.integrations.communications import CommunicationsClient
from app.integrations.ehr import EHRClient
from app.integrations.erx import ERxClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.identity import IdentityClient
from app.integrations.labs_hie import LabsHIEClient
from app.integrations.payments import PaymentsClient
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


class SandboxLabsHIEClient(LabsHIEClient):
    adapter_implemented = True
    adapter_detail = "Sandbox Labs/HIE adapter implements lab order and result harnesses."
    readiness_mode = "local_sandbox"

    async def fetch_lab_results(self, patient_id: str) -> list[dict]:
        self.require_configured()
        return [
            {
                "id": "sandbox-lab-1",
                "patient_id": patient_id,
                "panel": "CBC",
                "result": "WBC 7.2, Hgb 13.5, Plt 250",
                "status": "final",
                "source": "sandbox",
            }
        ]

    async def submit_lab_order(self, patient_id: str, order: dict) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-lab-order-1",
            "patient_id": patient_id,
            "order": order,
            "status": "submitted",
            "source": "sandbox",
        }

    async def check_order_status(self, order_id: str) -> dict:
        self.require_configured()
        return {
            "id": order_id,
            "status": "completed",
            "source": "sandbox",
        }


class SandboxPaymentsClient(PaymentsClient):
    adapter_implemented = True
    adapter_detail = "Sandbox payments adapter implements payment processing harnesses."
    readiness_mode = "local_sandbox"

    async def process_payment(self, patient_id: str, amount_cents: int, method: str) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-payment-1",
            "patient_id": patient_id,
            "amount_cents": amount_cents,
            "method": method,
            "status": "succeeded",
            "source": "sandbox",
        }

    async def refund_payment(self, transaction_id: str, amount_cents: int | None = None) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-refund-1",
            "transaction_id": transaction_id,
            "amount_cents": amount_cents or 0,
            "status": "succeeded",
            "source": "sandbox",
        }

    async def get_payment_history(self, patient_id: str) -> list[dict]:
        self.require_configured()
        return [
            {
                "id": "sandbox-payment-hist-1",
                "patient_id": patient_id,
                "amount_cents": 2500,
                "method": "card",
                "status": "succeeded",
                "source": "sandbox",
            }
        ]


class SandboxERxClient(ERxClient):
    adapter_implemented = True
    adapter_detail = "Sandbox eRx adapter implements prescription transmission harnesses."
    readiness_mode = "local_sandbox"

    async def get_medication_history(self, patient_id: str) -> list[dict]:
        self.require_configured()
        return [
            {
                "id": "sandbox-med-hist-1",
                "patient_id": patient_id,
                "name": "Metformin",
                "dose": "500 mg",
                "status": "active",
                "source": "sandbox",
            }
        ]

    async def send_prescription(self, patient_id: str, prescription: dict) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-rx-1",
            "patient_id": patient_id,
            "prescription": prescription,
            "status": "transmitted",
            "source": "sandbox",
        }

    async def check_prescription_status(self, prescription_id: str) -> dict:
        self.require_configured()
        return {
            "id": prescription_id,
            "status": "filled",
            "source": "sandbox",
        }

    async def cancel_prescription(self, prescription_id: str) -> dict:
        self.require_configured()
        return {
            "id": prescription_id,
            "status": "cancelled",
            "source": "sandbox",
        }


class SandboxIdentityClient(IdentityClient):
    adapter_implemented = True
    adapter_detail = "Sandbox identity adapter implements authentication and MFA harnesses."
    readiness_mode = "local_sandbox"

    async def authenticate_user(self, username: str, password: str) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-auth-1",
            "username": username,
            "authenticated": True,
            "mfa_required": True,
            "source": "sandbox",
        }

    async def verify_mfa(self, user_id: str, mfa_code: str) -> dict:
        self.require_configured()
        return {
            "id": user_id,
            "verified": mfa_code == "123456",
            "source": "sandbox",
        }

    async def provision_user(self, user_data: dict) -> dict:
        self.require_configured()
        return {
            "id": "sandbox-user-1",
            "user": user_data,
            "status": "provisioned",
            "source": "sandbox",
        }

    async def deprovision_user(self, user_id: str) -> dict:
        self.require_configured()
        return {
            "id": user_id,
            "status": "deprovisioned",
            "source": "sandbox",
        }
