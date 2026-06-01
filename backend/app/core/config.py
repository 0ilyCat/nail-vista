class Settings(BaseSettings):
    # App
    APP_NAME: str = "NailVista"
    DEBUG: bool = True

    # Database
    USE_POSTGRES: bool = False
    DATABASE_URL: str = ""
    PG_HOST: str = "localhost"
    PG_PORT: int = 5432
    PG_USER: str = "postgres"
    PG_PASSWORD: str = "postgres"
    PG_DB: str = "nail_tryon"

    # 百炼 API（仅图像生成，只在 .env 配置）
    DASHSCOPE_API_KEY: str = ""

    # OpenClaw Gateway（优先读 .env，未配置时自动从 openclaw.json 加载）
    OPENCLAW_BASE_URL: str = "http://127.0.0.1:18789"
    OPENCLAW_GATEWAY_TOKEN: str = ""

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

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._load_openclaw_config()

    def _load_openclaw_config(self):
        """自动从项目根目录的 .openclaw/openclaw.json 读取 Gateway 配置"""
        project_root = Path(__file__).parent.parent.parent
        config_path = project_root / ".openclaw" / "openclaw.json"
        if not config_path.exists():
            return

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                raw = f.read()
            # 移除 JSON 不支持的行注释
            import re
            # 仅移除整行注释（以空白开头后跟 // 的行）
            raw = re.sub(r'^\s*//.*$', '', raw, flags=re.MULTILINE)
            oc = json.loads(raw)

            # 读取 env 段中的变量定义
            env_vars = oc.get("env", {})

            def resolve(value):
                """解析 ${VAR} 引用"""
                if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                    var_name = value[2:-1]
                    return env_vars.get(var_name, value)
                return value

            gateway = oc.get("gateway", {})
            port = gateway.get("port", 18789)
            auth = gateway.get("auth", {})
            token = resolve(auth.get("token", ""))

            if not self.OPENCLAW_BASE_URL or self.OPENCLAW_BASE_URL == "http://127.0.0.1:18789":
                self.OPENCLAW_BASE_URL = f"http://127.0.0.1:{port}"
            if not self.OPENCLAW_GATEWAY_TOKEN and token:
                self.OPENCLAW_GATEWAY_TOKEN = token
        except Exception:
            pass

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.USE_POSTGRES:
            return (
                f"postgresql+asyncpg://{self.PG_USER}:{self.PG_PASSWORD}"
                f"@{self.PG_HOST}:{self.PG_PORT}/{self.PG_DB}"
            )
        db_path = Path(__file__).parent.parent.parent / "nail_tryon.db"
        return f"sqlite+aiosqlite:///{db_path}"


def get_settings() -> Settings:
    return Settings()
