from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.startup_validation import DEFAULT_JWT_SECRET, is_production_env


def parse_cors_origins(raw: str) -> list[str]:
    """Comma-separated origins; empty or blank entries → allow all (`*`)."""
    return [origin.strip() for origin in raw.split(",") if origin.strip()] or ["*"]


class Settings(BaseSettings):
    app_name: str = "SOKOL API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = ""
    sokol_max_upload_mb: int = 100
    sokol_cors_origins: str = ""

    # Auth (JWT; optional HTTP Basic for local/tools; users in PostgreSQL `users` table)
    sokol_env: str = "development"
    sokol_jwt_secret: str = DEFAULT_JWT_SECRET
    sokol_jwt_expire_minutes: int = 480
    sokol_enable_basic_auth: bool | None = None
    sokol_admin_password: str = "admin"
    sokol_default_user_password: str = "auditor"

    # MinIO / S3-compatible object storage
    sokol_minio_endpoint: str = ""
    sokol_minio_access_key: str = ""
    sokol_minio_secret_key: str = ""
    sokol_minio_secure: bool = False
    sokol_minio_region: str = ""

    model_config = SettingsConfigDict(
        env_file=(".env", ".secrets/sokol.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        return is_production_env(self.sokol_env)

    @property
    def minio_endpoint(self) -> str:
        return self.sokol_minio_endpoint.strip()

    @property
    def minio_access_key(self) -> str:
        return self.sokol_minio_access_key.strip()

    @property
    def minio_secret_key(self) -> str:
        return self.sokol_minio_secret_key.strip()

    @property
    def minio_secure(self) -> bool:
        return self.sokol_minio_secure

    @property
    def minio_region(self) -> str:
        return self.sokol_minio_region.strip()

    @property
    def minio_enabled(self) -> bool:
        return bool(self.minio_endpoint and self.minio_access_key and self.minio_secret_key)

    @property
    def max_upload_bytes(self) -> int:
        return max(1, self.sokol_max_upload_mb) * 1024 * 1024

    @property
    def basic_auth_enabled(self) -> bool:
        """HTTP Basic is on in development unless explicitly disabled; off in prod by default."""
        if self.sokol_enable_basic_auth is not None:
            return self.sokol_enable_basic_auth
        return not self.is_production

    @property
    def cors_origins(self) -> list[str]:
        """Comma-separated SOKOL_CORS_ORIGINS; empty → allow all (`*`)."""
        return parse_cors_origins(self.sokol_cors_origins)


settings = Settings()
