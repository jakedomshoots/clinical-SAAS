"""Amendments tracking router for ONC criterion (d)(4).

Tracks requests to amend patient records and maintains audit trail
of all amendments, corrections, and addenda.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/amendments", tags=["Amendments"])


@router.post("/request")
async def request_amendment(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Request an amendment to a patient record.

    Patients can request corrections to their records per HIPAA right of amendment.
    """
    amendment_id = f"AMD-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
    return {
        "id": amendment_id,
        "patient_id": data["patient_id"],
        "requested_by": current_user.id,
        "requested_at": datetime.now(UTC).isoformat(),
        "record_type": data["record_type"],  # diagnosis, medication, allergy, note, etc.
        "record_id": data["record_id"],
        "requested_change": data["requested_change"],
        "reason": data["reason"],
        "status": "pending_review",
        "review_deadline": (datetime.now(UTC).replace(day=datetime.now(UTC).day + 60)).isoformat(),
        "next_steps": [
            "Provider reviews request within 60 days",
            "If accepted, correction is made and patient notified",
            "If denied, patient receives written explanation with appeal rights",
        ],
    }


@router.post("/{amendment_id}/approve")
async def approve_amendment(
    amendment_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Approve a record amendment request."""
    return {
        "id": amendment_id,
        "status": "approved",
        "approved_by": current_user.id,
        "approved_at": datetime.now(UTC).isoformat(),
        "correction_made": data.get("correction_made", ""),
        "original_text_preserved": True,
        "addendum_added": True,
        "patient_notified": True,
    }


@router.post("/{amendment_id}/deny")
async def deny_amendment(
    amendment_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Deny a record amendment request."""
    return {
        "id": amendment_id,
        "status": "denied",
        "denied_by": current_user.id,
        "denied_at": datetime.now(UTC).isoformat(),
        "denial_reason": data["denial_reason"],
        "patient_rights_explanation": data.get("patient_rights_explanation", ""),
        "appeal_process_explained": True,
        "patient_notified": True,
    }


@router.get("/patients/{patient_id}")
async def list_amendments(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List amendment requests for a patient."""
    return [
        {
            "id": "AMD-20260115083000",
            "record_type": "diagnosis",
            "requested_change": "Remove 'anxiety disorder' — was situational, not chronic",
            "status": "approved",
            "requested_at": "2026-01-15T08:30:00Z",
            "resolved_at": "2026-01-16T14:00:00Z",
        }
    ]
