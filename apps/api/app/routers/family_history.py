"""Family health history router for ONC criterion (a)(12)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.family_history import FamilyHistoryCondition
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/family-history", tags=["Family History"])


@router.get("/patients/{patient_id}")
async def get_family_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get family health history for a patient."""
    conditions = (
        db.query(FamilyHistoryCondition)
        .filter(FamilyHistoryCondition.patient_id == patient_id)
        .all()
    )
    return [
        {
            "id": c.id,
            "relationship": c.relative_relationship.value,
            "relative_name": c.relative_name,
            "living_status": c.living_status.value,
            "condition": c.condition_name,
            "age_at_diagnosis": c.age_at_diagnosis,
            "is_hereditary_risk": c.is_hereditary_risk,
        }
        for c in conditions
    ]


@router.post("/patients/{patient_id}")
async def add_family_history(
    patient_id: str,
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Add a family history condition."""
    condition = FamilyHistoryCondition(
        patient_id=patient_id,
        relative_relationship=data["relationship"],
        relative_name=data.get("relative_name"),
        living_status=data.get("living_status", "unknown"),
        age_at_diagnosis=data.get("age_at_diagnosis"),
        age_at_death=data.get("age_at_death"),
        cause_of_death=data.get("cause_of_death"),
        condition_name=data["condition_name"],
        condition_code=data.get("condition_code"),
        condition_code_system=data.get("condition_code_system"),
        notes=data.get("notes"),
        is_hereditary_risk=data.get("is_hereditary_risk", False),
    )
    db.add(condition)
    db.commit()
    db.refresh(condition)
    return {"id": condition.id, "status": "created"}


@router.get("/patients/{patient_id}/risk-assessment")
async def assess_hereditary_risk(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Assess hereditary cancer risk based on family history."""
    conditions = (
        db.query(FamilyHistoryCondition)
        .filter(FamilyHistoryCondition.patient_id == patient_id)
        .all()
    )

    risk_factors = []
    recommendations = []

    # Check for BRCA-related cancers
    brca_cancers = {"breast cancer", "ovarian cancer", "pancreatic cancer", "prostate cancer"}
    brca_relatives = [
        c
        for c in conditions
        if c.condition_name.lower() in brca_cancers
        and c.relative_relationship.value
        in ("mother", "sister", "daughter", "maternal_grandmother", "paternal_grandmother")
    ]
    if len(brca_relatives) >= 2 or any(
        c.age_at_diagnosis and c.age_at_diagnosis < 50 for c in brca_relatives
    ):
        risk_factors.append("BRCA1/BRCA2 hereditary breast/ovarian cancer syndrome")
        recommendations.append("Refer for genetic counseling and BRCA testing")

    # Check for Lynch syndrome
    lynch_cancers = {"colorectal cancer", "endometrial cancer", "ovarian cancer", "gastric cancer"}
    lynch_relatives = [c for c in conditions if c.condition_name.lower() in lynch_cancers]
    if len(lynch_relatives) >= 2:
        risk_factors.append("Possible Lynch syndrome (HNPCC)")
        recommendations.append("Refer for genetic counseling and Lynch panel testing")

    # Check for familial adenomatous polyposis
    if any(
        c.condition_name.lower() == "colorectal cancer"
        and c.age_at_diagnosis
        and c.age_at_diagnosis < 50
        for c in conditions
    ):
        risk_factors.append("Early-onset colorectal cancer in family")
        recommendations.append(
            "Consider early colonoscopy screening (age 40 or 10 years before earliest case)"
        )

    return {
        "patient_id": patient_id,
        "total_conditions": len(conditions),
        "hereditary_risk_factors": risk_factors,
        "risk_level": "high" if risk_factors else "average",
        "recommendations": recommendations,
        "referrals": [{"type": "genetic_counseling", "reason": r} for r in risk_factors],
    }
