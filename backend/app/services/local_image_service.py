"""
本地图片存储服务 — 替代 OSS，图片存 backend/static/，通过 /api/getImg 接口返回

正确使用方式:
    <img src="/api/getImg?name=styles/xxx.png">  ← 走接口拿二进制流
错误使用方式:
    <img src="/usr/upload/a.jpg">  ← 浏览器不能直接访问服务器磁盘地址
"""

import os
import uuid
import mimetypes
from pathlib import Path
from typing import Optional

from app.core.config import settings

STATIC_ROOT = settings.static_path


def save_image(data: bytes, subdir: str, filename_hint: Optional[str] = None) -> str:
    """
    保存用户上传的图片，使用 UUID 重命名（如 styles/a1b2c3d4e5.png）
    """
    ext = ".png"
    if filename_hint:
        ext = os.path.splitext(filename_hint)[1] or ".png"
        ext = ext.lower()
        if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            ext = ".png"

    target_dir = STATIC_ROOT / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = target_dir / filename
    filepath.write_bytes(data)

    return f"{subdir}/{filename}"


def save_image_with_name(data: bytes, relative_path: str) -> str:
    """
    保存图片到指定路径（使用固定文件名，用于缓存/初始数据，不使用 UUID）
    
    Args:
        data: 图片字节
        relative_path: 相对于 static/ 的完整路径，如 results/hand_1_style_44.png
    Returns:
        相对路径字符串
    """
    filepath = STATIC_ROOT / relative_path
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_bytes(data)
    return relative_path


def get_local_path(relative_path: str) -> Path:
    """将相对路径转换为本地文件系统绝对路径"""
    return STATIC_ROOT / relative_path


def get_image_url(relative_path: str) -> str:
    """
    返回 API 访问 URL，前端通过此 URL 获取图片二进制
    
    例如: styles/style_01.png → /api/getImg?name=styles/style_01.png
    """
    if not relative_path:
        return ""
    if relative_path.startswith("http"):
        return relative_path
    return f"{settings.API_PREFIX}/getImg?name={relative_path}"


def get_content_type(filepath: Path) -> str:
    """根据文件扩展名返回 MIME 类型"""
    ext = filepath.suffix.lower()
    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    return mime_map.get(ext, "application/octet-stream")
