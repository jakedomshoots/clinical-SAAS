from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "change-me-in-production-use-a-long-random-string"
DEFAULT_MINIO_ACCESS_KEY = "minioadmin"
DEFAULT_MINIO_SECRET_KEY = "minioadmin"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://concierge:concierge_dev@localhost:5432/concierge_os"
    redis_url: str = "redis://localhost:6379/0"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = DEFAULT_MINIO_ACCESS_KEY
    minio_secret_key: str = DEFAULT_MINIO_SECRET_KEY
    minio_bucket: str = "concierge-os"
    minio_secure: bool = False

    secret_key: str = DEFAULT_SECRET_KEY
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:1420"
    auto_create_schema: bool = True
    ensure_object_storage_on_startup: bool = True
    allow_seed_endpoint: bool = True
    require_external_mfa_in_production: bool = True
    auth_rate_limit_attempts: int = 5
    auth_rate_limit_window_seconds: int = 900
    document_upload_verification_required: bool = False
    webhook_default_organization_id: str = "default"

    ehr_api_base_url: str = ""
    fax_provider_api_key: str = ""
    portal_api_base_url: str = ""
    calendar_api_base_url: str = ""
    copilotkit_runtime_url: str = ""
    communications_provider: str = "demo"
    communications_provider_api_key: str = ""
    clearinghouse_api_base_url: str = ""
    clearinghouse_api_key: str = ""
    use_sandbox_adapters: bool = False
    webhook_shared_secret: str = ""
    patient_portal_access_code_expire_minutes: int = 60 * 24 * 7

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @model_validator(mode="after")
    def validate_production_settings(self):
        if not self.is_production:
            return self

        failures: list[str] = []
        if self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key) < 32:
            failures.append(
                "SECRET_KEY must be a unique production secret of at least 32 characters"
            )
        if self.minio_access_key == DEFAULT_MINIO_ACCESS_KEY:
            failures.append("MINIO_ACCESS_KEY must not use the development default in production")
        if self.minio_secret_key == DEFAULT_MINIO_SECRET_KEY:
            failures.append("MINIO_SECRET_KEY must not use the development default in production")
        if "*" in self.cors_origin_list:
            failures.append("CORS_ORIGINS must not include wildcard origins in production")
        if any(origin.startswith("http://localhost") for origin in self.cors_origin_list):
            failures.append("CORS_ORIGINS must not include localhost origins in production")
        if self.auto_create_schema:
            failures.append(
                "AUTO_CREATE_SCHEMA must be false in production; run Alembic migrations explicitly"
            )
        if not self.ensure_object_storage_on_startup:
            failures.append("ENSURE_OBJECT_STORAGE_ON_STARTUP must be true in production")
        if self.allow_seed_endpoint:
            failures.append("ALLOW_SEED_ENDPOINT must be false in production")
        if not self.require_external_mfa_in_production:
            failures.append("REQUIRE_EXTERNAL_MFA_IN_PRODUCTION must be true in production")
        if not self.webhook_shared_secret or len(self.webhook_shared_secret) < 16:
            failures.append(
                "WEBHOOK_SHARED_SECRET must be configured with at least 16 characters in production"
            )

        if failures:
            raise ValueError("; ".join(failures))
        return self


settings = Settings()
