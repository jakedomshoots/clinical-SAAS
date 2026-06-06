import json
from types import SimpleNamespace

import pytest

from app.routers.websocket import ConnectionManager, _bearer_token_from_websocket


class FakeWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent: list[str] = []

    async def accept(self):
        self.accepted = True

    async def send_text(self, message: str):
        self.sent.append(message)


def test_websocket_bearer_token_is_read_from_header_not_query():
    header_socket = SimpleNamespace(headers={"authorization": "Bearer header-token"}, query_params={"token": "query-token"})
    query_only_socket = SimpleNamespace(headers={}, query_params={"token": "query-token"})

    assert _bearer_token_from_websocket(header_socket) == "header-token"
    assert _bearer_token_from_websocket(query_only_socket) is None


@pytest.mark.asyncio
async def test_websocket_broadcast_filters_events_by_organization():
    manager = ConnectionManager()
    default_socket = FakeWebSocket()
    other_socket = FakeWebSocket()
    await manager.connect(
        default_socket,
        SimpleNamespace(id="default-user", organization_id="default"),
    )
    await manager.connect(
        other_socket,
        SimpleNamespace(id="other-user", organization_id="other-org"),
    )

    message = json.dumps({"organization_id": "default", "event_type": "patient.updated"})
    await manager.broadcast("events:audit", message)

    assert default_socket.sent == [message]
    assert other_socket.sent == []


@pytest.mark.asyncio
async def test_websocket_broadcast_drops_unscoped_non_system_events():
    manager = ConnectionManager()
    default_socket = FakeWebSocket()
    await manager.connect(
        default_socket,
        SimpleNamespace(id="default-user", organization_id="default"),
    )

    await manager.broadcast("events:audit", json.dumps({"event_type": "patient.updated"}))

    assert default_socket.sent == []


@pytest.mark.asyncio
async def test_websocket_broadcast_allows_global_system_events():
    manager = ConnectionManager()
    default_socket = FakeWebSocket()
    other_socket = FakeWebSocket()
    await manager.connect(
        default_socket,
        SimpleNamespace(id="default-user", organization_id="default"),
    )
    await manager.connect(
        other_socket,
        SimpleNamespace(id="other-user", organization_id="other-org"),
    )

    message = json.dumps({"event_type": "system.maintenance"})
    await manager.broadcast("events:system", message)

    assert default_socket.sent == [message]
    assert other_socket.sent == [message]
