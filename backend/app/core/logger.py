"""
统一日志配置 — 所有 API 调用、参数、返回、异常均会记录
"""
import logging
import sys
import time
import json
import traceback
from typing import Callable
from functools import wraps

# ── 格式化器 ──
LOG_FORMAT = "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
DATE_FORMAT = "%m-%d %H:%M:%S"

class ColorFormatter(logging.Formatter):
    COLORS = {
        logging.DEBUG: "\033[36m",    # Cyan
        logging.INFO: "\033[32m",     # Green
        logging.WARNING: "\033[33m",  # Yellow
        logging.ERROR: "\033[31m",    # Red
        logging.CRITICAL: "\033[1;31m" # Bold Red
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelno, "")
        # Pad length while avoiding len() counting ANSI codes
        levelname = record.levelname
        padded_level = f"{levelname:<5}"
        record.levelname = f"{color}{padded_level}{self.RESET}"
        return super().format(record)


def setup_logging(level: int = logging.DEBUG):
    """初始化全局日志配置"""
    root = logging.getLogger()
    root.setLevel(level)

    # 清除已有 handler，避免重复
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    handler.setFormatter(ColorFormatter(LOG_FORMAT, DATE_FORMAT))
    root.addHandler(handler)

    # 降低第三方库日志级别
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


# ── 请求日志装饰器（同步） ──
def log_api(func: Callable):
    """装饰器：自动记录 FastAPI 端点——入参、耗时、返回状态、异常"""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        logger = logging.getLogger(func.__module__)
        func_name = func.__name__

        # 提取参数（跳过 db session / request 等内部对象）
        args_repr = _safe_args(kwargs)
        logger.info(f"[REQ] {func_name} | params={args_repr}")

        t0 = time.time()
        try:
            result = await func(*args, **kwargs)
            elapsed = (time.time() - t0) * 1000
            # 截断过长返回
            result_preview = _safe_truncate(result)
            logger.info(f"[OK]  {func_name} | {elapsed:.0f}ms | result={result_preview}")
            return result
        except Exception as e:
            elapsed = (time.time() - t0) * 1000
            logger.error(f"[ERR] {func_name} | {elapsed:.0f}ms | {type(e).__name__}: {e}")
            logger.error(traceback.format_exc())
            raise

    return wrapper


# ── 辅助 ──
def _safe_args(kwargs: dict) -> str:
    safe = {}
    for k, v in kwargs.items():
        if k in ("db", "request", "background_tasks"):
            continue
        if hasattr(v, "__class__") and v.__class__.__name__ in ("AsyncSession", "Session"):
            continue
        safe[k] = str(v)[:200]
    return json.dumps(safe, ensure_ascii=False)


def _safe_truncate(result, max_len=300) -> str:
    if result is None:
        return "null"
    if isinstance(result, dict):
        s = json.dumps(result, ensure_ascii=False)
        return s[:max_len] + ("..." if len(s) > max_len else "")
    if isinstance(result, (list, str)):
        s = str(result)
        return s[:max_len] + ("..." if len(s) > max_len else "")
    return str(result)[:max_len]
