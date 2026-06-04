"""
NailVista 核心配置
支持 .env 文件和环境变量注入
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    # 应用
    APP_NAME: str = "NailVista"
    DEBUG: bool = True
    API_PREFIX: str = "/api"

    # 数据库 (MySQL)
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "nail_vista"

    # JWT
    JWT_SECRET_KEY: str = "nailvista-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # 文件上传
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

    # 阿里百炼图生模型 (AI试戴)
    DASHSCOPE_API_KEY: str = ""

    # 本地图片存储 (图片通过 /api/getImg?name= 访问)
    IMAGE_BASE_URL: str = ""  # 留空，前端使用相对路径 /api/getImg

    @property
    def database_url(self) -> str:
        return f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def static_path(self) -> Path:
        base = Path(__file__).parent.parent.parent
        return base / self.STATIC_DIR

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
