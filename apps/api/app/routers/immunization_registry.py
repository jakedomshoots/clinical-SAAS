"""Immunization registry submission router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.integrations.immunization_registry import ImmunizationRegistryClient, get_registry_for_state
from app.models.patient import Patient
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/immunizations", tags=["Immunization Registry"])


@router.get("/registry-urls")
async def list_registry_urls() -> dict[str, str]:
    """List state immunization registry URLs."""
    from app.integrations.immunization_registry import STATE_REGISTRY_URLS
    return STATE_REGISTRY_URLS


@router.post("/registry/submit")
async def submit_to_registry(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Submit a vaccination record to the state registry."""
    patient = db.query(Patient).filter(Patient.id == data["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    client = ImmunizationRegistryClient()
    result = await client.submit_vaccination(
        patient_id=str(patient.id),
        patient_first_name=patient.first_name,
        patient_last_name=patient.last_name,
        patient_dob=patient.dob.isoformat() if patient.dob else "",
        patient_gender=patient.gender,
        patient_address=patient.address,
        patient_phone=patient.phone,
        vaccine_cvx=data["vaccine_cvx"],
        vaccine_name=data["vaccine_name"],
        vaccine_lot=data.get("vaccine_lot"),
        vaccine_mvx=data.get("vaccine_mvx"),
        administered_date=data["administered_date"],
        administered_by_npi=data.get("administered_by_npi", getattr(current_user, "npi", "")),
        administered_by_name=getattr(current_user, "full_name", "Provider"),
        site=data.get("site"),
        route=data.get("route"),
        dose_number=data.get("dose_number"),
        vis_given=data.get("vis_given", True),
        vis_date=data.get("vis_date"),
    )
    return result


@router.post("/registry/query")
async def query_registry(
    data: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Query state registry for patient immunization history."""
    patient = db.query(Patient).filter(Patient.id == data["patient_id"]).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    client = ImmunizationRegistryClient()
    return await client.query_patient_history(
        patient_id=str(patient.id),
        patient_first_name=patient.first_name,
        patient_last_name=patient.last_name,
        patient_dob=patient.dob.isoformat() if patient.dob else "",
    )
