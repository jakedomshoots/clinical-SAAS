import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import UserRole
from app.services import integration_config_service
from app.services.integration_event_service import record_event
from tests.conftest import headers_for, make_user


@pytest.mark.asyncio
async def test_list_integration_events_is_scoped_to_user_organization(
    client: AsyncClient,
    admin_user,
    auth_headers,
    db: AsyncSession,
):
    other_user = await make_user(
        db,
        UserRole.admin,
        "other-org-integration-admin@clinic.example.com",
        organization_id="other-org",
    )
    await record_event(
        db,
        admin_user,
        integration="fax_provider",
        direction="outbound",
        action="send_document",
        status="failed",
        entity_type="fax",
        entity_id="fax-1",
        error="Timeout",
    )
    await record_event(
        db,
        other_user,
        integration="portal",
        direction="outbound",
        action="send_message",
        status="failed",
        entity_type="message",
        entity_id="message-1",
    )

    res = await client.get("/api/integrations/events", headers=auth_headers)

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["data"][0]["integration"] == "fax_provider"
    assert body["data"][0]["organization_id"] == "default"


@pytest.mark.asyncio
async def test_retry_integration_event_marks_retrying(
    client: AsyncClient,
    admin_user,
    auth_headers,
    db: AsyncSession,
):
    event = await record_event(
        db,
        admin_user,
        integration="calendar",
        direction="outbound",
        action="create_event",
        status="failed",
    )

    res = await client.post(
        f"/api/integrations/events/{event.id}/retry",
        headers=auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "retrying"
    assert body["attempts"] == 2


@pytest.mark.asyncio
async def test_provider_cannot_list_integration_events(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "integration-provider@example.com")

    res = await client.get("/api/integrations/events", headers=headers_for(provider))

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_integration_config_reports_required_fields(
    client: AsyncClient,
    auth_headers,
):
    res = await client.get("/api/integrations/config", headers=auth_headers)

    assert res.status_code == 200
    body = res.json()
    keys = {item["key"] for item in body["data"]}
    assert {"ehr", "fax", "portal", "calendar", "communications", "copilotkit", "clearinghouse"} <= keys
    fax = next(item for item in body["data"] if item["key"] == "fax")
    assert fax["configured"] is False
    assert fax["fields"][0]["key"] == "FAX_PROVIDER_API_KEY"
    assert fax["fields"][0]["secret"] is True
    clearinghouse = next(item for item in body["data"] if item["key"] == "clearinghouse")
    assert clearinghouse["fields"][0]["key"] == "CLEARINGHOUSE_API_BASE_URL"
    assert "ERA/remittance import" in clearinghouse["workflows"]


@pytest.mark.asyncio
async def test_integration_config_reports_adapter_contract_requirements(
    client: AsyncClient,
    auth_headers,
):
    res = await client.get("/api/integrations/config", headers=auth_headers)

    assert res.status_code == 200
    body = res.json()
    ehr = next(item for item in body["data"] if item["key"] == "ehr")
    method_keys = {method["key"] for method in ehr["adapter_methods"]}

    assert {
        "patient_search",
        "demographics_sync",
        "medication_sync",
        "lab_import",
        "encounter_writeback",
    } <= method_keys
    assert ehr["adapter_method_total"] == len(ehr["adapter_methods"])
    assert ehr["adapter_method_ready_count"] == 0
    assert all(method["status"] == "blocked" for method in ehr["adapter_methods"])
    assert all(method["required"] is True for method in ehr["adapter_methods"])


@pytest.mark.asyncio
async def test_update_integration_config_saves_redacted_setup_draft(
    client: AsyncClient,
    auth_headers,
):
    res = await client.patch(
        "/api/integrations/config/fax",
        json={"values": {"FAX_PROVIDER_API_KEY": "fax-secret-1234"}},
        headers=auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["key"] == "fax"
    assert body["configured"] is True
    assert body["mode"] == "setup_draft"
    assert body["fields"][0]["value_preview"] == "****1234"


@pytest.mark.asyncio
async def test_update_integration_config_saves_vendor_profile_metadata(
    client: AsyncClient,
    auth_headers,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()

    res = await client.patch(
        "/api/integrations/config/fax",
        json={
            "values": {
                "FAX_PROVIDER_API_KEY": "fax-secret-1234",
                "VENDOR_NAME": "MetroFax Health",
                "VENDOR_ENVIRONMENT": "sandbox",
                "OWNER_NAME": "Avery Ops",
                "OWNER_EMAIL": "avery@example.test",
                "SUPPORT_CONTACT": "support@metrofax.example",
                "ESCALATION_NOTES": "Escalate failed delivery callbacks within 1 business hour.",
                "CONTRACT_REFERENCE_URL": "https://vendor.example.test/contracts/fax",
            }
        },
        headers=auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["vendor_profile"]["vendor_name"] == "MetroFax Health"
    assert body["vendor_profile"]["environment"] == "sandbox"
    assert body["vendor_profile"]["owner_name"] == "Avery Ops"
    assert body["vendor_profile"]["owner_email"] == "avery@example.test"
    assert body["vendor_profile"]["support_contact"] == "support@metrofax.example"
    assert body["vendor_profile"]["contract_reference_url"] == "https://vendor.example.test/contracts/fax"
    assert body["vendor_profile"]["profile_complete"] is True
    assert body["vendor_profile"]["missing_fields"] == []

    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")
    profile_step = next(step for step in fax["steps"] if step["key"] == "vendor_profile")
    assert fax["vendor_profile"]["profile_complete"] is True
    assert profile_step["status"] == "ready"
    assert "MetroFax Health" in profile_step["detail"]


@pytest.mark.asyncio
async def test_update_integration_config_saves_cutover_rehearsal_evidence(
    client: AsyncClient,
    auth_headers,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()

    res = await client.patch(
        "/api/integrations/config/fax",
        json={
            "values": {
                "FAX_PROVIDER_API_KEY": "fax-secret-1234",
                "CUTOVER_PLANNED_AT": "2026-07-15T14:00:00Z",
                "LAST_VENDOR_TEST_AT": "2026-07-01T18:30:00Z",
                "ROLLBACK_OWNER": "Morgan Manager",
                "GO_NO_GO_NOTES": "Vendor sandbox callbacks verified; rollback to manual fax queue approved.",
                "LIVE_REHEARSAL_APPROVED": "true",
            }
        },
        headers=auth_headers,
    )

    assert res.status_code == 200
    body = res.json()
    assert body["cutover_evidence"]["planned_cutover_at"] == "2026-07-15T14:00:00Z"
    assert body["cutover_evidence"]["last_vendor_test_at"] == "2026-07-01T18:30:00Z"
    assert body["cutover_evidence"]["rollback_owner"] == "Morgan Manager"
    assert body["cutover_evidence"]["live_rehearsal_approved"] is True
    assert body["cutover_evidence"]["evidence_complete"] is True

    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")
    cutover_step = next(step for step in fax["steps"] if step["key"] == "cutover_evidence")
    assert fax["cutover_evidence"]["evidence_complete"] is True
    assert cutover_step["status"] == "ready"
    assert "Morgan Manager" in cutover_step["detail"]


@pytest.mark.asyncio
async def test_connection_test_records_integration_event(
    client: AsyncClient,
    auth_headers,
):
    await client.patch(
        "/api/integrations/config/ehr",
        json={"values": {"EHR_API_BASE_URL": "https://ehr.example.test"}},
        headers=auth_headers,
    )

    tested = await client.post("/api/integrations/config/ehr/test", headers=auth_headers)
    events = await client.get(
        "/api/integrations/events?integration=ehr",
        headers=auth_headers,
    )

    assert tested.status_code == 200
    assert tested.json()["configured"] is True
    assert tested.json()["status"] == "failed"
    assert events.status_code == 200
    assert any(
        event["action"] == "integration.connection_test"
        for event in events.json()["data"]
    )


@pytest.mark.asyncio
async def test_credential_preflight_reports_missing_and_staged_integrations(
    client: AsyncClient,
    auth_headers,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()

    initial = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    assert initial.status_code == 200
    body = initial.json()
    assert body["total"] >= 7
    assert body["blocking_count"] == body["total"]
    ehr = next(item for item in body["data"] if item["key"] == "ehr")
    assert ehr["status"] == "missing"
    assert ehr["missing_fields"] == ["EHR_API_BASE_URL"]
    assert ehr["steps"][0]["status"] == "missing"

    await client.patch(
        "/api/integrations/config/clearinghouse",
        json={
            "values": {
                "CLEARINGHOUSE_API_BASE_URL": "https://claims.example.test",
                "CLEARINGHOUSE_API_KEY": "claims-secret-1234",
            }
        },
        headers=auth_headers,
    )
    staged = await client.get("/api/integrations/credential-preflight", headers=auth_headers)

    clearinghouse = next(item for item in staged.json()["data"] if item["key"] == "clearinghouse")
    assert clearinghouse["status"] == "blocked"
    assert clearinghouse["missing_fields"] == []
    assert "CLEARINGHOUSE_API_KEY" in clearinghouse["configured_fields"]
    assert clearinghouse["steps"][1]["key"] == "adapter"
    assert clearinghouse["steps"][1]["status"] == "blocked"
    assert staged.json()["blocking_count"] == body["total"]


@pytest.mark.asyncio
async def test_sandbox_evidence_updates_credential_preflight(
    client: AsyncClient,
    auth_headers,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    await client.patch(
        "/api/integrations/config/clearinghouse",
        json={
            "values": {
                "CLEARINGHOUSE_API_BASE_URL": "https://claims.example.test",
                "CLEARINGHOUSE_API_KEY": "claims-secret-1234",
            }
        },
        headers=auth_headers,
    )
    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    clearinghouse = next(item for item in preflight.json()["data"] if item["key"] == "clearinghouse")

    for test_label in clearinghouse["sandbox_tests"]:
        evidence = await client.post(
            "/api/integrations/config/clearinghouse/sandbox-evidence",
            json={
                "test_label": test_label,
                "status": "passed",
                "notes": f"Sandbox proof for {test_label}",
                "reference_url": "https://vendor.example.test/evidence/123",
            },
            headers=auth_headers,
        )
        assert evidence.status_code == 201
        assert evidence.json()["status"] == "passed"
        assert evidence.json()["reference_url"] == "https://vendor.example.test/evidence/123"

    updated = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    updated_clearinghouse = next(item for item in updated.json()["data"] if item["key"] == "clearinghouse")
    sandbox_step = next(step for step in updated_clearinghouse["steps"] if step["key"] == "sandbox_workflows")
    assert sandbox_step["status"] == "ready"
    assert all(item["status"] == "passed" for item in updated_clearinghouse["sandbox_evidence"])


@pytest.mark.asyncio
async def test_passed_sandbox_evidence_requires_note_or_reference(
    client: AsyncClient,
    auth_headers,
):
    passed_without_evidence = await client.post(
        "/api/integrations/config/fax/sandbox-evidence",
        json={
            "test_label": "Send a sandbox outbound fax",
            "status": "passed",
            "notes": "",
            "reference_url": "",
        },
        headers=auth_headers,
    )
    failed_without_evidence = await client.post(
        "/api/integrations/config/fax/sandbox-evidence",
        json={
            "test_label": "Send a sandbox outbound fax",
            "status": "failed",
            "notes": "",
            "reference_url": "",
        },
        headers=auth_headers,
    )

    assert passed_without_evidence.status_code == 400
    assert "notes or reference" in passed_without_evidence.json()["detail"]
    assert failed_without_evidence.status_code == 201
    assert failed_without_evidence.json()["status"] == "failed"


@pytest.mark.asyncio
async def test_failed_sandbox_evidence_blocks_credential_preflight(
    client: AsyncClient,
    auth_headers,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    await client.patch(
        "/api/integrations/config/fax",
        json={"values": {"FAX_PROVIDER_API_KEY": "fax-secret-1234"}},
        headers=auth_headers,
    )
    evidence = await client.post(
        "/api/integrations/config/fax/sandbox-evidence",
        json={
            "test_label": "Send a sandbox outbound fax",
            "status": "failed",
            "notes": "Vendor sandbox rejected the outbound fax fixture.",
        },
        headers=auth_headers,
    )
    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)

    assert evidence.status_code == 201
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")
    assert fax["status"] == "blocked"
    sandbox_step = next(step for step in fax["steps"] if step["key"] == "sandbox_workflows")
    assert sandbox_step["status"] == "blocked"
    assert any("failed sandbox" in blocker.lower() for blocker in fax["blockers"])


@pytest.mark.asyncio
async def test_placeholder_adapter_blocks_credential_preflight_even_with_sandbox_evidence(
    client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "fax-secret-1234")
    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")

    for test_label in fax["sandbox_tests"]:
        evidence = await client.post(
            "/api/integrations/config/fax/sandbox-evidence",
            json={
                "test_label": test_label,
                "status": "passed",
                "notes": f"Vendor sandbox proof for {test_label}.",
            },
            headers=auth_headers,
        )
        assert evidence.status_code == 201

    updated = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    updated_fax = next(item for item in updated.json()["data"] if item["key"] == "fax")

    assert updated_fax["status"] == "blocked"
    assert updated_fax["adapter_method_ready_count"] == 0
    assert updated_fax["adapter_method_total"] >= 4
    assert updated_fax["adapter_methods"][0]["status"] == "blocked"
    assert updated_fax["steps"][1]["key"] == "adapter"
    assert updated_fax["steps"][1]["status"] == "blocked"
    assert "0 of" in updated_fax["steps"][1]["detail"]
    assert any("vendor-specific fax adapter" in blocker.lower() for blocker in updated_fax["blockers"])


@pytest.mark.asyncio
async def test_sandbox_adapter_mode_marks_contract_methods_ready(
    client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "use_sandbox_adapters", True)
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "sandbox")

    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")

    assert fax["adapter_implemented"] is True
    assert fax["adapter_method_ready_count"] == fax["adapter_method_total"]
    assert all(method["status"] == "ready" for method in fax["adapter_methods"])
    assert fax["steps"][1]["status"] == "ready"


@pytest.mark.asyncio
async def test_run_sandbox_workflow_records_passing_evidence(
    client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "use_sandbox_adapters", True)
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "sandbox")

    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")
    test_label = fax["sandbox_tests"][0]

    ran = await client.post(
        "/api/integrations/config/fax/sandbox-workflows/run",
        json={"test_label": test_label},
        headers=auth_headers,
    )
    updated = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    updated_fax = next(item for item in updated.json()["data"] if item["key"] == "fax")
    evidence = next(item for item in updated_fax["sandbox_evidence"] if item["test_label"] == test_label)

    assert ran.status_code == 201
    assert ran.json()["status"] == "passed"
    assert ran.json()["reference_url"].startswith("sandbox://fax/")
    assert "Sandbox workflow passed" in ran.json()["notes"]
    assert evidence["status"] == "passed"
    assert evidence["reference_url"] == ran.json()["reference_url"]


@pytest.mark.asyncio
async def test_run_all_sandbox_workflows_records_all_passing_evidence(
    client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "use_sandbox_adapters", True)
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "sandbox")

    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")

    ran = await client.post(
        "/api/integrations/config/fax/sandbox-workflows/run-all",
        headers=auth_headers,
    )
    updated = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    updated_fax = next(item for item in updated.json()["data"] if item["key"] == "fax")
    sandbox_step = next(step for step in updated_fax["steps"] if step["key"] == "sandbox_workflows")

    assert ran.status_code == 201
    assert ran.json()["integration"] == "fax"
    assert ran.json()["passed_count"] == len(fax["sandbox_tests"])
    assert len(ran.json()["evidence"]) == len(fax["sandbox_tests"])
    assert all(item["status"] == "passed" for item in updated_fax["sandbox_evidence"])
    assert sandbox_step["status"] == "ready"


@pytest.mark.asyncio
async def test_local_sandbox_success_does_not_claim_production_vendor_readiness(
    client: AsyncClient,
    auth_headers,
    monkeypatch: pytest.MonkeyPatch,
):
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "use_sandbox_adapters", True)
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "sandbox")

    ran = await client.post(
        "/api/integrations/config/fax/sandbox-workflows/run-all",
        headers=auth_headers,
    )
    updated = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in updated.json()["data"] if item["key"] == "fax")
    sandbox_step = next(step for step in fax["steps"] if step["key"] == "sandbox_workflows")

    assert ran.status_code == 201
    assert fax["readiness_mode"] == "local_sandbox"
    assert fax["sandbox_ready"] is True
    assert fax["production_ready"] is False
    assert fax["status"] == "staged"
    assert sandbox_step["status"] == "ready"
    assert any("production vendor" in blocker.lower() for blocker in fax["blockers"])


@pytest.mark.asyncio
async def test_production_vendor_readiness_requires_vendor_reference_urls(
    client: AsyncClient,
    db: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
):
    user = await make_user(
        db,
        UserRole.admin,
        "vendor-reference-admin@example.com",
        organization_id="vendor-reference-org",
    )
    auth_headers = headers_for(user)
    integration_config_service._draft_values.clear()
    integration_config_service._last_tests.clear()
    monkeypatch.setattr(integration_config_service.settings, "fax_provider_api_key", "fax-secret-1234")

    async def fake_health_by_key():
        return {
            "fax_provider": {
                "ok": True,
                "configured": True,
                "adapter_implemented": True,
                "adapter_detail": "Fax adapter is connected to the vendor sandbox.",
                "readiness_mode": "production_vendor",
                "sandbox_ready": False,
                "production_ready": True,
            }
        }

    monkeypatch.setattr(integration_config_service, "_health_by_key", fake_health_by_key)
    preflight = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax = next(item for item in preflight.json()["data"] if item["key"] == "fax")

    for test_label in fax["sandbox_tests"]:
        evidence = await client.post(
            "/api/integrations/config/fax/sandbox-evidence",
            json={
                "test_label": test_label,
                "status": "passed",
                "notes": f"Vendor sandbox proof for {test_label}, reference pending.",
            },
            headers=auth_headers,
        )
        assert evidence.status_code == 201

    missing_references = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    fax_without_refs = next(item for item in missing_references.json()["data"] if item["key"] == "fax")
    sandbox_step = next(step for step in fax_without_refs["steps"] if step["key"] == "sandbox_workflows")

    assert fax_without_refs["readiness_mode"] == "production_vendor"
    assert fax_without_refs["production_ready"] is False
    assert fax_without_refs["status"] == "staged"
    assert sandbox_step["status"] == "pending"
    assert any("vendor sandbox reference" in blocker.lower() for blocker in fax_without_refs["blockers"])

    for test_label in fax["sandbox_tests"]:
        evidence = await client.post(
            "/api/integrations/config/fax/sandbox-evidence",
            json={
                "test_label": test_label,
                "status": "passed",
                "notes": f"Vendor sandbox proof for {test_label}.",
                "reference_url": f"https://vendor.example.test/fax/{test_label.replace(' ', '-').lower()}",
            },
            headers=auth_headers,
        )
        assert evidence.status_code == 201

    ready = await client.get("/api/integrations/credential-preflight", headers=auth_headers)
    ready_fax = next(item for item in ready.json()["data"] if item["key"] == "fax")
    ready_sandbox_step = next(step for step in ready_fax["steps"] if step["key"] == "sandbox_workflows")

    assert ready_fax["production_ready"] is True
    assert ready_fax["status"] == "ready"
    assert ready_sandbox_step["status"] == "ready"


@pytest.mark.asyncio
async def test_provider_cannot_manage_integration_config(
    client: AsyncClient,
    db: AsyncSession,
):
    provider = await make_user(db, UserRole.provider, "integration-config-provider@example.com")

    listed = await client.get("/api/integrations/config", headers=headers_for(provider))
    preflight = await client.get("/api/integrations/credential-preflight", headers=headers_for(provider))
    tested = await client.post("/api/integrations/config/ehr/test", headers=headers_for(provider))
    ran = await client.post(
        "/api/integrations/config/ehr/sandbox-workflows/run",
        json={"test_label": "Fetch a test patient demographic record"},
        headers=headers_for(provider),
    )
    ran_all = await client.post(
        "/api/integrations/config/ehr/sandbox-workflows/run-all",
        headers=headers_for(provider),
    )
    evidence = await client.post(
        "/api/integrations/config/ehr/sandbox-evidence",
        json={"test_label": "Fetch a test patient demographic record", "status": "passed"},
        headers=headers_for(provider),
    )

    assert listed.status_code == 403
    assert preflight.status_code == 403
    assert tested.status_code == 403
    assert ran.status_code == 403
    assert ran_all.status_code == 403
    assert evidence.status_code == 403
