from app.integrations.base import ConfiguredIntegration


class LabsHIEClient(ConfiguredIntegration):
    name = "labs_hie"
    env_var = "LABS_HIE_API_BASE_URL"
    adapter_detail = "Configure a vendor-specific Labs/HIE adapter before live use."

    async def fetch_lab_results(self, patient_id: str) -> list[dict]:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific Labs/HIE adapter before live use")

    async def submit_lab_order(self, patient_id: str, order: dict) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific Labs/HIE adapter before live use")

    async def check_order_status(self, order_id: str) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific Labs/HIE adapter before live use")
