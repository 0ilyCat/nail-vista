"""
本地图片访问 API — GET /api/getImg?name=xxx 流式返回二进制
"""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pathlib import Path

from app.core.logger import get_logger
from app.services.local_image_service import get_local_path, get_content_type

router = APIRouter()
logger = get_logger("image_api")


@router.get("/getImg")
async def get_image(name: str = Query(..., description="相对路径，如 styles/style_01.png")):
    """
    通过接口返回本地图片文件流。
    前端用法: <img src="/api/getImg?name=styles/style_01.png">
    """
    # 防目录穿越攻击
    safe_path = Path(name).as_posix()
    if ".." in safe_path or safe_path.startswith("/"):
        raise HTTPException(status_code=400, detail="非法的图片路径")

    local_path = get_local_path(safe_path)
    if not local_path.exists() or not local_path.is_file():
        logger.warning(f"图片不存在: {safe_path}")
        raise HTTPException(status_code=404, detail="图片不存在")

    content_type = get_content_type(local_path)

    def file_iterator():
        with open(local_path, "rb") as f:
            while chunk := f.read(65536):  # 64KB chunks
                yield chunk

    return StreamingResponse(
        file_iterator(),
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )
