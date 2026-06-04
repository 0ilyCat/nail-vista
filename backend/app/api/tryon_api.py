"""
AI 美甲试戴 API — 图片存储于阿里云 OSS，试戴使用百炼图生模型
"""
import uuid
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, NailStyle, HandImage, TryonEffect
from app.api.auth import get_current_user
from app.services.oss_service import upload_bytes, download_to_local, generate_oss_key, get_public_url

router = APIRouter()
logger = get_logger("tryon")


class TryOnRequest(BaseModel):
    """试戴请求体"""
    hand_image_id: int
    style_id: int


def _full_url(key: str) -> str:
    """将 OSS key 转为完整访问 URL"""
    if not key:
        return ""
    if key.startswith("http"):
        return key
    return f"{settings.IMAGE_BASE_URL}/{key}"


@router.get("/tryon/hand-images")
async def list_hand_images(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /tryon/hand-images user={user.id}")
    r = await db.execute(
        select(HandImage).where(
            (HandImage.user_id == user.id) | (HandImage.is_preset == True)
        ).order_by(desc(HandImage.created_at))
    )
    images = r.scalars().all()
    return [{
        "id": img.id, "user_id": img.user_id,
        "image_url": _full_url(img.image_url),
        "skin_tone": img.skin_tone or "", "hand_type": img.hand_type or "",
        "is_preset": img.is_preset, "created_at": str(img.created_at),
    } for img in images]


@router.post("/tryon/upload-hand")
async def upload_hand(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"POST /tryon/upload-hand filename={file.filename} user={user.id}")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    ext = Path(file.filename).suffix if file.filename else ".png"
    mime = file.content_type or "image/png"

    # 上传到 OSS
    oss_key = generate_oss_key("hands", file.filename, ext)
    data = await file.read()
    upload_bytes(data, oss_key, mime)

    # 数据库存 OSS key
    img = HandImage(
        user_id=user.id, image_url=oss_key,
        skin_tone="", hand_type="", is_preset=False,
    )
    db.add(img)
    await db.flush()
    await db.refresh(img)

    return {
        "id": img.id, "user_id": img.user_id,
        "image_url": _full_url(oss_key),
        "skin_tone": "", "hand_type": "", "is_preset": False,
        "created_at": str(img.created_at),
    }


@router.post("/tryon/try-on")
async def do_tryon(
    req: TryOnRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI试戴 — 仅使用百炼 qwen-image 图生模型，图片从 OSS 下载后送 API"""
    hand_image_id = req.hand_image_id
    style_id = req.style_id
    logger.info(f"POST /tryon/try-on hand={hand_image_id} style={style_id} user={user.id}")

    hand = await db.get(HandImage, hand_image_id)
    if not hand:
        raise HTTPException(status_code=404, detail="手图不存在")
    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")

    # 缓存检查：按 hand_id + style_id 组合
    cache_key = f"results/hand_{hand_image_id}_style_{style_id}.png"
    cache_url = _full_url(cache_key)

    # 简单 HEAD 检查缓存是否存在（OSS 公开读）
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.head(cache_url)
            if r.status_code == 200:
                logger.info(f"Cache hit: {cache_key}")
                effect = TryonEffect(user_id=user.id, hand_image_id=hand_image_id, style_id=style_id, result_url=cache_key)
                db.add(effect)
                style.tryon_count = (style.tryon_count or 0) + 1
                await db.flush()
                return {"status": "completed", "result_url": cache_url, "style_name": style.name, "source": "cache"}
    except Exception:
        pass  # HEAD 失败继续生成

    # 调用百炼 API — 需要本地文件
    api_key = settings.DASHSCOPE_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="DASHSCOPE_API_KEY 未配置，无法使用AI试戴")

    with tempfile.TemporaryDirectory() as tmpdir:
        hand_local = str(Path(tmpdir) / "hand.png")
        style_local = str(Path(tmpdir) / "style.png")
        result_local = str(Path(tmpdir) / "result.png")

        # 从 OSS 下载到本地临时文件
        if not download_to_local(hand.image_url, hand_local):
            raise HTTPException(status_code=500, detail="手图下载失败")
        if not download_to_local(style.image_url, style_local):
            raise HTTPException(status_code=500, detail="款式图片下载失败")

        # 调用百炼生成
        from app.services.bailian_service import generate_tryon_image
        success, msg = await generate_tryon_image(hand_local, style_local, result_local, api_key)

        if not success:
            logger.error(f"Bailian failed: {msg}")
            raise HTTPException(status_code=500, detail=f"AI试戴生成失败: {msg}")

        # 上传结果到 OSS
        with open(result_local, "rb") as f:
            upload_bytes(f.read(), cache_key, "image/png")

    # 保存记录
    effect = TryonEffect(user_id=user.id, hand_image_id=hand_image_id, style_id=style_id, result_url=cache_key)
    db.add(effect)
    style.tryon_count = (style.tryon_count or 0) + 1
    await db.flush()

    return {"status": "completed", "result_url": cache_url, "style_name": style.name, "source": "bailian"}


@router.get("/tryon/history")
async def tryon_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /tryon/history user={user.id} page={page}")

    q = select(TryonEffect).options(
        selectinload(TryonEffect.style), selectinload(TryonEffect.hand_image)
    ).where(TryonEffect.user_id == user.id).order_by(desc(TryonEffect.created_at))

    from math import ceil
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    result = await db.execute(q)
    effects = result.scalars().all()

    items = []
    for e in effects:
        items.append({
            "id": e.id, "user_id": e.user_id,
            "hand_image_id": e.hand_image_id,
            "hand_image_url": _full_url(e.hand_image.image_url) if e.hand_image else "",
            "style_id": e.style_id,
            "style_name": e.style.name if e.style else "",
            "result_url": _full_url(e.result_url) if e.result_url else "",
            "created_at": str(e.created_at),
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": ceil(total / page_size) if total > 0 else 0}
