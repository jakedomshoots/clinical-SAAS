"""Telehealth / video visit integration via Daily.co API.

Provides HIPAA-compliant video visits without downloads or plugins.
Alternative to DrChrono's built-in telehealth.

API Docs: https://docs.daily.co/
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.config import settings
from app.integrations.base import BaseIntegrationClient


class DailyClient(BaseIntegrationClient):
    """Daily.co video API client for telehealth visits."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key or settings.daily_api_key
        self._base_url = "https://api.daily.co/v1"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {self._api_key}"},
            timeout=30.0,
        )

    # ------------------------------------------------------------------
    # Rooms
    # ------------------------------------------------------------------

    async def create_room(
        self,
        name: str | None = None,
        expires_at: datetime | None = None,
        max_participants: int = 2,
        enable_screenshare: bool = True,
        enable_chat: bool = True,
        enable_recording: str = "cloud",  # "cloud", "local", "none"
        patient_email: str | None = None,
    ) -> dict[str, Any]:
        """Create a video room for a telehealth visit."""
        payload: dict[str, Any] = {
            "privacy": "public",  # anyone with the URL can join
            "properties": {
                "max_participants": max_participants,
                "enable_screenshare": enable_screenshare,
                "enable_chat": enable_chat,
                "start_video_off": False,
                "start_audio_off": False,
                "enable_knocking": True,  # patient must be admitted
            },
        }
        if name:
            payload["name"] = name
        if expires_at:
            payload["properties"]["exp"] = int(expires_at.timestamp())
        if enable_recording != "none":
            payload["properties"]["enable_recording"] = enable_recording

        async with self._client() as client:
            resp = await client.post("/rooms", json=payload)
            resp.raise_for_status()
            return resp.json()

    async def get_room(self, room_name: str) -> dict[str, Any]:
        """Get room details."""
        async with self._client() as client:
            resp = await client.get(f"/rooms/{room_name}")
            resp.raise_for_status()
            return resp.json()

    async def delete_room(self, room_name: str) -> None:
        """Delete a room."""
        async with self._client() as client:
            resp = await client.delete(f"/rooms/{room_name}")
            resp.raise_for_status()

    # ------------------------------------------------------------------
    # Meeting tokens
    # ------------------------------------------------------------------

    async def create_meeting_token(
        self,
        room_name: str,
        user_id: str,
        user_name: str,
        is_owner: bool = False,
        expires_in_minutes: int = 60,
    ) -> dict[str, Any]:
        """Create a signed meeting token for secure room access."""
        payload = {
            "properties": {
                "room_name": room_name,
                "user_name": user_name,
                "user_id": user_id,
                "is_owner": is_owner,
                "exp": int((datetime.now(UTC).timestamp()) + (expires_in_minutes * 60)),
            },
        }
        async with self._client() as client:
            resp = await client.post("/meeting-tokens", json=payload)
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Recordings
    # ------------------------------------------------------------------

    async def list_recordings(self, room_name: str | None = None) -> list[dict[str, Any]]:
        """List recordings, optionally filtered by room."""
        params = {}
        if room_name:
            params["room_name"] = room_name
        async with self._client() as client:
            resp = await client.get("/recordings", params=params)
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def get_recording_access_link(self, recording_id: str) -> dict[str, Any]:
        """Get a temporary access link for a recording."""
        async with self._client() as client:
            resp = await client.get(f"/recordings/{recording_id}/access-link")
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Telehealth visit workflow
    # ------------------------------------------------------------------

    async def schedule_visit(
        self,
        appointment_id: str,
        provider_name: str,
        patient_name: str,
        scheduled_at: datetime,
    ) -> dict[str, Any]:
        """Full workflow: create room + tokens for a telehealth visit."""
        room_name = f"visit-{appointment_id}"
        room = await self.create_room(
            name=room_name,
            expires_at=scheduled_at.replace(hour=23, minute=59),  # expires end of day
        )

        # Provider token (owner)
        provider_token = await self.create_meeting_token(
            room_name=room_name,
            user_id=f"provider-{appointment_id}",
            user_name=provider_name,
            is_owner=True,
        )

        # Patient token
        patient_token = await self.create_meeting_token(
            room_name=room_name,
            user_id=f"patient-{appointment_id}",
            user_name=patient_name,
            is_owner=False,
        )

        return {
            "room_url": room.get("url"),
            "room_name": room_name,
            "provider_join_url": f"{room.get('url')}?t={provider_token.get('token')}",
            "patient_join_url": f"{room.get('url')}?t={patient_token.get('token')}",
            "expires_at": scheduled_at.replace(hour=23, minute=59).isoformat(),
        }
