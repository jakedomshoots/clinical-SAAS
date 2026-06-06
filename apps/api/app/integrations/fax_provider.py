from app.integrations.base import ConfiguredIntegration


class FaxProviderClient(ConfiguredIntegration):
    name = "fax_provider"
    env_var = "FAX_PROVIDER_API_KEY"
    adapter_detail = "Configure a vendor-specific fax adapter before live use."

    async def send_document(self, to_number: str, file_url: str | None) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific fax adapter before live use")
