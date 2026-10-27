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

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()

