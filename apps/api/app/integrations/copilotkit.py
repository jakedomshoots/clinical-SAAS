from app.integrations.base import ConfiguredIntegration


class CopilotRuntimeClient(ConfiguredIntegration):
    name = "copilotkit"
    env_var = "COPILOTKIT_RUNTIME_URL"

    async def health(self):
        return await super().health()
