"""
AI 美甲试戴 API — 本地图片存储，试戴使用百炼 qwen-image-2.0-pro-2026-04-22 图生模型
"""
import uuid
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, delete, update
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, NailStyle, HandImage, TryonEffect
from app.api.auth import get_current_user
from app.services.local_image_service import save_image, save_image_with_name, get_image_url, get_local_path

router = APIRouter()
logger = get_logger("tryon")


class TryOnRequest(BaseModel):
    """试戴请求体"""
    hand_image_id: int
    style_id: int
    force_regenerate: bool = False


def _full_url(path: str) -> str:
    """将本地存储路径转为前端访问 URL"""
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return get_image_url(path)


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

    data = await file.read()
    image_path = save_image(data, "hands", file.filename)

    img = HandImage(
        user_id=user.id, image_url=image_path,
        skin_tone="", hand_type="", is_preset=False,
    )
    db.add(img)
    await db.flush()
    await db.refresh(img)

    return {
        "id": img.id, "user_id": img.user_id,
        "image_url": _full_url(image_path),
        "skin_tone": "", "hand_type": "", "is_preset": False,
        "created_at": str(img.created_at),
    }


@router.post("/tryon/try-on")
async def do_tryon(
    req: TryOnRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI试戴 — 使用百炼 qwen-image-2.0-pro-2026-04-22 图生模型"""
    hand_image_id = req.hand_image_id
    style_id = req.style_id
    force_regenerate = req.force_regenerate
    logger.info(f"[试戴] 收到请求 手图ID={hand_image_id} 款式ID={style_id} 用户ID={user.id} 强制重新生成={force_regenerate}")

    hand = await db.get(HandImage, hand_image_id)
    if not hand:
        raise HTTPException(status_code=404, detail="手图不存在")
    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")

    logger.info(f"[试戴] 手图={hand.image_url} 款式={style.name}")

    # 缓存检查
    cache_path = f"results/hand_{hand_image_id}_style_{style_id}.png"
    cache_local = get_local_path(cache_path)
    cache_url = _full_url(cache_path)

    if not force_regenerate and cache_local.exists():
        logger.info(f"[试戴] 缓存命中 路径={cache_path}")
        existing = await db.execute(
            select(TryonEffect).where(
                TryonEffect.user_id == user.id,
                TryonEffect.hand_image_id == hand_image_id,
                TryonEffect.style_id == style_id,
            )
        )
        existing_effect = existing.scalars().first()
        if not existing_effect:
            effect = TryonEffect(user_id=user.id, hand_image_id=hand_image_id, style_id=style_id, result_url=cache_path)
            db.add(effect)
            style.tryon_count = (style.tryon_count or 0) + 1
            await db.flush()
        return {"status": "completed", "result_url": cache_url, "style_name": style.name, "source": "cache"}

    # 调用百炼 API
    api_key = settings.DASHSCOPE_API_KEY
    if not api_key:
        logger.error("[试戴] DASHSCOPE_API_KEY 未配置")
        raise HTTPException(status_code=503, detail="DASHSCOPE_API_KEY 未配置，无法使用AI试戴")

    hand_local = get_local_path(hand.image_url)
    style_local = get_local_path(style.image_url)

    if not hand_local.exists():
        raise HTTPException(status_code=500, detail=f"手图文件丢失: {hand.image_url}")
    if not style_local.exists():
        raise HTTPException(status_code=500, detail=f"款式图片丢失: {style.image_url}")

    with tempfile.TemporaryDirectory() as tmpdir:
        result_local = str(Path(tmpdir) / "result.png")

        from app.services.bailian_service import generate_tryon_image
        success, msg = await generate_tryon_image(str(hand_local), str(style_local), result_local, api_key)

        if not success:
            logger.error(f"[试戴] 百炼生成失败 原因={msg}")
            raise HTTPException(status_code=500, detail=f"AI试戴生成失败: {msg}")

        with open(result_local, "rb") as f:
            save_image_with_name(f.read(), cache_path)

    # 保存/更新数据库记录
    existing = await db.execute(
        select(TryonEffect).where(
            TryonEffect.user_id == user.id,
            TryonEffect.hand_image_id == hand_image_id,
            TryonEffect.style_id == style_id,
        )
    )
    existing_effect = existing.scalars().first()
    if existing_effect:
        existing_effect.result_url = cache_path
        await db.flush()
    else:
        effect = TryonEffect(user_id=user.id, hand_image_id=hand_image_id, style_id=style_id, result_url=cache_path)
        db.add(effect)
        style.tryon_count = (style.tryon_count or 0) + 1
        await db.flush()

    logger.info(f"[试戴] 生成成功 结果路径={cache_url}")
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
            "merchant_id": e.style.merchant_id if e.style else None,
            "result_url": _full_url(e.result_url) if e.result_url else "",
            "created_at": str(e.created_at),
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": ceil(total / page_size) if total > 0 else 0}


@router.delete("/tryon/hand-images/{hand_image_id}")
async def delete_hand_image(
    hand_image_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除手图（预设和用户上传均支持），不删除关联试戴记录"""
    logger.info(f"DELETE /tryon/hand-images/{hand_image_id} user={user.id}")

    hand = await db.get(HandImage, hand_image_id)
    if not hand:
        raise HTTPException(status_code=404, detail="手图不存在")
    # 预设手图：所有用户均可删除；用户手图：仅本人可删
    if not hand.is_preset and hand.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权删除该手图")

    # 不级联删除试戴历史，仅解除关联（hand_image_id 置空）
    await db.execute(
        update(TryonEffect).where(TryonEffect.hand_image_id == hand_image_id).values(hand_image_id=None)
    )

    await db.delete(hand)
    await db.commit()
    logger.info(f"手图已删除 id={hand_image_id}")
    return {"message": "删除成功"}


@router.delete("/tryon/history/{effect_id}")
async def delete_history_record(
    effect_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除单条试戴历史记录"""
    logger.info(f"DELETE /tryon/history/{effect_id} user={user.id}")

    effect = await db.get(TryonEffect, effect_id)
    if not effect:
        raise HTTPException(status_code=404, detail="试戴记录不存在")
    if effect.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权删除该记录")

    await db.delete(effect)
    await db.commit()
    logger.info(f"试戴记录已删除 id={effect_id}")
    return {"message": "删除成功"}
