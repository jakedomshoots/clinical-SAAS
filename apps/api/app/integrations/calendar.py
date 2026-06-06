from app.integrations.base import ConfiguredIntegration


class CalendarClient(ConfiguredIntegration):
    name = "calendar"
    env_var = "CALENDAR_API_BASE_URL"
    adapter_detail = "Configure a vendor-specific calendar adapter before live use."

    async def create_event(self, appointment: dict) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific calendar adapter before live use")

    async def update_event(self, appointment: dict) -> dict:
        self.require_configured()
        raise NotImplementedError("Configure a vendor-specific calendar adapter before live use")
