from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "美甲AI试戴与智能运营"
    DEBUG: bool = True

    # Database
    USE_POSTGRES: bool = False
    DATABASE_URL: str = ""
    PG_HOST: str = "localhost"
    PG_PORT: int = 5432
    PG_USER: str = "postgres"
    PG_PASSWORD: str = "postgres"
    PG_DB: str = "nail_tryon"

    # LongCat API (OpenAI-compatible, from .env)
    LONGCAT_API_KEY: str = ""
    LONGCAT_BASE_URL: str = "https://api.longcat.chat/openai"
    LONGCAT_MODEL: str = "LongCat-2.0-Preview"

    # Bailian API (image generation, from .env)
    DASHSCOPE_API_KEY: str = ""

    # MediaPipe
    MEDIAPIPE_MAX_HANDS: int = 1
    MEDIAPIPE_CONFIDENCE: float = 0.5

    # Image storage
    UPLOAD_DIR: str = "uploads"
    RESULT_DIR: str = "results"
    STATIC_DIR: str = "static"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:4180", "http://localhost:3000"]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.USE_POSTGRES:
            return (
                f"postgresql+asyncpg://{self.PG_USER}:{self.PG_PASSWORD}"
                f"@{self.PG_HOST}:{self.PG_PORT}/{self.PG_DB}"
            )
        return "sqlite+aiosqlite:///./nail_tryon.db"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
