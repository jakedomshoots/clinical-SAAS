import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from app.config import settings
from app.database import async_session_factory
from app.redis_client import redis

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id] = [ws for ws in self.connections[user_id] if ws != websocket]
            if not self.connections[user_id]:
                del self.connections[user_id]

    async def broadcast(self, channel: str, message: str):
        for user_connections in self.connections.values():
            for ws in user_connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    pass


manager = ConnectionManager()


@router.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await manager.connect(websocket, user_id)

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
