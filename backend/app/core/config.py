from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "美甲AI试戴与智能运营"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nail_tryon"

    # MiMo API (OpenAI-compatible)
    MIMO_API_KEY: str = ""
    MIMO_BASE_URL: str = "https://token-plan-cn.xiaomimimo.com/v1"
    MIMO_MODEL: str = "mimo-v2-flash"

    # MediaPipe
    MEDIAPIPE_MAX_HANDS: int = 1
    MEDIAPIPE_CONFIDENCE: float = 0.5

    # Image storage
    UPLOAD_DIR: str = "uploads"
    RESULT_DIR: str = "results"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    api_key = os.environ.get("MIMO_API_KEY", "")
    return Settings(MIMO_API_KEY=api_key)
