import pytest

from app.services import readiness_service


@pytest.mark.asyncio
async def test_external_integrations_default_to_demo_mode(monkeypatch):
    monkeypatch.setattr(readiness_service.settings, "ehr_api_base_url", "")
    monkeypatch.setattr(readiness_service.settings, "fax_provider_api_key", "")
    monkeypatch.setattr(readiness_service.settings, "portal_api_base_url", "")
    monkeypatch.setattr(readiness_service.settings, "calendar_api_base_url", "")
    monkeypatch.setattr(readiness_service.settings, "copilotkit_runtime_url", "")
    monkeypatch.setattr(readiness_service.settings, "communications_provider_api_key", "")

    integrations = await readiness_service.check_external_integrations()

    assert integrations["ehr"]["ok"] is False
    assert integrations["ehr"]["mode"] == "demo"
    assert integrations["fax_provider"]["env_var"] == "FAX_PROVIDER_API_KEY"
    assert integrations["communications"]["mode"] == "demo"


@pytest.mark.asyncio
async def test_external_integrations_report_configured_values(monkeypatch):
    monkeypatch.setattr(readiness_service.settings, "ehr_api_base_url", "https://ehr.example.com")
    monkeypatch.setattr(readiness_service.settings, "fax_provider_api_key", "fax-key")
    monkeypatch.setattr(readiness_service.settings, "portal_api_base_url", "https://portal.example.com")
    monkeypatch.setattr(readiness_service.settings, "calendar_api_base_url", "https://calendar.example.com")
    monkeypatch.setattr(readiness_service.settings, "copilotkit_runtime_url", "https://copilot.example.com")
    monkeypatch.setattr(readiness_service.settings, "communications_provider_api_key", "comms-key")

    integrations = await readiness_service.check_external_integrations()

    assert all(item["ok"] for item in integrations.values())
    assert integrations["copilotkit"]["configured"] is True
