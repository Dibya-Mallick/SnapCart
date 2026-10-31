from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./snap_a_store.db"
    upload_directory: str = "./uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    vision_provider: str = "mock"
    vision_api_key: str = ""
    vision_model: str = ""
    # Comma-separated list of browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

