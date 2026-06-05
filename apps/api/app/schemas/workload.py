from pydantic import BaseModel


class WorkloadBucketOut(BaseModel):
    owner_role: str
    assigned_to_id: str | None
    assigned_to_name: str | None
    open_items: int
    blocked_items: int
    escalated_items: int


class WorkloadSummaryOut(BaseModel):
    data: list[WorkloadBucketOut]
    total_open_items: int
    unassigned_items: int
