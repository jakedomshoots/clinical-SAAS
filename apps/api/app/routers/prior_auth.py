"""Prior authorization workflow router.

Manages electronic prior authorization (ePA) submissions,
status tracking, and appeals for medications and procedures.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/prior-auth", tags=["Prior Authorization"])


# ---------------------------------------------------------------------------
# ePA status tracking model (simplified — real implementation uses
# CoverMyMeds or Surescripts ePA API)
# ---------------------------------------------------------------------------

class PriorAuthStatus:
    draft = "draft"
    submitted = "submitted"
    pending_info = "pending_info"
    approved = "approved"
    denied = "denied"
    appealed = "appealed"
    cancelled = "cancelled"


# Common medications/procedures requiring prior auth
PRIOR_AUTH_REQUIRED: dict[str, dict] = {
    "adalimumab": {"category": "biologic", "common_indications": ["RA", "PsA", "CD", "UC"]},
    "etanercept": {"category": "biologic", "common_indications": ["RA", "PsA", "AS"]},
    "infliximab": {"category": "biologic", "common_indications": ["RA", "CD", "UC", "PsA"]},
    "ozempic": {"category": "GLP-1", "common_indications": ["T2DM", "obesity"]},
    "wegovy": {"category": "GLP-1", "common_indications": ["obesity"]},
    "mounjaro": {"category": "GLP-1/GIP", "common_indications": ["T2DM"]},
    "viagra": {"category": "ED", "common_indications": ["erectile dysfunction"]},
    "cialis": {"category": "ED", "common_indications": ["erectile dysfunction", "BPH"]},
    "modafinil": {"category": "stimulant", "common_indications": ["narcolepsy", "OSA"]},
    "armodafinil": {"category": "stimulant", "common_indications": ["narcolepsy", "OSA"]},
}


# CPT codes commonly requiring prior auth
PROCEDURE_PRIOR_AUTH: dict[str, dict] = {
    "29827": {"name": "Shoulder arthroscopy with rotator cuff repair", "category": "orthopedic"},
    "23472": {"name": "Shoulder repair", "category": "orthopedic"},
    "27447": {"name": "Total knee arthroplasty", "category": "orthopedic"},
    "27130": {"name": "Total hip arthroplasty", "category": "orthopedic"},
    "45378": {"name": "Colonoscopy", "category": "GI"},
    "43239": {"name": "EGD with biopsy", "category": "GI"},
    "93306": {"name": "Echocardiography", "category": "cardiology"},
    "78452": {"name": "Myocardial perfusion imaging", "category": "cardiology"},
    "72148": {"name": "MRI lumbar spine", "category": "radiology"},
    "73721": {"name": "MRI knee", "category": "radiology"},
    "70553": {"name": "MRI brain with contrast", "category": "radiology"},
}


@router.get("/check-medication/{medication_name}")
async def check_medication_prior_auth(
    medication_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check if a medication commonly requires prior authorization."""
    med_lower = medication_name.lower()
    match = PRIOR_AUTH_REQUIRED.get(med_lower)
    if match:
        return {
            "medication": medication_name,
            "prior_auth_likely_required": True,
            "category": match["category"],
            "common_indications": match["common_indications"],
            "recommendation": "Submit ePA before prescribing",
        }
    return {
        "medication": medication_name,
        "prior_auth_likely_required": False,
        "recommendation": "Standard prescription — ePA likely not needed",
    }


@router.get("/check-procedure/{cpt_code}")
async def check_procedure_prior_auth(
    cpt_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check if a CPT code commonly requires prior authorization."""
    match = PROCEDURE_PRIOR_AUTH.get(cpt_code)
    if match:
        return {
            "cpt_code": cpt_code,
            "procedure": match["name"],
            "prior_auth_likely_required": True,
            "category": match["category"],
            "recommendation": "Obtain prior auth before scheduling",
        }
    return {
        "cpt_code": cpt_code,
        "prior_auth_likely_required": False,
        "recommendation": "Standard procedure — prior auth likely not needed",
    }


@router.post("/submissions")
async def create_prior_auth(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a prior authorization request."""
    pa_id = f"PA-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    return {
        "id": pa_id,
        "status": PriorAuthStatus.submitted,
        "patient_id": data["patient_id"],
        "medication_or_procedure": data.get("medication") or data.get("cpt_code"),
        "payer_id": data.get("payer_id"),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "submitted_by": current_user.id,
        "estimated_response_time": "24-72 hours",
        "next_steps": [
            "Monitor status via payer portal",
            "Respond to any requests for additional information",
            "Contact patient when decision received",
        ],
    }


@router.get("/submissions/{pa_id}/status")
async def get_prior_auth_status(
    pa_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get status of a prior authorization request."""
    # In production, this queries CoverMyMeds or payer API
    return {
        "id": pa_id,
        "status": PriorAuthStatus.pending_info,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "payer_response": "Additional clinical documentation required",
        "required_documents": [
            "Chart notes supporting medical necessity",
            "Failed medication history (if applicable)",
            "Lab results supporting diagnosis",
        ],
    }


@router.post("/submissions/{pa_id}/appeal")
async def appeal_prior_auth(
    pa_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Appeal a denied prior authorization."""
    return {
        "id": pa_id,
        "status": PriorAuthStatus.appealed,
        "appeal_submitted_at": datetime.now(timezone.utc).isoformat(),
        "appeal_reason": data.get("reason", "Medical necessity"),
        "supporting_documents": data.get("documents", []),
        "estimated_response_time": "5-10 business days",
    }


@router.get("/dashboard")
async def prior_auth_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get prior authorization dashboard summary."""
    return {
        "total_pending": 12,
        "total_approved_this_month": 45,
        "total_denied_this_month": 8,
        "average_response_time_hours": 48,
        "pending_actions": [
            {
                "pa_id": "PA-20260115083000",
                "patient": "John Doe",
                "medication": "Adalimumab",
                "status": "pending_info",
                "action_needed": "Upload chart notes",
                "due_date": "2026-01-17",
            },
            {
                "pa_id": "PA-20260114091500",
                "patient": "Jane Smith",
                "procedure": "MRI Lumbar Spine (72148)",
                "status": "submitted",
                "action_needed": "Awaiting payer response",
                "due_date": "2026-01-18",
            },
        ],
    }
