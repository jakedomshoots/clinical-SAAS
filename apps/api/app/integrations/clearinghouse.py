from app.integrations.base import ConfiguredIntegration


class ClearinghouseClient(ConfiguredIntegration):
    name = "clearinghouse"
    env_var = "CLEARINGHOUSE_API_KEY"
    adapter_detail = "Configure a vendor-specific clearinghouse adapter before live use."

    async def submit_claim(self, claim_payload: dict) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific clearinghouse adapter before live use"
        )

    async def import_remittance(self, reference_id: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific clearinghouse adapter before live use"
        )
