from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import security_scheme
from app.models.patient import Patient
from app.schemas.auth import PatientPortalLogin, PatientPortalPatientOut, PatientPortalTokenResponse
from app.services.audit_service import log_event
from app.services.auth_service import create_patient_portal_token

router = APIRouter(prefix="/api/portal/auth", tags=["portal-auth"])


@router.post("/login", response_model=PatientPortalTokenResponse)
async def portal_login(data: PatientPortalLogin, db: AsyncSession = Depends(get_db)):
    try:
        dob = date.fromisoformat(data.dob)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date of birth") from exc
    patient = (
        await db.execute(
            select(Patient).where(
                Patient.email == data.email,
                Patient.dob == dob,
                Patient.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid portal credentials")
    token = create_patient_portal_token(patient.id, patient.organization_id)
    await log_event(db, "portal_auth.login", "patient", patient.id, payload={"patient_id": patient.id})
    return PatientPortalTokenResponse(access_token=token, patient=PatientPortalPatientOut.model_validate(patient))


@router.get("/me", response_model=PatientPortalPatientOut)
async def portal_me(credentials=Depends(security_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid portal token") from None
    if payload.get("role") != "patient" or payload.get("portal") is not True:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid portal token")
    patient = (
        await db.execute(
            select(Patient).where(
                Patient.id == payload.get("sub"),
                Patient.organization_id == payload.get("organization_id"),
                Patient.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Patient not found or inactive")
    return PatientPortalPatientOut.model_validate(patient)
