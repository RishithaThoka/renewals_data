"""
Application configuration — all settings come from environment variables or .env.
Never hard-code secrets or model names here.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = f"sqlite:///{ROOT_DIR / 'renewals.db'}"

    # AI provider (stub by default; swap to "gemini" or "openai" via .env)
    AI_PROVIDER: str = "demo"          # "demo" | "gemini" | "openai" | "custom"
    AI_BASE_URL: str = ""              # e.g. https://generativelanguage.googleapis.com
    AI_MODEL_NAME: str = ""            # e.g. gemini-1.5-flash  (never hard-coded)
    AI_API_KEY: str = ""

    # AI / LLM provider
    DEMO_MODE: bool = True
    LLM_BASE_URL: str = ""             # e.g. https://api.openai.com/v1
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT: int = 30
    LLM_MAX_TOOL_CALLS: int = 6
    LLM_SEND_MODE: str = "aggregates"  # "aggregates" | "full"

    # Paths
    DATA_DIR: Path = ROOT_DIR / "data"
    ASSETS_DIR: Path = ROOT_DIR / "assets"

    # App
    APP_TITLE: str = "Mobileum Renewals Intelligence"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
