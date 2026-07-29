from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SOKOL API"
    api_v1_prefix: str = "/api/v1"
    database_url: str = ""
    sokol_ollama_url: str = "http://localhost:11434"
    sokol_ollama_model: str = "qwen2.5:14b"
    sokol_ollama_timeout_s: float = 600

    model_config = SettingsConfigDict(
        env_file=(".env", ".secrets/sokol.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
