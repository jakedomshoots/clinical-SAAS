from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.billing import (
    BillingCaseCreate,
    BillingCaseListOut,
    BillingCaseOut,
    BillingCaseUpdate,
    BillingClaimReadinessOut,
    BillingPaymentIn,
    BillingReworkIn,
    BillingTimelineEventOut,
    BillingTimelineOut,
    BillingWorkQueueOut,
    ChargeReviewItemOut,
    ChargeReviewListOut,
    EligibilityCheckOut,
)
from app.services import billing_service

router = APIRouter(prefix="/api/billing", tags=["billing"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ClinicalUserDep = Annotated[User, Depends(clinical_write_required)]


@router.get("/cases", response_model=BillingCaseListOut)
async def list_billing_cases(db: DbDep, current_user: CurrentUserDep):
    data, total = await billing_service.list_cases(db, current_user)
    return BillingCaseListOut(
        data=[BillingCaseOut.model_validate(item) for item in data], total=total
    )


@router.get("/charge-review", response_model=ChargeReviewListOut)
async def list_charge_review(db: DbDep, current_user: CurrentUserDep):
    data, total = await billing_service.list_charge_review(db, current_user)
    return ChargeReviewListOut(data=[ChargeReviewItemOut(**item) for item in data], total=total)


@router.get("/work-queue", response_model=BillingWorkQueueOut)
async def billing_work_queue(db: DbDep, current_user: CurrentUserDep):
    return BillingWorkQueueOut(**await billing_service.work_queue(db, current_user))


@router.post("/cases", response_model=BillingCaseOut, status_code=status.HTTP_201_CREATED)
async def create_billing_case(data: BillingCaseCreate, db: DbDep, current_user: ClinicalUserDep):
    case = await billing_service.create_case(db, current_user, data.model_dump())
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")
    return BillingCaseOut.model_validate(case)


@router.post(
    "/cases/from-encounter/{encounter_id}",
    response_model=BillingCaseOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_billing_case_from_encounter(
    encounter_id: str, db: DbDep, current_user: ClinicalUserDep
):
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


@router.get("/eligibility/{patient_id}/history", response_model=BillingTimelineOut)
async def eligibility_history(patient_id: str, db: DbDep, current_user: CurrentUserDep):
    data, total = await billing_service.eligibility_history(db, current_user, patient_id)
    return BillingTimelineOut(
        data=[BillingTimelineEventOut.model_validate(item) for item in data], total=total
    )


@router.patch("/cases/{case_id}", response_model=BillingCaseOut)
async def update_billing_case(
    case_id: str, data: BillingCaseUpdate, db: DbDep, current_user: ClinicalUserDep
):
    case = await billing_service.update_case(
        db, current_user, case_id, data.model_dump(exclude_unset=True)
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)


@router.get("/cases/{case_id}/timeline", response_model=BillingTimelineOut)
async def billing_case_timeline(case_id: str, db: DbDep, current_user: CurrentUserDep):
    result = await billing_service.case_timeline(db, current_user, case_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    data, total = result
    return BillingTimelineOut(
        data=[BillingTimelineEventOut.model_validate(item) for item in data], total=total
    )


@router.get("/cases/{case_id}/readiness", response_model=BillingClaimReadinessOut)
async def billing_case_readiness(case_id: str, db: DbDep, current_user: CurrentUserDep):
    result = await billing_service.claim_readiness(db, current_user, case_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingClaimReadinessOut(**result)


@router.post("/cases/{case_id}/submit", response_model=BillingCaseOut)
async def submit_billing_case(case_id: str, db: DbDep, current_user: ClinicalUserDep):
    try:
        case = await billing_service.submit_case(db, current_user, case_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)


@router.post("/cases/{case_id}/payment", response_model=BillingCaseOut)
async def record_billing_payment(
    case_id: str, db: DbDep, current_user: ClinicalUserDep, data: BillingPaymentIn | None = None
):
    case = await billing_service.record_payment(
        db,
        current_user,
        case_id,
        data.model_dump(exclude_unset=True) if data else {},
    )
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)


@router.post("/cases/{case_id}/deny", response_model=BillingCaseOut)
async def deny_billing_case(
    case_id: str, data: BillingCaseUpdate, db: DbDep, current_user: ClinicalUserDep
):
    case = await billing_service.deny_case(db, current_user, case_id, data.notes)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)


@router.post("/cases/{case_id}/rework", response_model=BillingCaseOut)
async def rework_billing_denial(
    case_id: str, data: BillingReworkIn, db: DbDep, current_user: ClinicalUserDep
):
    case = await billing_service.rework_denial(db, current_user, case_id, data.notes)
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing case not found")
    return BillingCaseOut.model_validate(case)
