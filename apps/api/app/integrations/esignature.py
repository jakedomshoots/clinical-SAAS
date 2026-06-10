"""Electronic signature and consent management.

Provides HIPAA-compliant e-signatures for patient consent forms,
treatment agreements, and financial responsibility documents.
Uses DocuSign or HelloSign API for legally binding signatures.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import settings


class DocuSignClient:
    """DocuSign eSignature REST API client."""

    def __init__(self, api_key: str | None = None, account_id: str | None = None) -> None:
        self._api_key = api_key or settings.docusign_api_key
        self._account_id = account_id or settings.docusign_account_id
        self._base_url = settings.docusign_base_url or "https://demo.docusign.net/restapi"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )

    async def send_envelope(
        self,
        template_id: str | None = None,
        document_base64: str | None = None,
        document_name: str = "Consent Form",
        signers: list[dict] | None = None,
        email_subject: str = "Please sign your consent form",
        email_body: str = "",
        custom_fields: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send a document for e-signature."""
        envelope = {
            "emailSubject": email_subject,
            "emailBlurb": email_body,
            "status": "sent",
        }

        if template_id:
            envelope["templateId"] = template_id
            envelope["templateRoles"] = signers or []
        elif document_base64:
            envelope["documents"] = [
                {
                    "documentBase64": document_base64,
                    "name": document_name,
                    "fileExtension": "pdf",
                    "documentId": "1",
                }
            ]
            envelope["recipients"] = {
                "signers": [
                    {
                        "email": s["email"],
                        "name": s["name"],
                        "recipientId": str(i + 1),
                        "routingOrder": str(i + 1),
                        "tabs": {
                            "signHereTabs": [
                                {
                                    "documentId": "1",
                                    "pageNumber": s.get("page", "1"),
                                    "xPosition": s.get("x", "100"),
                                    "yPosition": s.get("y", "100"),
                                }
                            ],
                            "dateSignedTabs": [
                                {
                                    "documentId": "1",
                                    "pageNumber": s.get("page", "1"),
                                    "xPosition": s.get("date_x", "300"),
                                    "yPosition": s.get("date_y", "100"),
                                }
                            ],
                        },
                    }
                    for i, s in enumerate(signers or [])
                ]
            }

        if custom_fields:
            envelope["customFields"] = {
                "textCustomFields": [{"name": k, "value": v} for k, v in custom_fields.items()]
            }

        if not self._api_key:
            return {
                "status": "demo",
                "envelope_id": f"demo-{datetime.now(UTC).isoformat()}",
                "message": "DocuSign not configured — demo mode",
            }

        async with self._client() as client:
            resp = await client.post(
                f"/v2.1/accounts/{self._account_id}/envelopes",
                json=envelope,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_envelope_status(self, envelope_id: str) -> dict[str, Any]:
        """Check status of an envelope."""
        if not self._api_key:
            return {"status": "demo", "envelope_id": envelope_id}

        async with self._client() as client:
            resp = await client.get(f"/v2.1/accounts/{self._account_id}/envelopes/{envelope_id}")
            resp.raise_for_status()
            return resp.json()

    async def get_signed_document(self, envelope_id: str, document_id: str = "1") -> bytes:
        """Download the signed PDF document."""
        async with self._client() as client:
            resp = await client.get(
                f"/v2.1/accounts/{self._account_id}/envelopes/{envelope_id}/documents/{document_id}"
            )
            resp.raise_for_status()
            return resp.content

    async def void_envelope(
        self, envelope_id: str, reason: str = "Voided by sender"
    ) -> dict[str, Any]:
        """Void an in-flight envelope."""
        async with self._client() as client:
            resp = await client.put(
                f"/v2.1/accounts/{self._account_id}/envelopes/{envelope_id}",
                json={"status": "voided", "voidedReason": reason},
            )
            resp.raise_for_status()
            return resp.json()


class ConsentManager:
    """High-level consent management for clinical workflows."""

    CONSENT_TYPES: dict[str, dict] = {
        "treatment": {
            "name": "Consent to Treatment",
            "description": "General consent for medical treatment",
            "required": True,
        },
        "telehealth": {
            "name": "Telehealth Consent",
            "description": "Consent for video-based medical visits",
            "required": True,
        },
        "release_of_info": {
            "name": "Release of Information",
            "description": "Authorization to release medical records",
            "required": False,
        },
        "financial": {
            "name": "Financial Responsibility",
            "description": "Agreement to pay for services rendered",
            "required": True,
        },
        "minor": {
            "name": "Minor Consent",
            "description": "Parent/guardian consent for minor treatment",
            "required": True,
        },
        "vaccine": {
            "name": "Vaccine Information Statement (VIS)",
            "description": "Acknowledgment of vaccine risks and benefits",
            "required": True,
        },
        "procedure": {
            "name": "Procedure-Specific Consent",
            "description": "Informed consent for specific procedure",
            "required": True,
        },
    }

    @classmethod
    def get_consent_template(cls, consent_type: str) -> dict:
        """Get template metadata for a consent type."""
        return cls.CONSENT_TYPES.get(
            consent_type,
            {
                "name": "Generic Consent",
                "description": "General consent form",
                "required": False,
            },
        )

    @classmethod
    def list_consent_types(cls) -> dict[str, dict]:
        """List all available consent types."""
        return cls.CONSENT_TYPES
