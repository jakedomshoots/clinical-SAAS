from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import clinical_write_required, get_current_user
from app.models.user import User
from app.schemas.task import TaskCreate, TaskListOut, TaskOut, TaskUpdate
from app.services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=TaskListOut)
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    assigned_to_id: str | None = Query(None),
    patient_id: str | None = Query(None),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data, total = await task_service.list_tasks(
        db, page=page, page_size=page_size, status=status, priority=priority,
        assigned_to_id=assigned_to_id, patient_id=patient_id, search=search,
    )
    return TaskListOut(data=[TaskOut(**t) for t in data], total=total, page=page, page_size=page_size)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = await task_service.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut(**task)


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(clinical_write_required)):
    task = await task_service.create_task(db, current_user, data.model_dump())
    return TaskOut(**task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, data: TaskUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(clinical_write_required)):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    task = await task_service.update_task(db, current_user, task_id, update_data)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut(**task)
