from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskListOut,
    TaskNotificationReadOut,
    TaskOut,
    TaskOutreachSummaryOut,
    TaskPatientOutreachDeliveryOut,
    TaskPatientOutreachDraftOut,
    TaskPatientOutreachSend,
    TaskUpdate,
    TaskWorkQueueOut,
)
from app.services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
ClinicalUserDep = Annotated[User, Depends(clinical_write_required)]


@router.get("", response_model=TaskListOut)
async def list_tasks(
    db: DbDep,
    current_user: CurrentUserDep,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    assigned_to_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    search: str | None = Query(None),
):
    data, total = await task_service.list_tasks(
        db,
        current_user,
        page=page,
        page_size=page_size,
        status=status,
        priority=priority,
        assigned_to_id=assigned_to_id,
        patient_id=patient_id,
        search=search,
    )
    return TaskListOut(
        data=[TaskOut(**t) for t in data],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/patient-outreach/summary", response_model=TaskOutreachSummaryOut)
async def patient_outreach_summary(
    db: DbDep,
    current_user: CurrentUserDep,
):
    return TaskOutreachSummaryOut(**await task_service.outreach_summary(db, current_user))


@router.get("/work-queue", response_model=TaskWorkQueueOut)
async def task_work_queue(
    db: DbDep,
    current_user: CurrentUserDep,
):
    return TaskWorkQueueOut(**await task_service.work_queue_summary(db, current_user))


@router.post("/notifications/read", response_model=TaskNotificationReadOut)
async def mark_task_notifications_read(
    db: DbDep,
    current_user: CurrentUserDep,
):
    return TaskNotificationReadOut(
        **await task_service.acknowledge_task_notifications(db, current_user)
    )


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: str,
    db: DbDep,
    current_user: CurrentUserDep,
):
    task = await task_service.get_task(db, current_user, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return TaskOut(**task)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: DbDep,
    current_user: ClinicalUserDep,
):
    task = await task_service.create_task(db, current_user, data.model_dump())
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assignee or patient not found"
        )
    return TaskOut(**task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    db: DbDep,
    current_user: ClinicalUserDep,
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )
    task = await task_service.update_task(db, current_user, task_id, update_data)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut(**task)


@router.post("/{task_id}/patient-outreach", response_model=TaskPatientOutreachDraftOut)
async def draft_patient_outreach(
    task_id: str,
    db: DbDep,
    current_user: ClinicalUserDep,
):
    draft = await task_service.draft_patient_outreach(db, current_user, task_id)
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient task not found")
    return TaskPatientOutreachDraftOut(**draft)


@router.post("/{task_id}/patient-outreach/deliver", response_model=TaskPatientOutreachDeliveryOut)
async def deliver_patient_outreach(
    task_id: str,
    data: TaskPatientOutreachSend,
    db: DbDep,
    current_user: ClinicalUserDep,
):
    delivery = await task_service.stage_patient_outreach_delivery(
        db,
        current_user,
        task_id,
        data.model_dump(),
    )
    if not delivery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient task not found")
    return TaskPatientOutreachDeliveryOut(**delivery)
