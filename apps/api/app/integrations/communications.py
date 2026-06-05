from app.integrations.base import ConfiguredIntegration


class CommunicationsClient(ConfiguredIntegration):
    name = "communications"
    env_var = "COMMUNICATIONS_PROVIDER_API_KEY"
