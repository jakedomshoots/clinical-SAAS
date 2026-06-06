from app.integrations.base import ConfiguredIntegration


class CommunicationsClient(ConfiguredIntegration):
    name = "communications"
    env_var = "COMMUNICATIONS_PROVIDER_API_KEY"
    adapter_detail = "Configure a vendor-specific communications adapter before live use."

    async def send(self, *, channel: str, recipient: str, subject: str, body: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific communications adapter before live use"
        )
