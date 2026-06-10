from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.portal_intake import (
    PortalIntakeCreate,
    PortalIntakeListOut,
    PortalIntakeOut,
    PortalIntakeUpdate,
)
from app.services import portal_intake_service

router = APIRouter(prefix="/api/portal-intake", tags=["portal-intake"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ClinicalUserDep = Annotated[User, Depends(clinical_write_required)]


@router.get("", response_model=PortalIntakeListOut)
async def list_intake(db: DbDep, current_user: CurrentUserDep):
    data, total = await portal_intake_service.list_submissions(db, current_user)
    return PortalIntakeListOut(
        data=[PortalIntakeOut.model_validate(item) for item in data], total=total
    )


@router.post("", response_model=PortalIntakeOut, status_code=status.HTTP_201_CREATED)
async def create_intake(data: PortalIntakeCreate, db: DbDep, current_user: ClinicalUserDep):
    submission = await portal_intake_service.create_submission(db, current_user, data.model_dump())
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PortalIntakeOut.model_validate(submission)


@router.patch("/{submission_id}", response_model=PortalIntakeOut)
async def update_intake(
    submission_id: str, data: PortalIntakeUpdate, db: DbDep, current_user: ClinicalUserDep
):
    submission = await portal_intake_service.update_submission(
        db, current_user, submission_id, data.model_dump(exclude_unset=True)
    )
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Portal intake submission not found"
        )
    return PortalIntakeOut.model_validate(submission)


@router.post("/{submission_id}/apply-to-patient", response_model=PortalIntakeOut)
async def apply_to_patient(submission_id: str, db: DbDep, current_user: ClinicalUserDep):
    submission = await portal_intake_service.apply_to_patient(db, current_user, submission_id)
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Portal intake submission not found"
        )
    return PortalIntakeOut.model_validate(submission)


@router.post("/{submission_id}/convert-appointment")
async def convert_to_appointment(submission_id: str, db: DbDep, current_user: ClinicalUserDep):
    try:
        appointment = await portal_intake_service.convert_to_appointment(
            db, current_user, submission_id
        )
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing appointment field: {exc.args[0]}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Portal intake submission not found"
        )
    return appointment


@router.post("/{submission_id}/convert-document")
async def convert_to_document(submission_id: str, db: DbDep, current_user: ClinicalUserDep):
    try:
        document = await portal_intake_service.convert_to_document(db, current_user, submission_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Portal intake submission not found"
        )
    return document
