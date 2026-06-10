"""Electronic signature and consent management router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.esignature import ConsentManager, DocuSignClient
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/esignature", tags=["eSignature"])


@router.get("/consent-types")
async def list_consent_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, dict]:
    """List available consent form types."""
    return ConsentManager.list_consent_types()


@router.post("/send")
async def send_for_signature(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Send a document for e-signature."""
    client = DocuSignClient()
    result = await client.send_envelope(
        template_id=data.get("template_id"),
        document_base64=data.get("document_base64"),
        document_name=data.get("document_name", "Consent Form"),
        signers=data.get("signers", []),
        email_subject=data.get("email_subject", "Please sign your consent form"),
        email_body=data.get("email_body", ""),
        custom_fields=data.get("custom_fields"),
    )
    return result


@router.get("/envelopes/{envelope_id}/status")
async def get_envelope_status(
    envelope_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check status of an e-signature envelope."""
    client = DocuSignClient()
    return await client.get_envelope_status(envelope_id)


@router.get("/envelopes/{envelope_id}/download")
async def download_signed_document(
    envelope_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Download a signed document."""
    client = DocuSignClient()
    content = await client.get_signed_document(envelope_id)
    return {
        "envelope_id": envelope_id,
        "size_bytes": len(content),
        "download_url": f"/api/v1/esignature/envelopes/{envelope_id}/file",
    }


@router.post("/envelopes/{envelope_id}/void")
async def void_envelope(
    envelope_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Void an in-flight envelope."""
    client = DocuSignClient()
    return await client.void_envelope(envelope_id, data.get("reason", "Voided by sender"))
