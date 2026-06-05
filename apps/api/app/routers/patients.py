from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientListOut, PatientOut, PatientUpdate
from app.schemas.patient_chart import PatientChartSummaryOut
from app.schemas.patient_clinical import (
    PatientCarePlanItemCreate,
    PatientCarePlanItemListOut,
    PatientCarePlanItemOut,
    PatientCarePlanItemUpdate,
    PatientEncounterCreate,
    PatientEncounterListOut,
    PatientEncounterOut,
    PatientEncounterUpdate,
    PatientLabResultCreate,
    PatientLabResultListOut,
    PatientLabResultOut,
    PatientLabResultUpdate,
    PatientMedicationCreate,
    PatientMedicationListOut,
    PatientMedicationOut,
    PatientMedicationUpdate,
)
from app.schemas.patient_document import (
    PatientDocumentCreate,
    PatientDocumentListOut,
    PatientDocumentOut,
    PatientDocumentUpdate,
)
from app.services import patient_chart_service, patient_clinical_service, patient_document_service, patient_service

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


@router.get("/{patient_id}/chart-summary", response_model=PatientChartSummaryOut)
async def get_patient_chart_summary(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = await patient_chart_service.get_patient_chart_summary(db, current_user, patient_id)
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return summary


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


@router.get("/{patient_id}/medications", response_model=PatientMedicationListOut)
async def list_patient_medications(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await patient_clinical_service.list_medications(db, current_user, patient_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    data, total = result
    return PatientMedicationListOut(data=[PatientMedicationOut(**item) for item in data], total=total)


@router.post("/{patient_id}/medications", response_model=PatientMedicationOut, status_code=status.HTTP_201_CREATED)
async def create_patient_medication(
    patient_id: str,
    data: PatientMedicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    med = await patient_clinical_service.create_medication(db, current_user, patient_id, data.model_dump())
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientMedicationOut(**med)


@router.patch("/{patient_id}/medications/{medication_id}", response_model=PatientMedicationOut)
async def update_patient_medication(
    patient_id: str,
    medication_id: str,
    data: PatientMedicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    med = await patient_clinical_service.update_medication(db, current_user, patient_id, medication_id, update_data)
    if not med:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")
    return PatientMedicationOut(**med)


@router.get("/{patient_id}/care-plan", response_model=PatientCarePlanItemListOut)
async def list_patient_care_plan(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await patient_clinical_service.list_care_plan(db, current_user, patient_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    data, total = result
    return PatientCarePlanItemListOut(data=[PatientCarePlanItemOut(**item) for item in data], total=total)


@router.post("/{patient_id}/care-plan", response_model=PatientCarePlanItemOut, status_code=status.HTTP_201_CREATED)
async def create_patient_care_plan_item(
    patient_id: str,
    data: PatientCarePlanItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    item = await patient_clinical_service.create_care_plan_item(db, current_user, patient_id, data.model_dump())
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientCarePlanItemOut(**item)


@router.patch("/{patient_id}/care-plan/{item_id}", response_model=PatientCarePlanItemOut)
async def update_patient_care_plan_item(
    patient_id: str,
    item_id: str,
    data: PatientCarePlanItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    item = await patient_clinical_service.update_care_plan_item(db, current_user, patient_id, item_id, update_data)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Care plan item not found")
    return PatientCarePlanItemOut(**item)


@router.get("/{patient_id}/labs", response_model=PatientLabResultListOut)
async def list_patient_labs(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await patient_clinical_service.list_labs(db, current_user, patient_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    data, total = result
    return PatientLabResultListOut(data=[PatientLabResultOut(**item) for item in data], total=total)


@router.post("/{patient_id}/labs", response_model=PatientLabResultOut, status_code=status.HTTP_201_CREATED)
async def create_patient_lab(
    patient_id: str,
    data: PatientLabResultCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    lab = await patient_clinical_service.create_lab(db, current_user, patient_id, data.model_dump())
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return PatientLabResultOut(**lab)


@router.patch("/{patient_id}/labs/{lab_id}", response_model=PatientLabResultOut)
async def update_patient_lab(
    patient_id: str,
    lab_id: str,
    data: PatientLabResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    lab = await patient_clinical_service.update_lab(db, current_user, patient_id, lab_id, update_data)
    if not lab:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab result not found")
    return PatientLabResultOut(**lab)


@router.get("/{patient_id}/encounters", response_model=PatientEncounterListOut)
async def list_patient_encounters(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await patient_clinical_service.list_encounters(db, current_user, patient_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    data, total = result
    return PatientEncounterListOut(data=[PatientEncounterOut(**item) for item in data], total=total)


@router.post("/{patient_id}/encounters", response_model=PatientEncounterOut, status_code=status.HTTP_201_CREATED)
async def create_patient_encounter(
    patient_id: str,
    data: PatientEncounterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    encounter = await patient_clinical_service.create_encounter(db, current_user, patient_id, data.model_dump())
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient, appointment, or provider not found")
    return PatientEncounterOut(**encounter)


@router.patch("/{patient_id}/encounters/{encounter_id}", response_model=PatientEncounterOut)
async def update_patient_encounter(
    patient_id: str,
    encounter_id: str,
    data: PatientEncounterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(clinical_write_required),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    encounter = await patient_clinical_service.update_encounter(db, current_user, patient_id, encounter_id, update_data)
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")
    return PatientEncounterOut(**encounter)
