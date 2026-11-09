from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    # Paths default to the backend directory so the app behaves the same whatever
    # directory it is launched from.
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'snap_a_store.db').as_posix()}"
    upload_directory: str = str(BACKEND_DIR / "uploads")
    max_upload_bytes: int = 10 * 1024 * 1024
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    # Public URL of the storefront, used for checkout links handed to external agents.
    public_app_url: str = "http://localhost:3000"
    # "mock", "groq", or "gemini".
    vision_provider: str = "mock"
    vision_api_key: str = ""
    vision_model: str = ""
    # "groq" enables the LLM shopping agent; "none" keeps the rule-based planner.
    llm_provider: str = "none"
    groq_api_key: str = ""
    groq_model: str = "qwen/qwen3.8-27b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    # Comma-separated list of browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000"

    # The repo-root .env is shared with the frontend; backend/.env can override it.
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"), case_sensitive=False, extra="ignore"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def paypal_enabled(self) -> bool:
        return bool(self.paypal_client_id and self.paypal_client_secret)


settings = Settings()
