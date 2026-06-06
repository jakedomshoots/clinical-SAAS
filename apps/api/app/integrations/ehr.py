from app.integrations.base import ConfiguredIntegration


class EHRClient(ConfiguredIntegration):
    name = "ehr"
    env_var = "EHR_API_BASE_URL"
    adapter_detail = "Configure a vendor-specific EHR adapter before live use."

    async def search_patient(self, query: str) -> list[dict]:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific EHR adapter before live use")
