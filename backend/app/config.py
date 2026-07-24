from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://qms_user:qms_password@localhost:5432/complaints_qms"
    groq_api_key: str | None = None
    groq_model: str = "gemma2-9b-it"
    groq_context_model: str = "llama-3.3-70b-versatile"
    frontend_origin: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

