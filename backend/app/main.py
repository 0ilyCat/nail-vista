import time
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import get_settings, Settings
from app.core.database import init_db
from app.core.logger import setup_logging

settings: Settings = get_settings()

# ── 全局日志初始化 ──
setup_logging(logging.DEBUG if settings.DEBUG else logging.INFO)
logger = logging.getLogger("nailvista")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"=== {settings.APP_NAME} 启动 ===")
    logger.info(f"  OpenClaw: {settings.OPENCLAW_BASE_URL}")
    logger.info(f"  DB: {'PostgreSQL' if settings.USE_POSTGRES else 'SQLite'}")
    for d in [settings.UPLOAD_DIR, settings.RESULT_DIR, settings.STATIC_DIR]:
        Path(d).mkdir(parents=True, exist_ok=True)
    await init_db()
    logger.info("  数据库初始化完成")
    yield
    logger.info(f"=== {settings.APP_NAME} 关闭 ===")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 全局请求日志中间件 ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = (time.time() - start) * 1000
    # 跳过静态文件和健康检查
    if not request.url.path.startswith(("/static", "/uploads", "/results", "/api/health")):
        logger.info(
            f"[HTTP] {request.method} {request.url.path} | {response.status_code} | {elapsed:.0f}ms"
        )
    return response

# 确保静态目录存在
for d in [settings.STATIC_DIR, settings.UPLOAD_DIR, settings.RESULT_DIR]:
    Path(d).mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.mount("/results", StaticFiles(directory=settings.RESULT_DIR), name="results")


@app.get("/api/health")
async def health():
    db_url = settings.get_database_url()
    db_type = "sqlite" if "sqlite" in db_url else "postgresql"
    return {"status": "ok", "app": settings.APP_NAME, "db": db_type}


from app.api import tryon, styles, analytics, operations, chat  # noqa: E402
from app.models import chat as _chat_models  # noqa: E402 — ensure tables created

app.include_router(tryon.router, prefix="/api/tryon", tags=["AI试戴"])
app.include_router(styles.router, prefix="/api/styles", tags=["款式管理"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["数据分析"])
app.include_router(operations.router, prefix="/api/operations", tags=["智能运营"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI对话"])
