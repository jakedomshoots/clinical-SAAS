"""Google Calendar integration adapter.

Handles appointment scheduling, availability, and calendar sync
via Google Calendar API.

API Docs: https://developers.google.com/calendar/api/v3/reference
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class GoogleCalendarClient(ConfiguredIntegration):
    """Google Calendar API client."""

    name = "google_calendar"
    env_var = "GOOGLE_CALENDAR_API_KEY"
    adapter_detail = "Google Calendar — appointment scheduling and provider availability"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url="https://www.googleapis.com/calendar/v3",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    @with_api_retry(circuit_breaker="google_calendar")
    async def create_appointment(
        self,
        calendar_id: str,
        summary: str,
        start_time: str,
        end_time: str,
        description: str = "",
        location: str = "",
        attendees: list[dict[str, str]] | None = None,
        reminders: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a calendar event (appointment).

        Args:
            calendar_id: Google Calendar ID (usually email)
            summary: Event title
            start_time: ISO 8601 start time
            end_time: ISO 8601 end time
            description: Event description
            location: Physical location
            attendees: List of {"email": "...", "displayName": "..."}
            reminders: Custom reminder settings
        """
        self.require_configured()

        payload: dict[str, Any] = {
            "summary": summary,
            "start": {"dateTime": start_time, "timeZone": "America/New_York"},
            "end": {"dateTime": end_time, "timeZone": "America/New_York"},
        }

        if description:
            payload["description"] = description
        if location:
            payload["location"] = location
        if attendees:
            payload["attendees"] = attendees
        if reminders:
            payload["reminders"] = reminders
        else:
            payload["reminders"] = {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 1440},
                    {"method": "popup", "minutes": 30},
                ],
            }

        async with self._client() as client:
            response = await client.post(
                f"/calendars/{calendar_id}/events",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "event_id": data.get("id"),
            "calendar_id": calendar_id,
            "summary": summary,
            "start": start_time,
            "end": end_time,
            "html_link": data.get("htmlLink"),
            "status": data.get("status"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="google_calendar")
    async def get_appointment(self, calendar_id: str, event_id: str) -> dict[str, Any]:
        """Get a specific appointment."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/calendars/{calendar_id}/events/{event_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "event_id": data.get("id"),
            "calendar_id": calendar_id,
            "summary": data.get("summary"),
            "description": data.get("description", ""),
            "start": data.get("start", {}).get("dateTime"),
            "end": data.get("end", {}).get("dateTime"),
            "location": data.get("location", ""),
            "status": data.get("status"),
            "attendees": [
                {"email": a.get("email"), "response": a.get("responseStatus")}
                for a in data.get("attendees", [])
            ],
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="google_calendar")
    async def update_appointment(
        self,
        calendar_id: str,
        event_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """Update an existing appointment."""
        self.require_configured()

        async with self._client() as client:
            response = await client.patch(
                f"/calendars/{calendar_id}/events/{event_id}",
                json=updates,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "event_id": event_id,
            "calendar_id": calendar_id,
            "updated": True,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="google_calendar")
    async def delete_appointment(self, calendar_id: str, event_id: str) -> dict[str, Any]:
        """Cancel/delete an appointment."""
        self.require_configured()

        async with self._client() as client:
            response = await client.delete(
                f"/calendars/{calendar_id}/events/{event_id}"
            )
            response.raise_for_status()

        return {"event_id": event_id, "calendar_id": calendar_id, "deleted": True}

    @with_api_retry(circuit_breaker="google_calendar")
    async def list_appointments(
        self,
        calendar_id: str,
        start_min: str,
        start_max: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List appointments in a date range.

        Args:
            calendar_id: Calendar ID
            start_min: ISO 8601 start of range
            start_max: ISO 8601 end of range
            limit: Max results
        """
        self.require_configured()

        params = {
            "timeMin": start_min,
            "timeMax": start_max,
            "maxResults": limit,
            "orderBy": "startTime",
            "singleEvents": "true",
        }

        async with self._client() as client:
            response = await client.get(
                f"/calendars/{calendar_id}/events",
                params=params,
            )
            response.raise_for_status()
            data = response.json()

        events = data.get("items", [])
        return [
            {
                "event_id": e.get("id"),
                "summary": e.get("summary"),
                "start": e.get("start", {}).get("dateTime"),
                "end": e.get("end", {}).get("dateTime"),
                "status": e.get("status"),
                "description": e.get("description", ""),
            }
            for e in events
        ]

    @with_api_retry(circuit_breaker="google_calendar")
    async def get_free_busy(
        self,
        calendar_ids: list[str],
        start_time: str,
        end_time: str,
    ) -> dict[str, Any]:
        """Check free/busy time for multiple calendars.

        Args:
            calendar_ids: List of calendar IDs to check
            start_time: ISO 8601 start
            end_time: ISO 8601 end
        """
        self.require_configured()

        payload = {
            "timeMin": start_time,
            "timeMax": end_time,
            "items": [{"id": cid} for cid in calendar_ids],
        }

        async with self._client() as client:
            response = await client.post("/freeBusy", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "calendars": {
                cal_id: {
                    "busy": [
                        {"start": b.get("start"), "end": b.get("end")}
                        for b in info.get("busy", [])
                    ],
                }
                for cal_id, info in data.get("calendars", {}).items()
            },
            "raw_response": data,
        }
