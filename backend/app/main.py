from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings, Settings
from app.core.database import init_db

settings: Settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown


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


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


# Import and register routers
from app.api import tryon, styles, analytics, operations  # noqa: E402

app.include_router(tryon.router, prefix="/api/tryon", tags=["AI试戴"])
app.include_router(styles.router, prefix="/api/styles", tags=["款式管理"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["数据分析"])
app.include_router(operations.router, prefix="/api/operations", tags=["智能运营"])
