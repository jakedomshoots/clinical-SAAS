import pytest
from pydantic import ValidationError

from app.config import DEFAULT_SECRET_KEY, Settings


def test_development_allows_local_defaults():
    settings = Settings()

    assert settings.app_env == "development"
    assert "http://localhost:5173" in settings.cors_origin_list


def test_production_rejects_development_defaults():
    with pytest.raises(ValidationError) as exc:
        Settings(app_env="production", secret_key=DEFAULT_SECRET_KEY)

    message = str(exc.value)
    assert "SECRET_KEY must be a unique production secret" in message
    assert "MINIO_ACCESS_KEY must not use the development default" in message
    assert "CORS_ORIGINS must not include localhost origins" in message
    assert "AUTO_CREATE_SCHEMA must be false in production" in message
    assert "ENSURE_OBJECT_STORAGE_ON_STARTUP must be true in production" not in message
    assert "ALLOW_SEED_ENDPOINT must be false in production" in message
    assert "WEBHOOK_SHARED_SECRET must be configured" in message


def test_production_allows_hardened_settings():
    settings = Settings(
        app_env="production",
        secret_key="prod-secret-with-more-than-thirty-two-characters",
        minio_access_key="prod-access-key",
        minio_secret_key="prod-secret-key",
        cors_origins="https://concierge.example.com",
        auto_create_schema=False,
        ensure_object_storage_on_startup=True,
        allow_seed_endpoint=False,
        webhook_shared_secret="prod-webhook-secret",
    )

    assert settings.is_production is True
    assert settings.cors_origin_list == ["https://concierge.example.com"]


def test_production_requires_object_storage_startup_check():
    with pytest.raises(ValidationError) as exc:
        Settings(
            app_env="production",
            secret_key="prod-secret-with-more-than-thirty-two-characters",
            minio_access_key="prod-access-key",
            minio_secret_key="prod-secret-key",
            cors_origins="https://concierge.example.com",
            auto_create_schema=False,
            ensure_object_storage_on_startup=False,
            allow_seed_endpoint=False,
            webhook_shared_secret="prod-webhook-secret",
        )

    assert "ENSURE_OBJECT_STORAGE_ON_STARTUP must be true in production" in str(exc.value)
