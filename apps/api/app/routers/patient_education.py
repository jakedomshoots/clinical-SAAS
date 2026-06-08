"""Patient education router for ONC criteria (a)(5) and (a)(13)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.patient_education import PatientEducationService

router = APIRouter(prefix="/education", tags=["Patient Education"])


@router.get("/resources")
async def list_education_resources(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all available patient education resources."""
    return PatientEducationService.list_all_resources()


@router.post("/bundle")
async def get_patient_education_bundle(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate a personalized education bundle for a patient."""
    return PatientEducationService.get_patient_education_bundle(data.get("patient", {}))


@router.get("/diagnosis/{icd10_code}")
async def get_education_for_diagnosis(
    icd10_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get education resources for a specific diagnosis code."""
    return PatientEducationService.get_education_for_diagnosis(icd10_code)


@router.get("/procedure/{cpt_code}")
async def get_education_for_procedure(
    cpt_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get education resources for a specific procedure code."""
    return PatientEducationService.get_education_for_procedure(cpt_code)
