from datetime import date
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.deps import security_scheme
from app.models.patient import Patient
from app.schemas.auth import PatientPortalLogin, PatientPortalPatientOut, PatientPortalTokenResponse
from app.schemas.patient_document import PatientDocumentOut, PatientDocumentUploadConfirm, PatientDocumentUploadPrepare, PatientDocumentUploadPrepareOut
from app.schemas.portal_intake import PortalIntakeCreate, PortalIntakeOut
from app.services.audit_service import log_event
from app.services.auth_service import create_patient_portal_token
from app.services import patient_document_service, portal_intake_service

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


async def get_portal_patient(credentials=Depends(security_scheme), db: AsyncSession = Depends(get_db)) -> Patient:
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
    return patient


@router.get("/me", response_model=PatientPortalPatientOut)
async def portal_me(patient: Patient = Depends(get_portal_patient)):
    return PatientPortalPatientOut.model_validate(patient)


@router.post("/intake", response_model=PortalIntakeOut, status_code=status.HTTP_201_CREATED)
async def portal_create_intake(
    data: PortalIntakeCreate,
    patient: Patient = Depends(get_portal_patient),
    db: AsyncSession = Depends(get_db),
):
    payload = data.model_dump()
    payload["patient_id"] = patient.id
    payload["source"] = "patient_portal"
    submission = await portal_intake_service.create_submission(db, SimpleNamespace(id=None, organization_id=patient.organization_id), payload)
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PortalIntakeOut.model_validate(submission)


@router.post("/documents/upload", response_model=PatientDocumentUploadPrepareOut)
async def portal_prepare_document_upload(
    data: PatientDocumentUploadPrepare,
    patient: Patient = Depends(get_portal_patient),
    db: AsyncSession = Depends(get_db),
):
    upload = await patient_document_service.prepare_document_upload(db, SimpleNamespace(id=None, organization_id=patient.organization_id), patient.id, data.model_dump())
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientDocumentUploadPrepareOut(**upload)


@router.post("/documents/upload/confirm", response_model=PatientDocumentOut, status_code=status.HTTP_201_CREATED)
async def portal_confirm_document_upload(
    data: PatientDocumentUploadConfirm,
    patient: Patient = Depends(get_portal_patient),
    db: AsyncSession = Depends(get_db),
):
    document = await patient_document_service.confirm_document_upload(db, SimpleNamespace(id=None, organization_id=patient.organization_id), patient.id, data.model_dump())
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientDocumentOut(**document)
