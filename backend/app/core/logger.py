"""
统一日志配置 — 彩色终端输出 + API调用自动日志
"""
import logging
import sys
import time
from functools import wraps
from typing import Callable

COLORS = {
    "DEBUG": "\033[36m",
    "INFO": "\033[32m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[1;31m",
}


class ColoredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        color = COLORS.get(record.levelname, "")
        reset = "\033[0m"
        record.levelname = f"{color}[{record.levelname}]{reset}"
        return super().format(record)


def setup_logging(level: int = logging.DEBUG):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColoredFormatter("%(asctime)s %(levelname)s %(name)s | %(message)s", "%H:%M:%S"))

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    for lib in ("httpx", "httpcore", "sqlalchemy", "aiomysql", "uvicorn"):
        logging.getLogger(lib).setLevel(logging.WARNING)


def log_api(func: Callable) -> Callable:
    """装饰器：自动记录API调用的入参、耗时和返回"""
    logger = logging.getLogger("api")

    @wraps(func)
    async def wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        name = func.__name__
        try:
            result = await func(*args, **kwargs)
            dt = (time.perf_counter() - t0) * 1000
            logger.info(f"[{name}] OK | {dt:.1f}ms")
            return result
        except Exception as e:
            dt = (time.perf_counter() - t0) * 1000
            logger.error(f"[{name}] FAIL | {dt:.1f}ms | {e}")
            raise

    return wrapper


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
