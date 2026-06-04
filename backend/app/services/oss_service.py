"""
阿里云 OSS 对象存储服务 — 统一图片上传/下载/URL生成

使用方式:
    from app.services.oss_service import upload_file, get_public_url, download_to_local

所有图片统一存储到 OSS，数据库仅存 OSS key（如 styles/style_01.png）。
前端通过 IMAGE_BASE_URL + key 直接访问。
"""
import io
import os
import uuid
import logging
from pathlib import Path
from typing import Optional

import oss2
from app.core.config import settings

logger = logging.getLogger("oss")


def _get_bucket():
    return oss2.Bucket(
        oss2.Auth(settings.OSS_ACCESS_KEY_ID, settings.OSS_ACCESS_KEY_SECRET),
        settings.OSS_ENDPOINT,
        settings.OSS_BUCKET,
    )


def upload_bytes(data: bytes, oss_key: str, content_type: str = "image/png") -> str:
    """
    上传字节数据到 OSS，返回公开访问 URL
    
    Args:
        data: 图片字节数据
        oss_key: OSS 对象 key，如 styles/style_01.png
        content_type: MIME 类型
    
    Returns:
        完整的 OSS 公开访问 URL
    """
    bucket = _get_bucket()
    bucket.put_object(oss_key, io.BytesIO(data), headers={"Content-Type": content_type})
    url = get_public_url(oss_key)
    logger.info(f"OSS upload: {oss_key} -> {url}")
    return url


def upload_file(local_path: str, oss_key: str) -> str:
    """
    上传本地文件到 OSS
    
    Args:
        local_path: 本地文件路径
        oss_key: OSS 对象 key
    """
    with open(local_path, "rb") as f:
        ext = os.path.splitext(local_path)[1].lower()
        mime = "image/png" if ext in (".png",) else "image/jpeg"
        return upload_bytes(f.read(), oss_key, mime)


def get_public_url(oss_key: str) -> str:
    """获取 OSS 对象的公开访问 URL"""
    return f"https://{settings.OSS_BUCKET}.{settings.OSS_ENDPOINT}/{oss_key}"


def download_to_local(oss_key: str, local_path: str) -> bool:
    """
    从 OSS 下载文件到本地（用于 AI 试戴等需要本地文件的场景）
    
    Returns:
        True 成功 / False 失败
    """
    try:
        bucket = _get_bucket()
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        bucket.get_object_to_file(oss_key, local_path)
        return True
    except Exception as e:
        logger.error(f"OSS download failed: {oss_key} -> {local_path}: {e}")
        return False


def generate_oss_key(category: str, filename: Optional[str] = None, ext: str = ".png") -> str:
    """
    生成唯一 OSS key
    
    Args:
        category: 分类目录，如 styles/hands/posts/avatars/results/merchants
        filename: 原始文件名（可选，用于保留扩展名）
        ext: 默认扩展名
    """
    if filename:
        ext = os.path.splitext(filename)[1] or ext
    return f"{category}/{uuid.uuid4().hex}{ext}"
