from pydantic import BaseModel, Field
from datetime import datetime


class IntegrationConfigFieldOut(BaseModel):
    key: str
    label: str
    required: bool = True
    secret: bool = False
    configured: bool = False
    source: str = "missing"
    value_preview: str | None = None


class AdapterMethodOut(BaseModel):
    key: str
    label: str
    description: str
    required: bool = True
    status: str


class IntegrationConfigOut(BaseModel):
    key: str
    label: str
    configured: bool
    healthy: bool
    adapter_implemented: bool = False
    adapter_detail: str | None = None
    adapter_methods: list[AdapterMethodOut] = Field(default_factory=list)
    adapter_method_ready_count: int = 0
    adapter_method_total: int = 0
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


class SandboxEvidenceOut(BaseModel):
    id: str | None = None
    integration: str | None = None
    test_key: str
    test_label: str
    status: str
    notes: str = ""
    reference_url: str | None = None
    recorded_by: str | None = None
    recorded_at: datetime | None = None


class CredentialPreflightItemOut(BaseModel):
    key: str
    label: str
    status: str
    configured: bool
    healthy: bool
    adapter_implemented: bool = False
    adapter_detail: str | None = None
    adapter_methods: list[AdapterMethodOut] = Field(default_factory=list)
    adapter_method_ready_count: int = 0
    adapter_method_total: int = 0
    mode: str
    missing_fields: list[str]
    configured_fields: list[str]
    workflows: list[str]
    sandbox_tests: list[str]
    sandbox_evidence: list[SandboxEvidenceOut] = Field(default_factory=list)
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


class SandboxEvidenceCreate(BaseModel):
    test_label: str
    status: str = "passed"
    notes: str = ""
    reference_url: str | None = None


class SandboxWorkflowRunCreate(BaseModel):
    test_label: str


class SandboxWorkflowRunAllOut(BaseModel):
    integration: str
    passed_count: int
    failed_count: int = 0
    evidence: list[SandboxEvidenceOut]
