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
    adapter_implemented: bool = False
    adapter_detail: str | None = None

    def as_dict(self) -> dict:
        out = {
            "ok": self.ok,
            "configured": self.configured,
            "env_var": self.env_var,
            "adapter_implemented": self.adapter_implemented,
        }
        if self.adapter_detail:
            out["adapter_detail"] = self.adapter_detail
        if self.error:
            out["error"] = self.error
        if not self.configured:
            out["mode"] = "demo"
        return out


class ConfiguredIntegration:
    name: str
    env_var: str
    adapter_implemented = False
    adapter_detail: str | None = None

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
        adapter_detail = self.adapter_detail or (
            f"Configure a vendor-specific {self.name} adapter before live use"
        )
        if not self.configured:
            return IntegrationHealth(
                ok=False,
                configured=False,
                name=self.name,
                env_var=self.env_var,
                adapter_implemented=self.adapter_implemented,
                adapter_detail=adapter_detail,
            )
        if not self.adapter_implemented:
            return IntegrationHealth(
                ok=False,
                configured=True,
                name=self.name,
                env_var=self.env_var,
                error=adapter_detail,
                adapter_implemented=False,
                adapter_detail=adapter_detail,
            )
        return IntegrationHealth(
            ok=True,
            configured=True,
            name=self.name,
            env_var=self.env_var,
            adapter_implemented=True,
            adapter_detail=adapter_detail,
        )
