"""Twilio integration adapter for SMS, voice, and messaging.

Replaces DrChrono's built-in messaging with direct Twilio integration.
Handles patient SMS, appointment reminders, two-way messaging,
and voice calls.

API Docs: https://www.twilio.com/docs/messaging/api
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class TwilioClient(ConfiguredIntegration):
    """Twilio SMS/Voice/Messaging client."""

    name = "twilio"
    env_var = "TWILIO_API_KEY"
    adapter_detail = "Twilio — SMS, voice calls, and two-way patient messaging"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings
        account_sid = getattr(settings, "twilio_account_sid", "")
        auth_token = self.api_key
        return httpx.AsyncClient(
            base_url="https://api.twilio.com/2010-04-01",
            auth=(account_sid, auth_token),
            timeout=30.0,
        )

    def _messaging_client(self) -> httpx.AsyncClient:
        from app.config import settings
        account_sid = getattr(settings, "twilio_account_sid", "")
        auth_token = self.api_key
        return httpx.AsyncClient(
            base_url="https://messaging.twilio.com/v1",
            auth=(account_sid, auth_token),
            timeout=30.0,
        )

    @property
    def _account_sid(self) -> str:
        from app.config import settings
        return getattr(settings, "twilio_account_sid", "")

    @property
    def _from_number(self) -> str:
        from app.config import settings
        return getattr(settings, "twilio_from_number", "")

    @with_api_retry(circuit_breaker="twilio")
    async def send_sms(
        self,
        to: str,
        body: str,
        from_number: str | None = None,
        media_urls: list[str] | None = None,
    ) -> dict[str, Any]:
        """Send an SMS to a patient.

        Args:
            to: Recipient phone number (E.164 format, e.g. +15551234567)
            body: Message body (max 1600 chars)
            from_number: Sender number (defaults to TWILIO_FROM_NUMBER)
            media_urls: Optional list of media URLs to attach
        """
        self.require_configured()

        from_num = from_number or self._from_number
        if not from_num:
            raise ValueError("No from_number provided and TWILIO_FROM_NUMBER not set")

        data: dict[str, Any] = {
            "To": to,
            "From": from_num,
            "Body": body,
        }

        if media_urls:
            for i, url in enumerate(media_urls):
                data[f"MediaUrl{i}"] = url

        async with self._client() as client:
            response = await client.post(
                f"/Accounts/{self._account_sid}/Messages.json",
                data=data,
            )
            response.raise_for_status()
            result = response.json()

        return {
            "message_sid": result.get("sid"),
            "status": result.get("status"),
            "to": to,
            "from": from_num,
            "body": body,
            "segments": result.get("num_segments"),
            "price": result.get("price"),
            "raw_response": result,
        }

    @with_api_retry(circuit_breaker="twilio")
    async def send_bulk_sms(
        self,
        recipients: list[dict[str, str]],
        body: str,
        from_number: str | None = None,
    ) -> list[dict[str, Any]]:
        """Send SMS to multiple recipients.

        Args:
            recipients: List of {"to": "+15551234567", "patient_id": "..."}
            body: Message body
            from_number: Optional override sender
        """
        self.require_configured()
        results = []
        for recipient in recipients:
            result = await self.send_sms(
                to=recipient["to"],
                body=body,
                from_number=from_number,
            )
            result["patient_id"] = recipient.get("patient_id")
            results.append(result)
        return results

    @with_api_retry(circuit_breaker="twilio")
    async def get_message(self, message_sid: str) -> dict[str, Any]:
        """Get message status and details."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(
                f"/Accounts/{self._account_sid}/Messages/{message_sid}.json"
            )
            response.raise_for_status()
            result = response.json()

        return {
            "message_sid": result.get("sid"),
            "status": result.get("status"),
            "to": result.get("to"),
            "from": result.get("from"),
            "body": result.get("body"),
            "date_sent": result.get("date_sent"),
            "error_code": result.get("error_code"),
            "error_message": result.get("error_message"),
            "raw_response": result,
        }

    @with_api_retry(circuit_breaker="twilio")
    async def make_call(
        self,
        to: str,
        twiml: str | None = None,
        url: str | None = None,
        from_number: str | None = None,
        status_callback: str | None = None,
    ) -> dict[str, Any]:
        """Make an outbound voice call.

        Args:
            to: Recipient phone number
            twiml: TwiML instructions as XML string
            url: URL to fetch TwiML from
            from_number: Caller ID
            status_callback: Webhook URL for call status updates
        """
        self.require_configured()

        from_num = from_number or self._from_number
        if not from_num:
            raise ValueError("No from_number provided and TWILIO_FROM_NUMBER not set")

        data: dict[str, Any] = {
            "To": to,
            "From": from_num,
        }

        if twiml:
            data["Twiml"] = twiml
        elif url:
            data["Url"] = url
        else:
            raise ValueError("Either twiml or url must be provided")

        if status_callback:
            data["StatusCallback"] = status_callback
            data["StatusCallbackEvent"] = ["initiated", "ringing", "answered", "completed"]

        async with self._client() as client:
            response = await client.post(
                f"/Accounts/{self._account_sid}/Calls.json",
                data=data,
            )
            response.raise_for_status()
            result = response.json()

        return {
            "call_sid": result.get("sid"),
            "status": result.get("status"),
            "to": to,
            "from": from_num,
            "duration": result.get("duration"),
            "price": result.get("price"),
            "raw_response": result,
        }

    @with_api_retry(circuit_breaker="twilio")
    async def send_appointment_reminder(
        self,
        to: str,
        patient_name: str,
        appointment_time: str,
        provider_name: str,
        location: str,
        from_number: str | None = None,
    ) -> dict[str, Any]:
        """Send a templated appointment reminder SMS."""
        body = (
            f"Hi {patient_name}, this is a reminder of your appointment "
            f"with {provider_name} on {appointment_time} at {location}. "
            f"Reply CONFIRM to confirm or CANCEL to cancel. "
            f"Call us at (555) 123-4567 with questions."
        )
        return await self.send_sms(to=to, body=body, from_number=from_number)

    @with_api_retry(circuit_breaker="twilio")
    async def send_follow_up_message(
        self,
        to: str,
        patient_name: str,
        follow_up_type: str,
        instructions: str,
        from_number: str | None = None,
    ) -> dict[str, Any]:
        """Send a post-visit follow-up message."""
        body = (
            f"Hi {patient_name}, following up on your recent visit. "
            f"{follow_up_type}: {instructions} "
            f"Reply if you have questions or call (555) 123-4567."
        )
        return await self.send_sms(to=to, body=body, from_number=from_number)

    @with_api_retry(circuit_breaker="twilio")
    async def get_message_history(
        self,
        to: str | None = None,
        from_number: str | None = None,
        date_sent_after: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Get message history.

        Args:
            to: Filter by recipient
            from_number: Filter by sender
            date_sent_after: ISO date string (YYYY-MM-DD)
            limit: Max results (default 50)
        """
        self.require_configured()

        params: dict[str, str | int] = {"PageSize": limit}
        if to:
            params["To"] = to
        if from_number:
            params["From"] = from_number
        if date_sent_after:
            params["DateSent>"] = date_sent_after

        async with self._client() as client:
            response = await client.get(
                f"/Accounts/{self._account_sid}/Messages.json",
                params=params,
            )
            response.raise_for_status()
            result = response.json()

        messages = result.get("messages", [])
        return [
            {
                "message_sid": m.get("sid"),
                "status": m.get("status"),
                "to": m.get("to"),
                "from": m.get("from"),
                "body": m.get("body"),
                "date_sent": m.get("date_sent"),
                "direction": m.get("direction"),
                "price": m.get("price"),
            }
            for m in messages
        ]

    @with_api_retry(circuit_breaker="twilio")
    async def lookup_phone_number(self, phone_number: str) -> dict[str, Any]:
        """Look up phone number details (carrier, type, etc.)."""
        self.require_configured()

        async with httpx.AsyncClient(auth=(self._account_sid, self.api_key)) as client:
            response = await client.get(
                f"https://lookups.twilio.com/v2/PhoneNumbers/{phone_number}"
            )
            response.raise_for_status()
            result = response.json()

        return {
            "phone_number": result.get("phone_number"),
            "valid": result.get("valid"),
            "type": result.get("phone_number_type"),
            "carrier": result.get("carrier", {}).get("name"),
            "raw_response": result,
        }
