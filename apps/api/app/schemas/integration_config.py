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


class VendorProfileOut(BaseModel):
    vendor_name: str = ""
    environment: str = ""
    owner_name: str = ""
    owner_email: str = ""
    support_contact: str = ""
    escalation_notes: str = ""
    contract_reference_url: str = ""
    profile_complete: bool = False
    missing_fields: list[str] = Field(default_factory=list)


class CutoverEvidenceOut(BaseModel):
    planned_cutover_at: str = ""
    last_vendor_test_at: str = ""
    rollback_owner: str = ""
    go_no_go_notes: str = ""
    live_rehearsal_approved: bool = False
    evidence_complete: bool = False
    missing_fields: list[str] = Field(default_factory=list)


class VendorRiskOut(BaseModel):
    key: str
    title: str
    severity: str = "warning"
    mitigation_owner: str = ""
    mitigation_status: str = "open"
    blocks_live_rehearsal: bool = False
    resolved: bool = False


class VendorRiskRegisterOut(BaseModel):
    risks: list[VendorRiskOut] = Field(default_factory=list)
    risk_count: int = 0
    blocking_count: int = 0


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
    readiness_mode: str = "production_vendor"
    sandbox_ready: bool = False
    production_ready: bool = False
    mode: str
    status: str
    fields: list[IntegrationConfigFieldOut]
    vendor_profile: VendorProfileOut = Field(default_factory=VendorProfileOut)
    cutover_evidence: CutoverEvidenceOut = Field(default_factory=CutoverEvidenceOut)
    risk_register: VendorRiskRegisterOut = Field(default_factory=VendorRiskRegisterOut)
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
    readiness_mode: str = "production_vendor"
    sandbox_ready: bool = False
    production_ready: bool = False
    mode: str
    vendor_profile: VendorProfileOut = Field(default_factory=VendorProfileOut)
    cutover_evidence: CutoverEvidenceOut = Field(default_factory=CutoverEvidenceOut)
    risk_register: VendorRiskRegisterOut = Field(default_factory=VendorRiskRegisterOut)
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


class VendorHandoffPacketOut(BaseModel):
    integration: str
    label: str
    generated_at: str
    export_filename: str
    status: str
    readiness_mode: str
    production_ready: bool = False
    sandbox_ready: bool = False
    mode: str
    configured_fields: list[str]
    missing_fields: list[str]
    vendor_profile: VendorProfileOut
    cutover_evidence: CutoverEvidenceOut
    risk_register: VendorRiskRegisterOut
    adapter_methods: list[AdapterMethodOut]
    adapter_method_ready_count: int = 0
    adapter_method_total: int = 0
    sandbox_tests: list[str]
    sandbox_evidence: list[SandboxEvidenceOut]
    preflight_steps: list[CredentialPreflightStepOut]
    blockers: list[str]
    docs: list[str]
    sections: list[str]


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
