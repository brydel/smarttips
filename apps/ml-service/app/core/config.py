from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

AppEnv = Literal["development", "test", "production"]
StorageBackend = Literal["local", "r2"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",
        case_sensitive=False,
    )

    app_name: str = "smarttips-ml-service"
    app_env: AppEnv = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    internal_token: SecretStr = Field(
        min_length=32,
        description="Service-to-service token used by NestJS to call the ML service.",
    )

    model_artifact_secret: SecretStr = Field(
        min_length=32,
        description="Secret used to sign and verify persisted model artifacts.",
    )

    storage_backend: StorageBackend = "local"
    local_model_dir: Path = Path("./data/models")

    r2_bucket: str | None = None
    r2_endpoint: AnyHttpUrl | None = None
    r2_access_key: SecretStr | None = None
    r2_secret_key: SecretStr | None = None

    request_timeout_seconds: float = Field(default=5.0, gt=0.0, le=30.0)
    model_cache_max_tenants: int = Field(default=512, ge=1, le=10_000)
    max_train_events_per_request: int = Field(default=1, ge=1, le=100)

    @field_validator("local_model_dir")
    @classmethod
    def validate_local_model_dir(cls, value: Path) -> Path:
        return value.expanduser()

    @field_validator("r2_bucket")
    @classmethod
    def validate_r2_bucket(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if normalized == "":
            return None

        return normalized

    @model_validator(mode="after")
    def validate_storage_configuration(self) -> "Settings":
        if self.storage_backend == "r2":
            missing_fields: list[str] = []

            if self.r2_bucket is None:
                missing_fields.append("r2_bucket")

            if self.r2_endpoint is None:
                missing_fields.append("r2_endpoint")

            if self.r2_access_key is None:
                missing_fields.append("r2_access_key")

            if self.r2_secret_key is None:
                missing_fields.append("r2_secret_key")

            if missing_fields:
                joined_fields = ", ".join(missing_fields)
                raise ValueError(
                    f"R2 storage backend requires these settings: {joined_fields}"
                )

        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    def internal_token_value(self) -> str:
        return self.internal_token.get_secret_value()

    def model_artifact_secret_value(self) -> str:
        return self.model_artifact_secret.get_secret_value()

    def r2_access_key_value(self) -> str | None:
        if self.r2_access_key is None:
            return None

        return self.r2_access_key.get_secret_value()

    def r2_secret_key_value(self) -> str | None:
        if self.r2_secret_key is None:
            return None

        return self.r2_secret_key.get_secret_value()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]