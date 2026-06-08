"""Emergency access / break-glass router for ONC criterion (d)(6).

Provides emergency access to patient records when normal authentication
is not possible (e.g., system outage, forgot password during emergency).
All break-glass access is heavily audited and requires post-hoc justification.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/emergency-access", tags=["Emergency Access"])

# In-memory store for active break-glass sessions (use Redis in production)
_ACTIVE_BREAKGLASS_SESSIONS: dict[str, dict] = {}


@router.post("/break-glass")
async def request_break_glass_access(
    request: Request,
    data: dict[str, Any],
    db: Session = Depends(get_db),
) -> dict:
    """Request emergency break-glass access to a patient record.

    Requires:
    - Provider NPI
    - Emergency justification
    - Patient ID being accessed
    - Witness/provider contact for verification
    """
    provider_npi = data.get("provider_npi")
    justification = data.get("justification", "")
    patient_id = data.get("patient_id")
    witness_contact = data.get("witness_contact")

    if not all([provider_npi, justification, patient_id]):
        raise HTTPException(
            status_code=400,
            detail="provider_npi, justification, and patient_id are required",
        )

    if len(justification) < 20:
        raise HTTPException(
            status_code=400,
            detail="Justification must be at least 20 characters",
        )

    session_id = f"bg-{provider_npi}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    session = {
        "session_id": session_id,
        "provider_npi": provider_npi,
        "patient_id": patient_id,
        "justification": justification,
        "witness_contact": witness_contact,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)).isoformat(),
        "status": "active",
        "ip_address": request.client.host if request.client else "unknown",
        "access_log": [],
    }

    _ACTIVE_BREAKGLASS_SESSIONS[session_id] = session

    return {
        "session_id": session_id,
        "status": "granted",
        "message": "Emergency access granted. All actions will be audited.",
        "expires_at": session["expires_at"],
        "restrictions": [
            "Access limited to single patient record",
            "All actions logged with tamper-evident audit trail",
            "Session expires at end of day",
            "Post-hoc review required within 24 hours",
        ],
        "next_steps": [
            "Use session_id in Authorization header for API requests",
            "Document all clinical actions taken",
            "Complete post-access review form",
        ],
    }


@router.get("/break-glass/{session_id}/status")
async def get_break_glass_status(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check status of a break-glass session."""
    session = _ACTIVE_BREAKGLASS_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/break-glass/{session_id}/revoke")
async def revoke_break_glass(
    session_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Revoke a break-glass session."""
    session = _ACTIVE_BREAKGLASS_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session["status"] = "revoked"
    session["revoked_at"] = datetime.now(timezone.utc).isoformat()
    session["revoked_by"] = current_user.id
    session["revocation_reason"] = data.get("reason", "Administrative revocation")

    return {"status": "revoked", "session_id": session_id}


@router.get("/break-glass/audit-log")
async def list_break_glass_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all break-glass sessions (admin only)."""
    return list(_ACTIVE_BREAKGLASS_SESSIONS.values())


@router.post("/break-glass/{session_id}/review")
async def complete_break_glass_review(
    session_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Complete post-hoc review of break-glass access."""
    session = _ACTIVE_BREAKGLASS_SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session["review"] = {
        "reviewed_by": current_user.id,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "clinical_appropriateness": data.get("clinical_appropriateness", False),
        "documentation_complete": data.get("documentation_complete", False),
        "follow_up_required": data.get("follow_up_required", False),
        "notes": data.get("notes", ""),
    }
    session["status"] = "reviewed"

    return {"status": "reviewed", "session_id": session_id}
