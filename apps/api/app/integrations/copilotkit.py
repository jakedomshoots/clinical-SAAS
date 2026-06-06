from app.integrations.base import ConfiguredIntegration


class CopilotRuntimeClient(ConfiguredIntegration):
    name = "copilotkit"
    env_var = "COPILOTKIT_RUNTIME_URL"
    adapter_implemented = True
    adapter_detail = "CopilotKit runtime URL is configured and reachable by the API."

    async def health(self):
        return await super().health()
