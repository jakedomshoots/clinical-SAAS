from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.billing import BillingCaseCreate, BillingCaseListOut, BillingCaseOut, BillingCaseUpdate, EligibilityCheckOut
from app.services import billing_service

router = APIRouter(prefix="/api/billing", tags=["billing"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ClinicalUserDep = Annotated[User, Depends(clinical_write_required)]


@router.get("/cases", response_model=BillingCaseListOut)
async def list_billing_cases(db: DbDep, current_user: CurrentUserDep):
    data, total = await billing_service.list_cases(db, current_user)
    return BillingCaseListOut(data=[BillingCaseOut.model_validate(item) for item in data], total=total)


@router.post("/cases", response_model=BillingCaseOut, status_code=status.HTTP_201_CREATED)
async def create_billing_case(data: BillingCaseCreate, db: DbDep, current_user: ClinicalUserDep):
    case = await billing_service.create_case(db, current_user, data.model_dump())
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return BillingCaseOut.model_validate(case)


@router.post("/cases/from-encounter/{encounter_id}", response_model=BillingCaseOut, status_code=status.HTTP_201_CREATED)
async def create_billing_case_from_encounter(encounter_id: str, db: DbDep, current_user: ClinicalUserDep):
    case = await billing_service.create_case_from_encounter(db, current_user, encounter_id)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")
    return BillingCaseOut.model_validate(case)


@router.post("/eligibility/{patient_id}", response_model=EligibilityCheckOut)
async def check_eligibility(patient_id: str, db: DbDep, current_user: ClinicalUserDep):
    result = await billing_service.check_eligibility(db, current_user, patient_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return EligibilityCheckOut(**result)


@router.patch("/cases/{case_id}", response_model=BillingCaseOut)
async def update_billing_case(case_id: str, data: BillingCaseUpdate, db: DbDep, current_user: ClinicalUserDep):
    case = await billing_service.update_case(db, current_user, case_id, data.model_dump(exclude_unset=True))
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)
