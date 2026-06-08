"""Availity clearinghouse integration adapter.

Handles insurance eligibility verification, claim submission,
and remittance advice via Availity Essentials API.

API Docs: https://developer.availity.com/
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class AvailityClient(ConfiguredIntegration):
    """Availity clearinghouse client."""

    name = "availity"
    env_var = "AVAILITY_API_KEY"
    adapter_detail = "Availity — insurance eligibility, claims, and remittance"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings
        base_url = getattr(settings, "availity_api_base_url", "https://api.availity.com/v1")
        if not base_url:
            base_url = "https://api.availity.com/v1"
        return httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    @with_api_retry(circuit_breaker="availity")
    async def check_eligibility(
        self,
        patient_id: str,
        insurance_member_id: str,
        insurance_group_number: str | None = None,
        npi: str = "",
        service_type: str = "30",  # 30 = health benefit plan coverage
    ) -> dict[str, Any]:
        """Check patient insurance eligibility.

        Args:
            patient_id: Internal patient ID
            insurance_member_id: Member ID from insurance card
            insurance_group_number: Group/policy number
            npi: Provider NPI
            service_type: X12 service type code
        """
        self.require_configured()

        payload: dict[str, Any] = {
            "memberId": insurance_member_id,
            "providerNpi": npi,
            "serviceTypeCodes": [service_type],
        }
        if insurance_group_number:
            payload["groupNumber"] = insurance_group_number

        async with self._client() as client:
            response = await client.post("/eligibility", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "patient_id": patient_id,
            "eligible": data.get("active", False),
            "plan_name": data.get("planName"),
            "coverage_start": data.get("coverageStartDate"),
            "coverage_end": data.get("coverageEndDate"),
            "copay": data.get("copay"),
            "deductible": data.get("deductible"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="availity")
    async def submit_claim(
        self,
        patient_id: str,
        claim_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Submit an insurance claim.

        Args:
            patient_id: Internal patient ID
            claim_data: Claim payload (X12 837 format or JSON)
        """
        self.require_configured()

        async with self._client() as client:
            response = await client.post("/claims", json=claim_data)
            response.raise_for_status()
            data = response.json()

        return {
            "claim_id": data.get("claimId"),
            "status": data.get("status", "submitted"),
            "patient_id": patient_id,
            "submitted_at": data.get("submittedAt"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="availity")
    async def get_claim_status(
        self,
        claim_id: str,
    ) -> dict[str, Any]:
        """Check status of a submitted claim."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/claims/{claim_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "claim_id": claim_id,
            "status": data.get("status"),
            "payer": data.get("payerName"),
            "billed_amount": data.get("billedAmount"),
            "paid_amount": data.get("paidAmount"),
            "submitted_at": data.get("submittedAt"),
            "updated_at": data.get("updatedAt"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="availity")
    async def get_remittance_advice(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get remittance advice (ERA/835) data.

        Args:
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
            limit: Max results
        """
        self.require_configured()

        params: dict[str, str | int] = {"limit": limit}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        async with self._client() as client:
            response = await client.get("/remittance", params=params)
            response.raise_for_status()
            data = response.json()

        remittances = data.get("remittances", [])
        return [
            {
                "remittance_id": r.get("id"),
                "payer": r.get("payerName"),
                "check_amount": r.get("checkAmount"),
                "check_date": r.get("checkDate"),
                "claim_count": r.get("claimCount"),
            }
            for r in remittances
        ]

    @with_api_retry(circuit_breaker="availity")
    async def get_payer_list(
        self,
        search: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Search available insurance payers.

        Args:
            search: Payer name search term
            limit: Max results
        """
        self.require_configured()

        params: dict[str, str | int] = {"limit": limit}
        if search:
            params["search"] = search

        async with self._client() as client:
            response = await client.get("/payers", params=params)
            response.raise_for_status()
            data = response.json()

        payers = data.get("payers", [])
        return [
            {
                "payer_id": p.get("id"),
                "name": p.get("name"),
                "payer_id_number": p.get("payerId"),
            }
            for p in payers
        ]
