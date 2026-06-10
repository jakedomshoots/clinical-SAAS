"""LabCorp integration adapter.

Handles lab order submission and result retrieval via
LabCorp's Link API or HL7 interface.

API Docs: https://www.labcorp.com/healthcare-providers/technology-integration
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class LabCorpClient(ConfiguredIntegration):
    """LabCorp Link API client."""

    name = "labcorp"
    env_var = "LABCORP_API_KEY"
    adapter_detail = "LabCorp Link API — lab orders and results"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings

        base_url = getattr(settings, "labcorp_api_base_url", "https://api.labcorp.com/v2")
        if not base_url:
            base_url = "https://api.labcorp.com/v2"
        return httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    @with_api_retry(circuit_breaker="labcorp")
    async def submit_lab_order(
        self,
        patient_id: str,
        test_codes: list[str],
        provider_id: str,
        urgency: str = "routine",
        diagnosis_codes: list[str] | None = None,
    ) -> dict[str, Any]:
        """Submit a lab order to LabCorp.

        Args:
            patient_id: Internal patient identifier
            test_codes: LabCorp test codes (e.g. ["CBC", "CMP"])
            provider_id: Ordering provider ID
            urgency: "routine", "urgent", or "stat"
            diagnosis_codes: ICD-10 diagnosis codes
        """
        self.require_configured()

        payload: dict[str, Any] = {
            "patient_id": patient_id,
            "tests": [{"code": code} for code in test_codes],
            "ordering_provider_id": provider_id,
            "priority": urgency,
        }

        if diagnosis_codes:
            payload["diagnoses"] = [{"code": code} for code in diagnosis_codes]

        async with self._client() as client:
            response = await client.post("/orders", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "order_id": data.get("order_id"),
            "status": data.get("status", "submitted"),
            "patient_id": patient_id,
            "test_codes": test_codes,
            "created_at": data.get("created_at"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="labcorp")
    async def get_results(
        self,
        patient_id: str | None = None,
        order_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get lab results from LabCorp.

        Args:
            patient_id: Filter by patient
            order_id: Filter by specific order
            start_date: Results from date (YYYY-MM-DD)
            end_date: Results to date (YYYY-MM-DD)
        """
        self.require_configured()

        params: dict[str, str] = {}
        if patient_id:
            params["patient_id"] = patient_id
        if order_id:
            params["order_id"] = order_id
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date

        async with self._client() as client:
            response = await client.get("/results", params=params)
            response.raise_for_status()
            data = response.json()

        results = data.get("results", [])
        return [
            {
                "result_id": r.get("result_id"),
                "order_id": r.get("order_id"),
                "patient_id": r.get("patient_id"),
                "test_code": r.get("test_code"),
                "test_name": r.get("test_name"),
                "value": r.get("value"),
                "unit": r.get("unit"),
                "reference_range": r.get("reference_range"),
                "status": r.get("status"),
                "abnormal_flag": r.get("abnormal_flag"),
                "resulted_at": r.get("resulted_at"),
            }
            for r in results
        ]

    @with_api_retry(circuit_breaker="labcorp")
    async def get_order_status(self, order_id: str) -> dict[str, Any]:
        """Check status of a lab order."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/orders/{order_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "order_id": order_id,
            "status": data.get("status"),
            "patient_id": data.get("patient_id"),
            "test_codes": [t.get("code") for t in data.get("tests", [])],
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="labcorp")
    async def cancel_order(self, order_id: str, reason: str = "") -> dict[str, Any]:
        """Cancel a pending lab order."""
        self.require_configured()

        payload: dict[str, Any] = {"status": "cancelled"}
        if reason:
            payload["cancellation_reason"] = reason

        async with self._client() as client:
            response = await client.patch(f"/orders/{order_id}", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "order_id": order_id,
            "status": "cancelled",
            "reason": reason,
            "raw_response": data,
        }
