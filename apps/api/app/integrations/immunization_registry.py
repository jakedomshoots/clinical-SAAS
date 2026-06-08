"""Immunization registry integration for state IIS reporting.

Supports HL7 V2.5.1 message generation for vaccine administration
reporting to state immunization information systems.

Common registries: ImmTrac2 (TX), CAIR2 (CA), NYSIIS (NY), FL SHOTS,
MCIR (MI), and others via AIRA connections.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings


class ImmunizationRegistryClient:
    """Client for submitting immunization data to state registries."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None) -> None:
        self._api_key = api_key or settings.immunization_registry_api_key
        self._base_url = base_url or settings.immunization_registry_base_url
        self._facility_id = settings.immunization_registry_facility_id
        self._provider_id = settings.immunization_registry_provider_id

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/hl7-v2"},
            timeout=60.0,
        )

    # ------------------------------------------------------------------
    # HL7 V2.5.1 message generation
    # ------------------------------------------------------------------

    def generate_vxu_message(
        self,
        patient_id: str,
        patient_first_name: str,
        patient_last_name: str,
        patient_dob: str,
        patient_gender: str,
        patient_address: dict | None,
        patient_phone: str | None,
        vaccine_cvx: str,
        vaccine_name: str,
        vaccine_lot: str | None,
        vaccine_mvx: str | None,
        administered_date: str,
        administered_by_npi: str,
        administered_by_name: str,
        site: str | None = None,
        route: str | None = None,
        dose_number: int | None = None,
        vis_given: bool = True,
        vis_date: str | None = None,
    ) -> str:
        """Generate HL7 VXU^V04 message for vaccine administration."""
        now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        msg_id = f"VXU-{patient_id}-{now}"

        # MSH segment
        msh = (
            f"MSH|^~\\&|CONCIERGEOS|{self._facility_id}|{self._facility_id}|"
            f"IIS|{now[:8]}|{now[8:]}|VXU^V04^VXU_V04|{msg_id}|P|2.5.1"
        )

        # PID segment
        pid = (
            f"PID|1||{patient_id}^^^CONCIERGEOS^MR||"
            f"{patient_last_name}^{patient_first_name}||"
            f"{patient_dob.replace('-', '')}|{patient_gender[0].upper()}"
        )
        if patient_address:
            addr = patient_address
            pid += (
                f"|||{addr.get('street', '')}^{addr.get('city', '')}^"
                f"{addr.get('state', '')}^{addr.get('zip', '')}^USA"
            )
        if patient_phone:
            pid += f"||^{patient_phone}"

        # ORC segment
        orc = (
            f"ORC|RE||{msg_id}|||||||||"
            f"{administered_by_npi}^^^^^^^^NPI^{administered_by_name}"
        )

        # RXA segment
        rxa = (
            f"RXA|0|1|{administered_date.replace('-', '')}|"
            f"{administered_date.replace('-', '')}|"
            f"{vaccine_cvx}^^{vaccine_name}^CVX|"
        )
        if dose_number:
            rxa += f"{dose_number}"
        rxa += f"|{site or ''}^{route or ''}|"
        if vaccine_lot:
            rxa += f"{vaccine_lot}"
        rxa += f"|{vaccine_mvx or ''}"

        # RXR segment
        rxr = f"RXR|{route or 'C28161'}^IM^NCIT|{site or 'LA'}^Left Arm^HL70163"

        # OBX segments for VIS
        obx_segments = []
        if vis_given:
            vis_dt = (vis_date or administered_date).replace("-", "")
            obx_segments.append(
                f"OBX|1|CE|59784-9^Disease with vaccine type^LN|1|"
                f"{vaccine_cvx}^^{vaccine_name}^CVX||||||F"
            )
            obx_segments.append(
                f"OBX|2|DT|29769-7^VIS Publication Date^LN|1|{vis_dt}||||||F"
            )
            obx_segments.append(
                f"OBX|3|CE|59785-6^VIS Presentation Date^LN|1|{vis_dt}||||||F"
            )

        segments = [msh, pid, orc, rxa, rxr] + obx_segments
        return "\r".join(segments) + "\r"

    # ------------------------------------------------------------------
    # Registry submission
    # ------------------------------------------------------------------

    async def submit_vaccination(
        self,
        patient_id: str,
        patient_first_name: str,
        patient_last_name: str,
        patient_dob: str,
        patient_gender: str,
        vaccine_cvx: str,
        vaccine_name: str,
        administered_date: str,
        administered_by_npi: str,
        administered_by_name: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Submit a vaccination record to the state registry."""
        hl7_message = self.generate_vxu_message(
            patient_id=patient_id,
            patient_first_name=patient_first_name,
            patient_last_name=patient_last_name,
            patient_dob=patient_dob,
            patient_gender=patient_gender,
            vaccine_cvx=vaccine_cvx,
            vaccine_name=vaccine_name,
            administered_date=administered_date,
            administered_by_npi=administered_by_npi,
            administered_by_name=administered_by_name,
            **kwargs,
        )

        if not self._base_url:
            return {
                "status": "demo",
                "message": "Immunization registry not configured",
                "hl7_preview": hl7_message[:200] + "...",
            }

        async with self._client() as client:
            resp = await client.post("/submit", content=hl7_message)
            resp.raise_for_status()
            return {
                "status": "submitted",
                "registry_response": resp.text,
                "hl7_message_length": len(hl7_message),
            }

    async def query_patient_history(
        self,
        patient_id: str,
        patient_first_name: str,
        patient_last_name: str,
        patient_dob: str,
    ) -> dict[str, Any]:
        """Query state registry for patient's immunization history."""
        now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        msg_id = f"QBP-{patient_id}-{now}"

        qbp = (
            f"QBP^Q11^QBP_Q11|{msg_id}|P|2.5.1\r"
            f"QPD|Z34^Request Immunization History^CDCPHINVS|"
            f"{msg_id}|{patient_last_name}^{patient_first_name}|"
            f"{patient_dob.replace('-', '')}"
        )

        if not self._base_url:
            return {"status": "demo", "message": "Registry not configured"}

        async with self._client() as client:
            resp = await client.post("/query", content=qbp)
            resp.raise_for_status()
            return {"status": "queried", "registry_response": resp.text}


# ---------------------------------------------------------------------------
# State-specific registry configurations
# ---------------------------------------------------------------------------

STATE_REGISTRY_URLS: dict[str, str] = {
    "TX": "https://www.immtrac.tdh.texas.gov/api",
    "CA": "https://cair2.cdph.ca.gov/api",
    "NY": "https://nysiis.ny.gov/api",
    "FL": "https://fshots.flshots.com/api",
    "MI": "https://mcir.org/api",
    "PA": "https://pa.panow.com/api",
    "OH": "https://impactsiis.org/api",
    "IL": "https://i-cares.illinois.gov/api",
    "NC": "https://ncirs.nc.gov/api",
    "GA": "https://grits.georgia.gov/api",
}


def get_registry_for_state(state_code: str) -> str | None:
    """Get registry API URL for a state."""
    return STATE_REGISTRY_URLS.get(state_code.upper())
