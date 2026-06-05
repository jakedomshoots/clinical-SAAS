import pytest

from app.integrations.base import IntegrationNotConfiguredError
from app.integrations.ehr import EHRClient
from app.integrations.fax_provider import FaxProviderClient
from app.integrations.portal import PortalClient


@pytest.mark.asyncio
async def test_unconfigured_integration_health_is_demo_mode():
    health = await EHRClient("").health()

    assert health.ok is False
    assert health.configured is False
    assert health.as_dict()["mode"] == "demo"


@pytest.mark.asyncio
async def test_configured_integration_health_is_ok():
    health = await EHRClient("https://ehr.example.com").health()

    assert health.ok is True
    assert health.configured is True


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
