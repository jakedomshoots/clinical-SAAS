from pydantic import BaseModel, Field


class MessageSend(BaseModel):
    recipient_id: str
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1)
    thread_id: str | None = None


class MessageOut(BaseModel):
    id: str
    sender_id: str
    sender_name: str | None = None
    recipient_id: str
    recipient_name: str | None = None
    subject: str
    body: str
    thread_id: str | None
    is_read: bool
    created_at: str

    model_config = {"from_attributes": True}


class ThreadOut(BaseModel):
    id: str
    subject: str
    participants: list[dict]
    last_message: MessageOut
    unread_count: int


class ThreadListOut(BaseModel):
    data: list[ThreadOut]
    total: int
