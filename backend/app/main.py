"""
NailVista 主应用入口
FastAPI + CORS + 静态文件 + 路由注册
"""
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.core.logger import setup_logging, get_logger

# 日志初始化
setup_logging(level=10 if settings.DEBUG else 20)
logger = get_logger("nailvista")

# 确保项目根路径在 sys.path
ROOT = Path(__file__).parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库"""
    logger.info(f"[{settings.APP_NAME}] 正在启动...")
    try:
        await init_db()
        logger.info("数据库表初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
    yield
    logger.info(f"[{settings.APP_NAME}] 正在关闭...")


app = FastAPI(
    title="NailVista API",
    description="美甲AI虚拟试戴与社区平台",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# 静态文件挂载
static_dir = settings.static_path
static_dir.mkdir(parents=True, exist_ok=True)
for sub in ["styles", "merchants", "posts", "avatars", "hands", "results"]:
    (static_dir / sub).mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# ============================================================
# 路由注册
# ============================================================
from app.api import auth, styles, posts, merchants, appointments
from app.api import chat, tryon_api, favorites, search, dashboard, admin, image_api

app.include_router(auth.router, prefix=settings.API_PREFIX, tags=["认证"])
app.include_router(styles.router, prefix=settings.API_PREFIX, tags=["美甲款式"])
app.include_router(posts.router, prefix=settings.API_PREFIX, tags=["帖子社区"])
app.include_router(merchants.router, prefix=settings.API_PREFIX, tags=["商家"])
app.include_router(appointments.router, prefix=settings.API_PREFIX, tags=["预约"])
app.include_router(chat.router, prefix=settings.API_PREFIX, tags=["AI对话"])
app.include_router(tryon_api.router, prefix=settings.API_PREFIX, tags=["AI试戴"])
app.include_router(favorites.router, prefix=settings.API_PREFIX, tags=["收藏"])
app.include_router(search.router, prefix=settings.API_PREFIX, tags=["搜索"])
app.include_router(dashboard.router, prefix=settings.API_PREFIX, tags=["商家仪表盘"])
app.include_router(admin.router, prefix=settings.API_PREFIX, tags=["管理员"])
app.include_router(image_api.router, prefix=settings.API_PREFIX, tags=["图片服务"])


@app.get(f"{settings.API_PREFIX}/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8190, reload=settings.DEBUG)
