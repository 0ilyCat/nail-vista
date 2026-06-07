"""
NailVista 鏍稿績閰嶇疆
鏀寔 .env 鏂囦欢鍜岀幆澧冨彉閲忔敞鍏?
"""
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List, Optional


class Settings(BaseSettings):
    # 搴旂敤
    APP_NAME: str = "NailVista"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # 鏁版嵁搴?(MySQL)
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "nail_vista"
    DATABASE_URL: Optional[str] = None

    # JWT
    JWT_SECRET_KEY: str = "nailvista-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # 鏂囦欢涓婁紶
    STATIC_DIR: str = "static"
    UPLOAD_DIR: str = "static"
    RESULT_DIR: str = "static/results"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:4180",
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # OpenClaw AI Gateway
    OPENCLAW_BASE_URL: str = "http://127.0.0.1:18789"
    OPENCLAW_GATEWAY_TOKEN: str = "nailvista-dev-token"

    # Gateway WebSocket 閲嶈繛涓庤秴鏃堕厤缃?
    OPENCLAW_WS_RECONNECT_DELAY: int = 5        # 断线重连间隔(秒)
    OPENCLAW_WS_RECONNECT_MAX_RETRIES: int = 12 # 最大重连次数(12×5s=60s)
    OPENCLAW_WS_REQUEST_TIMEOUT: int = 300       # 鍗曟璇锋眰瓒呮椂(绉?

    # 闃块噷鐧剧偧鍥剧敓妯″瀷 (AI璇曟埓)
    DASHSCOPE_API_KEY: str = ""

    # 鏈湴鍥剧墖瀛樺偍 (鍥剧墖閫氳繃 /api/getImg?name= 璁块棶)
    IMAGE_BASE_URL: str = ""  # 鐣欑┖锛屽墠绔娇鐢ㄧ浉瀵硅矾寰?/api/getImg

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        # URL-encode the password so special characters do not break the MySQL URL.
        encoded_pw = quote_plus(self.DB_PASSWORD)
        return f"mysql+aiomysql://{self.DB_USER}:{encoded_pw}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def static_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        return base / self.STATIC_DIR

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

