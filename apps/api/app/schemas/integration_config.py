from pydantic import BaseModel, Field


class IntegrationConfigFieldOut(BaseModel):
    key: str
    label: str
    required: bool = True
    secret: bool = False
    configured: bool = False
    source: str = "missing"
    value_preview: str | None = None


class IntegrationConfigOut(BaseModel):
    key: str
    label: str
    configured: bool
    healthy: bool
    mode: str
    status: str
    fields: list[IntegrationConfigFieldOut]
    workflows: list[str]
    action: str
    sandbox_tests: list[str] = Field(default_factory=list)
    docs: list[str] = Field(default_factory=list)
    last_tested_at: str | None = None
    last_test_status: str | None = None


class IntegrationConfigListOut(BaseModel):
    data: list[IntegrationConfigOut]


class IntegrationConfigUpdate(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)


class IntegrationConnectionTestOut(BaseModel):
    integration: str
    status: str
    configured: bool
    healthy: bool
    mode: str
    message: str
    event_id: str


class CredentialPreflightStepOut(BaseModel):
    key: str
    label: str
    status: str
    detail: str


class CredentialPreflightItemOut(BaseModel):
    key: str
    label: str
    status: str
    configured: bool
    healthy: bool
    mode: str
    missing_fields: list[str]
    configured_fields: list[str]
    workflows: list[str]
    sandbox_tests: list[str]
    blockers: list[str]
    steps: list[CredentialPreflightStepOut]
    docs: list[str]
    last_tested_at: str | None = None
    last_test_status: str | None = None


class CredentialPreflightOut(BaseModel):
    generated_at: str
    ready_count: int
    staged_count: int
    blocking_count: int
    total: int
    data: list[CredentialPreflightItemOut]
