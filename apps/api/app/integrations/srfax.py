"""SRFax integration adapter for HIPAA-compliant fax.

API Docs: https://www.srfax.com/api/
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class SRFaxClient(ConfiguredIntegration):
    """SRFax API client."""

    name = "srfax"
    env_var = "SRFAX_API_KEY"
    adapter_detail = "SRFax — HIPAA-compliant fax sending and receiving"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url="https://www.srfax.com/api",
            timeout=60.0,
        )

    @property
    def _access_id(self) -> str:
        from app.config import settings
        return getattr(settings, "srfax_access_id", "")

    def _payload(self, action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "action": action,
            "access_id": self._access_id,
            "access_pwd": self.api_key,
        }
        if params:
            payload.update(params)
        return payload

    @with_api_retry(circuit_breaker="srfax")
    async def send_fax(
        self,
        to_number: str,
        content: str | None = None,
        file_content: bytes | None = None,
        file_name: str = "document.pdf",
        caller_id: str | None = None,
        cover_page: str = "",
        patient_id: str = "",
    ) -> dict[str, Any]:
        """Send a fax via SRFax.

        Args:
            to_number: Recipient fax number (E.164 format)
            content: Raw text content (converted to PDF by SRFax)
            file_content: PDF bytes to fax
            file_name: Filename for the attachment
            caller_id: Optional caller ID
            cover_page: Cover page text
            patient_id: Internal patient ID for tracking
        """
        self.require_configured()

        params: dict[str, Any] = {
            "sFaxFromName": caller_id or "Concierge OS",
            "sFaxToName": to_number,
            "sToFaxNumber": to_number,
            "sResponseFormat": "JSON",
        }

        if cover_page:
            params["sCoverPage"] = "YES"
            params["sCoverPageInfo"] = cover_page
        else:
            params["sCoverPage"] = "NO"

        if content:
            params["sFaxType"] = "SINGLE"
            params["sFileName_1"] = file_name
            params["sFileContent_1"] = content
        elif file_content:
            import base64
            params["sFaxType"] = "SINGLE"
            params["sFileName_1"] = file_name
            params["sFileContent_1"] = base64.b64encode(file_content).decode()
        else:
            raise ValueError("Either content or file_content must be provided")

        async with self._client() as client:
            response = await client.post(
                "/",
                data=self._payload("Queue_Fax", params),
            )
            response.raise_for_status()
            result = response.json()

        if result.get("Status") != "Success":
            raise RuntimeError(f"SRFax error: {result.get('Result', 'Unknown error')}")

        return {
            "fax_id": result.get("Result"),
            "status": "queued",
            "to": to_number,
            "patient_id": patient_id,
            "raw_response": result,
        }

    @with_api_retry(circuit_breaker="srfax")
    async def get_fax_status(self, fax_id: str) -> dict[str, Any]:
        """Check status of a sent fax."""
        self.require_configured()

        params = {
            "sFaxDetailsID": fax_id,
            "sResponseFormat": "JSON",
        }

        async with self._client() as client:
            response = await client.post(
                "/",
                data=self._payload("Get_FaxStatus", params),
            )
            response.raise_for_status()
            result = response.json()

        if result.get("Status") != "Success":
            raise RuntimeError(f"SRFax error: {result.get('Result', 'Unknown error')}")

        fax_data = result.get("Result", {})
        return {
            "fax_id": fax_id,
            "status": fax_data.get("STATUS"),
            "pages_sent": fax_data.get("PAGES"),
            "sent_at": fax_data.get("DATE"),
            "to": fax_data.get("TO_FAXNUMBER"),
            "raw_response": result,
        }

    @with_api_retry(circuit_breaker="srfax")
    async def list_inbound_faxes(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List received faxes.

        Args:
            start_date: YYYY-MM-DD
            end_date: YYYY-MM-DD
            limit: Max results
        """
        self.require_configured()

        params: dict[str, Any] = {
            "sResponseFormat": "JSON",
            "sPeriod": "RANGE",
            "sStartDate": start_date or "",
            "sEndDate": end_date or "",
        }

        async with self._client() as client:
            response = await client.post(
                "/",
                data=self._payload("Get_Fax_Inbox", params),
            )
            response.raise_for_status()
            result = response.json()

        if result.get("Status") != "Success":
            raise RuntimeError(f"SRFax error: {result.get('Result', 'Unknown error')}")

        faxes = result.get("Result", [])
        return [
            {
                "fax_id": fax.get("FileName"),
                "from": fax.get("CallerID"),
                "to": fax.get("CalledNumber"),
                "pages": fax.get("Pages"),
                "received_at": fax.get("Date"),
                "status": fax.get("Viewed"),
            }
            for fax in faxes[:limit]
        ]

    @with_api_retry(circuit_breaker="srfax")
    async def retrieve_fax(self, fax_id: str) -> bytes:
        """Download a received fax as PDF bytes."""
        self.require_configured()

        params = {
            "sFaxFileName": fax_id,
            "sDirection": "IN",
            "sResponseFormat": "JSON",
        }

        async with self._client() as client:
            response = await client.post(
                "/",
                data=self._payload("Retrieve_Fax", params),
            )
            response.raise_for_status()
            result = response.json()

        if result.get("Status") != "Success":
            raise RuntimeError(f"SRFax error: {result.get('Result', 'Unknown error')}")

        import base64
        return base64.b64decode(result.get("Result", ""))

    @with_api_retry(circuit_breaker="srfax")
    async def delete_fax(self, fax_id: str, direction: str = "IN") -> dict[str, Any]:
        """Delete a fax from inbox or outbox."""
        self.require_configured()

        params = {
            "sFaxFileName": fax_id,
            "sDirection": direction,
            "sResponseFormat": "JSON",
        }

        async with self._client() as client:
            response = await client.post(
                "/",
                data=self._payload("Delete_Fax", params),
            )
            response.raise_for_status()
            result = response.json()

        return {
            "fax_id": fax_id,
            "deleted": result.get("Status") == "Success",
            "raw_response": result,
        }
