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
    monkeypatch.setattr(readiness_service.settings, "clearinghouse_api_key", "")

    integrations = await readiness_service.check_external_integrations()

    assert integrations["ehr"]["ok"] is False
    assert integrations["ehr"]["mode"] == "demo"
    assert integrations["fax_provider"]["env_var"] == "FAX_PROVIDER_API_KEY"
    assert integrations["communications"]["mode"] == "demo"
    assert integrations["clearinghouse"]["env_var"] == "CLEARINGHOUSE_API_KEY"


@pytest.mark.asyncio
async def test_external_integrations_report_placeholder_adapters_when_configured(monkeypatch):
    monkeypatch.setattr(readiness_service.settings, "ehr_api_base_url", "https://ehr.example.com")
    monkeypatch.setattr(readiness_service.settings, "fax_provider_api_key", "fax-key")
    monkeypatch.setattr(readiness_service.settings, "portal_api_base_url", "https://portal.example.com")
    monkeypatch.setattr(readiness_service.settings, "calendar_api_base_url", "https://calendar.example.com")
    monkeypatch.setattr(readiness_service.settings, "copilotkit_runtime_url", "https://copilot.example.com")
    monkeypatch.setattr(readiness_service.settings, "communications_provider_api_key", "comms-key")
    monkeypatch.setattr(readiness_service.settings, "clearinghouse_api_key", "claims-key")

    integrations = await readiness_service.check_external_integrations()

    assert integrations["ehr"]["ok"] is False
    assert integrations["ehr"]["configured"] is True
    assert integrations["ehr"]["adapter_implemented"] is False
    assert "vendor-specific EHR adapter" in integrations["ehr"]["error"]
    assert integrations["fax_provider"]["ok"] is False
    assert integrations["fax_provider"]["adapter_implemented"] is False
    assert integrations["copilotkit"]["ok"] is True
    assert integrations["copilotkit"]["configured"] is True
    assert integrations["copilotkit"]["adapter_implemented"] is True


def test_deployment_assets_report_operational_files():
    deployment = readiness_service._check_deployment_assets()

    assert deployment["deployment_runbook"]["ok"] is True
    assert deployment["health_report_script"]["path"] == "scripts/health-report.sh"
    assert "local_backup_script" in deployment
