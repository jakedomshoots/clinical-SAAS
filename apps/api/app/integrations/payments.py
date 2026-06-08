from app.integrations.base import ConfiguredIntegration


class PaymentsClient(ConfiguredIntegration):
    name = "payments"
    env_var = "PAYMENTS_API_KEY"
    adapter_detail = "Configure a vendor-specific payments adapter before live use."

    async def process_payment(self, patient_id: str, amount_cents: int, method: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific payments adapter before live use"
        )

    async def refund_payment(self, transaction_id: str, amount_cents: int | None = None) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific payments adapter before live use"
        )

    async def get_payment_history(self, patient_id: str) -> list[dict]:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific payments adapter before live use"
        )
