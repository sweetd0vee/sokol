from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SOKOL API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = ""
    sokol_max_upload_mb: int = 100
    sokol_cors_origins: str = ""

    # Auth (JWT + HTTP Basic; users in PostgreSQL `users` table)
    sokol_env: str = "development"
    sokol_jwt_secret: str = "sokol-dev-jwt-secret-change-me"
    sokol_jwt_expire_minutes: int = 480
    sokol_admin_password: str = "admin"
    sokol_default_user_password: str = "auditor"

    # Ollama (audit-opinion / раздел I)
    sokol_ollama_url: str = "http://localhost:11434"
    sokol_ollama_model: str = "qwen3.5:35b"
    sokol_ollama_timeout_s: int = 600

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
    def minio_enabled(self) -> bool:
        return bool(
            self.sokol_minio_endpoint.strip()
            and self.sokol_minio_access_key.strip()
            and self.sokol_minio_secret_key.strip()
        )

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
    def max_upload_bytes(self) -> int:
        return max(1, self.sokol_max_upload_mb) * 1024 * 1024

    @property
    def cors_origins(self) -> list[str]:
        """Comma-separated SOKOL_CORS_ORIGINS; empty → allow all (`*`)."""
        raw = self.sokol_cors_origins.strip()
        if not raw:
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()] or ["*"]


settings = Settings()
