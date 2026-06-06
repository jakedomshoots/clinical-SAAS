import asyncio
import json
from dataclasses import dataclass

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
from sqlalchemy import select

from app.config import settings
from app.database import async_session_factory
from app.models.user import User
from app.redis_client import redis

router = APIRouter()


@dataclass
class ManagedConnection:
    websocket: WebSocket
    user_id: str
    organization_id: str


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[ManagedConnection]] = {}

    async def connect(self, websocket: WebSocket, user: User):
        await websocket.accept()
        self.connections.setdefault(user.id, []).append(
            ManagedConnection(
                websocket=websocket,
                user_id=user.id,
                organization_id=user.organization_id,
            )
        )

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id] = [
                connection
                for connection in self.connections[user_id]
                if connection.websocket != websocket
            ]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def broadcast(self, channel: str | bytes, message: str | bytes):
        organization_id = _message_organization_id(message)
        if organization_id is None and _channel_name(channel) != "events:system":
            return
        for user_connections in self.connections.values():
            for connection in user_connections:
                if organization_id and connection.organization_id != organization_id:
                    continue
                try:
                    await connection.websocket.send_text(
                        message if isinstance(message, str) else message.decode("utf-8", errors="ignore")
                    )
                except Exception:
                    pass


manager = ConnectionManager()


def _message_organization_id(message: str | bytes) -> str | None:
    if isinstance(message, bytes):
        message = message.decode("utf-8", errors="ignore")
    try:
        payload = json.loads(message)
    except json.JSONDecodeError:
        return None
    organization_id = payload.get("organization_id")
    return organization_id if isinstance(organization_id, str) else None


def _channel_name(channel: str | bytes) -> str:
    if isinstance(channel, bytes):
        return channel.decode("utf-8", errors="ignore")
    return channel


def _bearer_token_from_websocket(websocket: WebSocket) -> str | None:
    authorization = websocket.headers.get("authorization")
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


@router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = _bearer_token_from_websocket(websocket)
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        session_version = int(payload.get("session_version", 0))
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with async_session_factory() as db:
        user = (
            await db.execute(
                select(User).where(
                    User.id == user_id,
                    User.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return
    if user.session_version != session_version:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, user)

    # Subscribe to Redis channel for real-time events
    async def redis_listener():
        pubsub = redis.pubsub()
        await pubsub.subscribe(
            "events:audit",
            "events:task",
            "events:fax",
            "events:message",
            "events:schedule",
            "events:system",
        )
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await manager.broadcast(message["channel"], message["data"])
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe()
            await pubsub.close()

    listener_task = asyncio.create_task(redis_listener())

    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages (e.g., pings, acknowledgements)
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        manager.disconnect(websocket, user_id)
