"""Intuit QuickBooks Payments integration adapter.

Handles payment processing, refunds, and transaction history
via the Intuit QuickBooks Payments API.

API Docs: https://developer.intuit.com/app/developer/qbpayments/docs/api/resources/all-entities/payments
"""

from __future__ import annotations

from typing import Any

import httpx

from app.integrations.base import ConfiguredIntegration
from app.services.retry_service import with_api_retry


class IntuitPaymentsClient(ConfiguredIntegration):
    """Intuit QuickBooks Payments client."""

    name = "intuit_payments"
    env_var = "INTUIT_PAYMENTS_API_KEY"
    adapter_detail = "Intuit QuickBooks Payments — production payment processing"

    def _client(self) -> httpx.AsyncClient:
        from app.config import settings
        base_url = getattr(settings, "intuit_payments_base_url", "https://sandbox.api.intuit.com")
        if not base_url:
            base_url = "https://sandbox.api.intuit.com"
        return httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Request-Id": self._request_id(),
            },
            timeout=30.0,
        )

    def _request_id(self) -> str:
        import uuid
        return str(uuid.uuid4())

    @with_api_retry(circuit_breaker="intuit_payments")
    async def process_payment(
        self,
        patient_id: str,
        amount_cents: int,
        method: str,
        description: str = "",
        card_token: str | None = None,
        bank_account_token: str | None = None,
    ) -> dict[str, Any]:
        """Process a payment through Intuit.

        Args:
            patient_id: Internal patient identifier
            amount_cents: Amount in cents (e.g. 2500 = $25.00)
            method: "card" or "ach"
            description: Payment description
            card_token: Intuit card token (for card payments)
            bank_account_token: Intuit bank account token (for ACH)
        """
        self.require_configured()

        payload: dict[str, Any] = {
            "amount": f"{amount_cents / 100:.2f}",
            "currency": "USD",
            "context": {
                "mobile": False,
                "isEcommerce": False,
            },
        }

        if description:
            payload["description"] = description

        if method == "card" and card_token:
            payload["cardOnFile"] = {"number": card_token}
        elif method == "ach" and bank_account_token:
            payload["bankAccountOnFile"] = {"number": bank_account_token}
        else:
            raise ValueError("Invalid payment method or missing token")

        async with self._client() as client:
            response = await client.post("/quickbooks/v4/payments/charges", json=payload)
            response.raise_for_status()
            data = response.json()

        return {
            "transaction_id": data.get("id"),
            "status": data.get("status", "unknown"),
            "amount_cents": amount_cents,
            "method": method,
            "patient_id": patient_id,
            "created_at": data.get("created"),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="intuit_payments")
    async def refund_payment(
        self,
        transaction_id: str,
        amount_cents: int | None = None,
        reason: str = "",
    ) -> dict[str, Any]:
        """Refund a payment.

        Args:
            transaction_id: Original Intuit transaction ID
            amount_cents: Amount to refund (None = full refund)
            reason: Refund reason
        """
        self.require_configured()

        payload: dict[str, Any] = {}
        if amount_cents is not None:
            payload["amount"] = f"{amount_cents / 100:.2f}"
        if reason:
            payload["description"] = reason

        async with self._client() as client:
            response = await client.post(
                f"/quickbooks/v4/payments/charges/{transaction_id}/refunds",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

        return {
            "refund_id": data.get("id"),
            "original_transaction_id": transaction_id,
            "status": data.get("status", "unknown"),
            "amount_cents": amount_cents,
            "reason": reason,
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="intuit_payments")
    async def get_payment_history(self, patient_id: str) -> list[dict[str, Any]]:
        """Get payment history for a patient.

        Note: Intuit doesn't store patient IDs. This queries recent
transactions and filters by metadata if available.
        """
        self.require_configured()

        async with self._client() as client:
            response = await client.get("/quickbooks/v4/payments/charges")
            response.raise_for_status()
            data = response.json()

        charges = data.get("QueryResponse", {}).get("Charge", [])

        # Filter by patient_id in description if stored there
        return [
            {
                "transaction_id": charge.get("id"),
                "status": charge.get("status"),
                "amount_cents": int(float(charge.get("amount", 0)) * 100),
                "created_at": charge.get("created"),
                "description": charge.get("description", ""),
            }
            for charge in charges
            if patient_id in charge.get("description", "")
        ]

    @with_api_retry(circuit_breaker="intuit_payments")
    async def get_transaction(self, transaction_id: str) -> dict[str, Any]:
        """Get details of a specific transaction."""
        self.require_configured()

        async with self._client() as client:
            response = await client.get(f"/quickbooks/v4/payments/charges/{transaction_id}")
            response.raise_for_status()
            data = response.json()

        return {
            "transaction_id": data.get("id"),
            "status": data.get("status"),
            "amount_cents": int(float(data.get("amount", 0)) * 100),
            "created_at": data.get("created"),
            "description": data.get("description", ""),
            "raw_response": data,
        }

    @with_api_retry(circuit_breaker="intuit_payments")
    async def void_transaction(self, transaction_id: str) -> dict[str, Any]:
        """Void an unsettled transaction."""
        self.require_configured()

        async with self._client() as client:
            response = await client.post(
                f"/quickbooks/v4/payments/charges/{transaction_id}/void"
            )
            response.raise_for_status()
            data = response.json()

        return {
            "transaction_id": transaction_id,
            "status": "voided",
            "raw_response": data,
        }
