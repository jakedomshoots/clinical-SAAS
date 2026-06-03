from sqlalchemy import select, func, or_, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.message import Message
from app.models.user import User
from app.services.audit_service import log_event


async def list_threads(db: AsyncSession, user_id: str) -> tuple[list[dict], int]:
    thread_sub = (
        select(
            Message.thread_id,
            func.max(Message.created_at).label("latest"),
            func.sum(case((Message.recipient_id == user_id and not Message.is_read, 1), else_=0)).label("unread"),
        )
        .where(or_(Message.sender_id == user_id, Message.recipient_id == user_id), Message.thread_id.isnot(None))
        .group_by(Message.thread_id)
        .subquery()
    )
    query = select(Message, thread_sub.c.unread).join(
        thread_sub, Message.thread_id == thread_sub.c.thread_id
    ).where(Message.created_at == thread_sub.c.latest).order_by(Message.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    user_ids = set()
    for msg, _ in rows:
        user_ids.add(msg.sender_id)
        user_ids.add(msg.recipient_id)
    user_map: dict[str, str] = {}
    if user_ids:
        u = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))
        user_map = {r.id: r.display_name for r in u}

    threads = []
    for msg, unread_count in rows:
        threads.append({
            "id": msg.thread_id,
            "subject": msg.subject,
            "participants": [
                {"id": msg.sender_id, "name": user_map.get(msg.sender_id, "Unknown")},
                {"id": msg.recipient_id, "name": user_map.get(msg.recipient_id, "Unknown")},
            ],
            "last_message": _make_msg_dict(msg, user_map),
            "unread_count": unread_count or 0,
        })
    return threads, len(threads)


async def list_messages(db: AsyncSession, thread_id: str) -> list[dict]:
    result = await db.execute(select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc()))
    messages = result.scalars().all()
    user_ids = {m.sender_id for m in messages} | {m.recipient_id for m in messages}
    user_map: dict[str, str] = {}
    if user_ids:
        u = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))
        user_map = {r.id: r.display_name for r in u}
    return [_make_msg_dict(m, user_map) for m in messages]


async def send_message(db: AsyncSession, user: User, data: dict) -> dict:
    thread_id = data.get("thread_id") or None
    msg = Message(sender_id=user.id, recipient_id=data["recipient_id"], subject=data["subject"], body=data["body"], thread_id=thread_id)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    if thread_id is None:
        msg.thread_id = msg.id
        await db.commit()
        await db.refresh(msg)
    await log_event(db, "message.sent", "message", msg.id, actor_id=user.id, payload={"subject": msg.subject})
    return await get_message(db, msg.id)


async def get_message(db: AsyncSession, msg_id: str) -> dict | None:
    result = await db.execute(select(Message).where(Message.id == msg_id))
    m = result.scalar_one_or_none()
    if not m:
        return None
    user_ids = {m.sender_id, m.recipient_id}
    user_map = {}
    if user_ids:
        u = await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids)))
        user_map = {r.id: r.display_name for r in u}
    return _make_msg_dict(m, user_map)


async def mark_read(db: AsyncSession, user: User, msg_id: str) -> dict | None:
    result = await db.execute(select(Message).where(Message.id == msg_id, Message.recipient_id == user.id))
    msg = result.scalar_one_or_none()
    if not msg:
        return None
    msg.is_read = True
    await db.commit()
    await db.refresh(msg)
    await log_event(db, "message.read", "message", msg.id, actor_id=user.id, payload={})
    return await get_message(db, msg.id)


def _make_msg_dict(m: Message, user_map: dict[str, str]) -> dict:
    return {
        "id": m.id, "sender_id": m.sender_id, "sender_name": user_map.get(m.sender_id),
        "recipient_id": m.recipient_id, "recipient_name": user_map.get(m.recipient_id),
        "subject": m.subject, "body": m.body, "thread_id": m.thread_id,
        "is_read": m.is_read, "created_at": m.created_at.isoformat() if m.created_at else None,
    }
