import pytest

from app.integrations.base import IntegrationNotConfiguredError
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient
from app.integrations.sandbox import (
    SandboxCalendarClient,
    SandboxClearinghouseClient,
    SandboxCommunicationsClient,
    SandboxEHRClient,
    SandboxERxClient,
    SandboxFaxProviderClient,
    SandboxIdentityClient,
    SandboxLabsHIEClient,
    SandboxPaymentsClient,
    SandboxPortalClient,
)


@pytest.mark.asyncio
async def test_unconfigured_integration_health_is_demo_mode():
    health = await EHRClient("").health()

    assert health.ok is False
    assert health.configured is False
    assert health.as_dict()["mode"] == "demo"


@pytest.mark.asyncio
async def test_configured_placeholder_integration_health_requires_adapter():
    health = await EHRClient("https://ehr.example.com").health()

    assert health.ok is False
    assert health.configured is True
    assert health.adapter_implemented is False
    assert health.error is not None
    assert "vendor-specific EHR adapter" in health.error


@pytest.mark.asyncio
async def test_unconfigured_clients_raise_before_live_operations():
    with pytest.raises(IntegrationNotConfiguredError):
        await FaxProviderClient("").send_document("+13125550100", None)

    with pytest.raises(IntegrationNotConfiguredError):
        await PortalClient("").send_message("user-id", "Subject", "Body")


@pytest.mark.asyncio
async def test_configured_vendor_operations_require_adapter_implementation():
    with pytest.raises(NotImplementedError):
        await FaxProviderClient("fax-key").send_document("+13125550100", None)


@pytest.mark.asyncio
async def test_sandbox_adapters_implement_contract_operations():
    ehr_patient = await SandboxEHRClient("sandbox").search_patient("Ada Lovelace")
    fax = await SandboxFaxProviderClient("sandbox").send_document(
        "+13125550100",
        "s3://documents/referral.pdf",
    )
    portal = await SandboxPortalClient("sandbox").send_message(
        "patient-1",
        "Follow up",
        "Please review.",
    )
    calendar = await SandboxCalendarClient("sandbox").create_event({"patient_id": "patient-1"})
    communication = await SandboxCommunicationsClient("sandbox").send(
        channel="sms",
        recipient="+13125550100",
        subject="Reminder",
        body="Appointment reminder.",
    )
    claim = await SandboxClearinghouseClient("sandbox").submit_claim({"case_id": "case-1"})

    assert ehr_patient[0]["source"] == "sandbox"
    assert fax["status"] == "queued"
    assert portal["status"] == "queued"
    assert calendar["external_id"].startswith("sandbox-calendar-")
    assert communication["status"] == "queued"
    assert claim["status"] == "submitted"


@pytest.mark.asyncio
async def test_new_sandbox_adapters_implement_contract_operations():
    labs = await SandboxLabsHIEClient("sandbox").submit_lab_order("patient-1", {"test": "CBC"})
    payment = await SandboxPaymentsClient("sandbox").process_payment("patient-1", 10000, "card")
    erx = await SandboxERxClient("sandbox").send_prescription(
        "patient-1", {"medication": "Amoxicillin"}
    )
    identity = await SandboxIdentityClient("sandbox").authenticate_user("user-1", "password")

    assert labs["status"] == "submitted"
    assert payment["status"] == "succeeded"
    assert erx["status"] == "transmitted"
    assert identity["authenticated"] is True


@pytest.mark.asyncio
async def test_new_sandbox_adapter_health_reports_implemented():
    health = await SandboxLabsHIEClient("sandbox").health()
    assert health.ok is True
    assert health.adapter_implemented is True
    assert "sandbox" in health.adapter_detail.lower()

    health = await SandboxPaymentsClient("sandbox").health()
    assert health.ok is True
    assert health.adapter_implemented is True

    health = await SandboxERxClient("sandbox").health()
    assert health.ok is True
    assert health.adapter_implemented is True

    health = await SandboxIdentityClient("sandbox").health()
    assert health.ok is True
    assert health.adapter_implemented is True


@pytest.mark.asyncio
async def test_sandbox_adapter_health_reports_implemented():
    health = await SandboxFaxProviderClient("sandbox").health()

    assert health.ok is True
    assert health.configured is True
    assert health.adapter_implemented is True
    assert health.adapter_detail is not None
    assert "sandbox" in health.adapter_detail.lower()
