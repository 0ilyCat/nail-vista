from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pathlib import Path
import time
import uuid

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import HandImage, NailStyle, TryonRecord
from app.services.tryon_engine import tryon_engine

router = APIRouter()
settings = get_settings()


@router.post("/upload-hand")
async def upload_hand(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """上传手部照片，存入数据库"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "仅支持图片文件")

    ext = Path(file.filename).suffix or ".png"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = Path(settings.UPLOAD_DIR) / filename

    content = await file.read()
    filepath.write_bytes(content)

    hand = HandImage(
        image_url=f"/uploads/{filename}",
        local_path=str(filepath),
        skin_tone="auto",
        hand_type="auto",
    )
    db.add(hand)
    await db.commit()
    await db.refresh(hand)

    return {"id": hand.id, "image_url": hand.image_url, "message": "上传成功"}


@router.post("/try-on")
async def try_on(
    hand_image_id: int = Form(...),
    style_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """执行AI试戴，生成合成图"""
    hand = await db.get(HandImage, hand_image_id)
    if not hand or not hand.local_path:
        raise HTTPException(404, "手图不存在")
    if not Path(hand.local_path).exists():
        raise HTTPException(404, "手图文件丢失")

    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(404, "款式不存在")

    t0 = time.time()

    # 读取本地文件；款式用增强图或原始图
    hand_bytes = Path(hand.local_path).read_bytes()

    # 款式图：优先用增强图URL，需要本地缓存
    style_path = _find_cached_style(style)
    if style_path:
        style_bytes = Path(style_path).read_bytes()
    else:
        # 生成纯色占位图作为 fallback
        style_bytes = _generate_placeholder(style.color_tone or "#ff69b4")

    try:
        result_bytes = tryon_engine.process_tryon(hand_bytes, style_bytes)
    except Exception as e:
        raise HTTPException(500, f"试戴处理失败: {e}")

    duration_ms = int((time.time() - t0) * 1000)

    result_filename = f"tryon_{uuid.uuid4().hex}.png"
    result_path = Path(settings.RESULT_DIR) / result_filename
    result_path.write_bytes(result_bytes)

    record = TryonRecord(
        hand_image_id=hand_image_id,
        nail_style_id=style_id,
        result_url=f"/results/{result_filename}",
        duration_ms=duration_ms,
    )
    db.add(record)

    # 更新指标
    from app.models.models import StyleMetrics
    from datetime import datetime, timedelta

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    stmt = select(StyleMetrics).where(
        StyleMetrics.style_id == style_id,
        StyleMetrics.date == today,
    )
    result = await db.execute(stmt)
    metric = result.scalar_one_or_none()
    if metric:
        metric.tryons += 1
    else:
        db.add(StyleMetrics(style_id=style_id, date=today, tryons=1))

    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "result_url": record.result_url,
        "duration_ms": duration_ms,
        "style_name": style.name,
    }


@router.get("/history")
async def tryon_history(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """试戴历史记录"""
    stmt = (
        select(TryonRecord)
        .order_by(desc(TryonRecord.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    count_stmt = select(func.count(TryonRecord.id))
    total = (await db.execute(count_stmt)).scalar()

    items = []
    for r in records:
        style = await db.get(NailStyle, r.nail_style_id)
        items.append({
            "id": r.id,
            "style_id": r.nail_style_id,
            "style_name": style.name if style else "未知",
            "result_url": r.result_url,
            "duration_ms": r.duration_ms,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return {"items": items, "total": total, "limit": limit, "offset": offset}


def _find_cached_style(style: NailStyle) -> str | None:
    """查找本地缓存的款式图"""
    cache_dir = Path(settings.STATIC_DIR) / "styles"
    for url in [style.enhanced_url, style.original_url]:
        if not url:
            continue
        fname = Path(url).name
        path = cache_dir / fname
        if path.exists():
            return str(path)
    return None


def _generate_placeholder(color: str) -> bytes:
    """生成纯色占位图 (100x60 指甲图)"""
    from PIL import Image
    img = Image.new("RGBA", (100, 60), color)
    import io
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
