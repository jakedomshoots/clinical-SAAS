from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientListOut, PatientOut, PatientUpdate
from app.schemas.patient_document import (
    PatientDocumentCreate,
    PatientDocumentListOut,
    PatientDocumentOut,
    PatientDocumentUpdate,
)
from app.services import patient_document_service, patient_service

router = APIRouter(prefix="/api/patients", tags=["patients"])


@router.get("", response_model=PatientListOut)
async def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    is_active: bool | None = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data, total = await patient_service.list_patients(
        db,
        current_user,
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
    )
    return PatientListOut(data=[PatientOut(**p) for p in data], total=total, page=page, page_size=page_size)


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = await patient_service.get_patient(db, current_user, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientOut(**patient)


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    patient = await patient_service.create_patient(db, current_user, data.model_dump())
    return PatientOut(**patient)


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: str,
    data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    patient = await patient_service.update_patient(db, current_user, patient_id, update_data)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientOut(**patient)


@router.delete("/{patient_id}", response_model=PatientOut)
async def deactivate_patient(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    patient = await patient_service.deactivate_patient(db, current_user, patient_id)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientOut(**patient)


@router.get("/{patient_id}/documents", response_model=PatientDocumentListOut)
async def list_patient_documents(
    patient_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    document_status: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await patient_document_service.list_patient_documents(
        db,
        current_user,
        patient_id,
        page=page,
        page_size=page_size,
        status=document_status,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    data, total = result
    return PatientDocumentListOut(
        data=[PatientDocumentOut(**document) for document in data],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/{patient_id}/documents",
    response_model=PatientDocumentOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient_document(
    patient_id: str,
    data: PatientDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    document = await patient_document_service.create_patient_document(
        db,
        current_user,
        patient_id,
        data.model_dump(),
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientDocumentOut(**document)


@router.patch("/{patient_id}/documents/{document_id}", response_model=PatientDocumentOut)
async def update_patient_document(
    patient_id: str,
    document_id: str,
    data: PatientDocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    document = await patient_document_service.update_patient_document(
        db,
        current_user,
        patient_id,
        document_id,
        update_data,
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return PatientDocumentOut(**document)
