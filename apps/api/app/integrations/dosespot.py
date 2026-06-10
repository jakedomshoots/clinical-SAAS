"""DoseSpot eRx integration adapter.

Handles e-prescribing, medication history, and pharmacy lookup
via DoseSpot API.

API Docs: https://www.dosespot.com/api-documentation/
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class DoseSpotClient(ConfiguredIntegration):
    """DoseSpot eRx client."""

    name = "dosespot"
    env_var = "DOSESPOT_API_KEY"
    adapter_detail = "DoseSpot — e-prescribing, medication history, pharmacy lookup"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings

        base_url = getattr(settings, "dosespot_api_base_url", "https://my.dosespot.com/webapi")
        if not base_url:
            base_url = "https://my.dosespot.com/webapi"
        return httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

    @with_api_retry(circuit_breaker="dosespot")
    async def prescribe(
        self,
        patient_id: str,
        provider_id: str,
        medication_name: str,
        strength: str,
        quantity: str,
        directions: str,
        pharmacy_id: str,
        refills: int = 0,
        substitution_allowed: bool = True,
        diagnosis_codes: list[str] | None = None,
    ) -> dict[str, Any]:
        """Send an e-prescription.

        Args:
            patient_id: Internal patient ID
            provider_id: Prescribing provider ID
            medication_name: Drug name
            strength: e.g. "10mg"
            quantity: e.g. "30 tablets"
            directions: Patient directions (sig)
            pharmacy_id: DoseSpot pharmacy ID
            refills: Number of refills
            substitution_allowed: Generic substitution OK
            diagnosis_codes: ICD-10 codes
        """
        self.require_configured()

        payload: dict[str, Any] = {
            "PatientId": patient_id,
            "PrescriberId": provider_id,
            "Medication": medication_name,
            "Strength": strength,
            "Quantity": quantity,
            "Directions": directions,
            "PharmacyId": pharmacy_id,
            "Refills": refills,
            "Substitution": "Allowed" if substitution_allowed else "Not Allowed",
        }

        if diagnosis_codes:
            payload["DiagnosisCodes"] = diagnosis_codes

        async with self._client() as client:
            response = await client.post("/api/prescriptions", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "prescription_id": data.get("PrescriptionId"),
            "status": data.get("Status", "sent"),
            "patient_id": patient_id,
            "pharmacy_id": pharmacy_id,
            "medication": medication_name,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="dosespot")
    async def get_medication_history(
        self,
        patient_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        """Get patient's medication history from Surescripts.

        Args:
            patient_id: Internal patient ID
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
        """
        self.require_configured()

        params: dict[str, str] = {"patientId": patient_id}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        async with self._client() as client:
            response = await client.get("/api/medicationhistory", params=params)
            response.raise_for_status()
            data = response.json()

        medications = data.get("Medications", [])
        return [
            {
                "medication_id": m.get("MedicationId"),
                "name": m.get("DrugName"),
                "strength": m.get("Strength"),
                "directions": m.get("Directions"),
                "pharmacy": m.get("PharmacyName"),
                "prescriber": m.get("PrescriberName"),
                "date_filled": m.get("DateFilled"),
                "quantity": m.get("Quantity"),
                "refills_remaining": m.get("RefillsRemaining"),
            }
            for m in medications
        ]

    @with_api_retry(circuit_breaker="dosespot")
    async def search_pharmacies(
        self,
        zip_code: str,
        radius_miles: int = 10,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Search pharmacies near a ZIP code.

        Args:
            zip_code: 5-digit ZIP
            radius_miles: Search radius
            limit: Max results
        """
        self.require_configured()

        params = {
            "zip": zip_code,
            "radius": radius_miles,
            "limit": limit,
        }

        async with self._client() as client:
            response = await client.get("/api/pharmacies", params=params)
            response.raise_for_status()
            data = response.json()

        pharmacies = data.get("Pharmacies", [])
        return [
            {
                "pharmacy_id": p.get("PharmacyId"),
                "name": p.get("StoreName"),
                "address": p.get("Address"),
                "city": p.get("City"),
                "state": p.get("State"),
                "zip": p.get("Zip"),
                "phone": p.get("Phone"),
                "fax": p.get("Fax"),
                "distance_miles": p.get("Distance"),
            }
            for p in pharmacies
        ]

    @with_api_retry(circuit_breaker="dosespot")
    async def cancel_prescription(
        self,
        prescription_id: str,
        reason: str = "",
    ) -> dict[str, Any]:
        """Cancel a sent prescription.

        Args:
            prescription_id: DoseSpot prescription ID
            reason: Cancellation reason
        """
        self.require_configured()

        payload: dict[str, Any] = {"PrescriptionId": prescription_id}
        if reason:
            payload["Reason"] = reason

        async with self._client() as client:
            response = await client.post("/api/prescriptions/cancel", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "prescription_id": prescription_id,
            "status": "cancelled",
            "reason": reason,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="dosespot")
    async def get_prescription_status(
        self,
        prescription_id: str,
    ) -> dict[str, Any]:
        """Check status of a prescription."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/api/prescriptions/{prescription_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "prescription_id": prescription_id,
            "status": data.get("Status"),
            "pharmacy": data.get("PharmacyName"),
            "medication": data.get("DrugName"),
            "sent_at": data.get("SentDate"),
            "raw_response": data,
        }
