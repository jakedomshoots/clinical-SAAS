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

    ehr_api_base_url: str = ""
    fax_provider_api_key: str = ""
    portal_api_base_url: str = ""
    calendar_api_base_url: str = ""
    copilotkit_runtime_url: str = ""

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

        if failures:
            raise ValueError("; ".join(failures))
        return self


settings = Settings()
