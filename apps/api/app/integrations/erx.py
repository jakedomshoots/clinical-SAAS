from app.integrations.base import ConfiguredIntegration


class ERxClient(ConfiguredIntegration):
    name = "erx"
    env_var = "ERX_API_BASE_URL"
    adapter_detail = "Configure a certified eRx adapter before live use."

    async def get_medication_history(self, patient_id: str) -> list[dict]:
        self.require_configured()
        raise NotImplementedError(
            "Configure a certified eRx adapter before live use"
        )

    async def send_prescription(self, patient_id: str, prescription: dict) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a certified eRx adapter before live use"
        )

    async def check_prescription_status(self, prescription_id: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a certified eRx adapter before live use"
        )

    async def cancel_prescription(self, prescription_id: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a certified eRx adapter before live use"
        )
