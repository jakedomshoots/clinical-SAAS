from app.integrations.base import ConfiguredIntegration


class PortalClient(ConfiguredIntegration):
    name = "portal"
    env_var = "PORTAL_API_BASE_URL"
    adapter_detail = "Configure a vendor-specific patient portal adapter before live use."

    async def send_message(self, recipient_id: str, subject: str, body: str) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific portal adapter before live use")
