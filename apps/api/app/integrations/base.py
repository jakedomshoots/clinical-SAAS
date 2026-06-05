from dataclasses import dataclass


class IntegrationNotConfiguredError(RuntimeError):
    pass


@dataclass(frozen=True)
class IntegrationHealth:
    ok: bool
    configured: bool
    name: str
    env_var: str
    error: str | None = None

    def as_dict(self) -> dict:
        out = {
            "ok": self.ok,
            "configured": self.configured,
            "env_var": self.env_var,
        }
        if self.error:
            out["error"] = self.error
        if not self.configured:
            out["mode"] = "demo"
        return out


class ConfiguredIntegration:
    name: str
    env_var: str

    def __init__(self, value: str) -> None:
        self.value = value.strip()

    @property
    def configured(self) -> bool:
        return bool(self.value)

    def require_configured(self) -> None:
        if not self.configured:
            raise IntegrationNotConfiguredError(
                f"{self.name} integration requires {self.env_var}"
            )

    async def health(self) -> IntegrationHealth:
        if not self.configured:
            return IntegrationHealth(
                ok=False,
                configured=False,
                name=self.name,
                env_var=self.env_var,
            )
        return IntegrationHealth(
            ok=True,
            configured=True,
            name=self.name,
            env_var=self.env_var,
        )
