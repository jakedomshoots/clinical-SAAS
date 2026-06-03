from datetime import datetime
from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: str = "normal"
    due_date: datetime | None = None
    assigned_to_id: str | None = None
    patient_id: str | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    assigned_to_id: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str | None
    priority: str
    status: str
    due_date: str | None
    assigned_to_id: str | None
    assigned_to_name: str | None = None
    patient_id: str | None
    patient_name: str | None = None
    creator_id: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class TaskListOut(BaseModel):
    data: list[TaskOut]
    total: int
    page: int
    page_size: int
