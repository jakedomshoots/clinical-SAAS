from app.integrations.base import ConfiguredIntegration


class IdentityClient(ConfiguredIntegration):
    name = "identity"
    env_var = "IDENTITY_PROVIDER_ISSUER_URL"
    adapter_detail = "Configure a vendor-specific identity/MFA adapter before live use."

    async def authenticate_user(self, username: str, password: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific identity/MFA adapter before live use"
        )

    async def verify_mfa(self, user_id: str, mfa_code: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific identity/MFA adapter before live use"
        )

    async def provision_user(self, user_data: dict) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific identity/MFA adapter before live use"
        )

    async def deprovision_user(self, user_id: str) -> dict:
        self.require_configured()
        raise NotImplementedError(
            "Configure a vendor-specific identity/MFA adapter before live use"
        )
