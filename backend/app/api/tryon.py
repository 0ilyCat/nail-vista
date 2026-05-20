from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pathlib import Path
import time
import uuid
import shutil

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import HandImage, NailStyle, TryonRecord, StyleMetrics
from app.services.tryon_engine import tryon_engine
from app.services.bailian_service import generate_tryon_image
from datetime import datetime

router = APIRouter()
settings = get_settings()

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
HANDS_DIR = Path(settings.STATIC_DIR) / "hands"
STYLES_DIR = Path(settings.STATIC_DIR) / "styles"
RESULTS_DIR = Path(settings.RESULT_DIR)       # results/ — 已由 main.py mount 到 /results
GEN_RESULTS_DIR = Path(settings.STATIC_DIR) / "results"

for d in [UPLOAD_DIR, HANDS_DIR, STYLES_DIR, RESULTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

_COUNTER_FILE = UPLOAD_DIR / ".upload_counter"


def _next_user_hand_name() -> str:
    if _COUNTER_FILE.exists():
        n = int(_COUNTER_FILE.read_text().strip())
    else:
        existing = list(UPLOAD_DIR.glob("user_*.*"))
        nums = [int(f.stem.split("_")[1]) for f in existing if f.stem.split("_")[1].isdigit()]
        n = max(nums) if nums else 0
    n += 1
    _COUNTER_FILE.write_text(str(n))
    return f"user_{n:04d}"


def _list_all_hands() -> list[dict]:
    """统一历史上传列表：用户上传 + 预设手图，按时间倒序"""
    entries = []

    # 用户上传
    user_files = sorted(UPLOAD_DIR.glob("user_*.*"), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in user_files:
        t = datetime.fromtimestamp(f.stat().st_mtime)
        entries.append({
            "id": f.stem, "name": f"上传 {t.strftime('%m-%d %H:%M')}",
            "url": f"/uploads/{f.name}", "path": str(f), "type": "user",
            "time": t.isoformat(),
        })

    # 预设手图（标记较旧的时间，排在后面）
    preset_files = sorted(HANDS_DIR.glob("hand_*.*"))
    for f in preset_files:
        entries.append({
            "id": f.stem, "name": f.stem.replace("_", " ").title(),
            "url": f"/static/hands/{f.name}", "path": str(f), "type": "preset",
            "time": "2025-01-01T00:00:00",
        })

    entries.sort(key=lambda x: x["time"], reverse=True)
    return entries


@router.get("/hand-images")
async def list_hand_images():
    hands = _list_all_hands()
    return {"hands": hands, "total": len(hands)}


@router.post("/upload-hand")
async def upload_hand(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "仅支持图片文件")

    ext = Path(file.filename).suffix or ".png"
    hand_name = _next_user_hand_name()
    filename = f"{hand_name}{ext}"

    filepath = UPLOAD_DIR / filename
    content = await file.read()
    filepath.write_bytes(content)

    # 同时存一份到 static/hands/
    hands_copy = HANDS_DIR / filename
    shutil.copy2(str(filepath), str(hands_copy))

    hand = HandImage(image_url=f"/uploads/{filename}", local_path=str(filepath),
                     skin_tone="auto", hand_type="auto")
    db.add(hand)
    await db.commit()
    await db.refresh(hand)

    return {"hand_id": hand_name, "image_url": f"/uploads/{filename}", "db_id": hand.id, "message": "上传成功"}


@router.post("/try-on")
async def try_on(
    hand_id: str = Form(""),
    hand_image_id: int = Form(None),
    style_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(404, "款式不存在")

    hand_name = hand_id
    if hand_image_id is not None:
        h = await db.get(HandImage, hand_image_id)
        hand_name = Path(h.local_path).stem if h and h.local_path else f"upload_{hand_image_id}"
    if not hand_name:
        raise HTTPException(400, "请提供 hand_id")

    t0 = time.time()
    style_name = f"style_{style_id:02d}"
    result_filename = f"{hand_name}+{style_name}.png"
    result_path = RESULTS_DIR / result_filename
    source = ""

    # ===== 1. 缓存命中？ =====
    if result_path.exists() and result_path.stat().st_size > 1000:
        result_url = f"/results/{result_filename}"
        source = "bailian-cached"
    else:
        # ===== 2. 实时生成 =====
        hand_path = None
        for d in [UPLOAD_DIR, HANDS_DIR]:
            for ext in [".png", ".jpg", ".jpeg"]:
                p = d / f"{hand_name}{ext}"
                if p.exists():
                    hand_path = str(p)
                    break
            if hand_path:
                break
        if not hand_path:
            raise HTTPException(404, f"手图文件不存在: {hand_name}")

        style_path = STYLES_DIR / f"{style_name}.png"
        if not style_path.exists():
            style_path = None

        # 调用百炼
        success, msg = False, ""
        if style_path:
            success, msg = generate_tryon_image(hand_path, str(style_path), str(result_path))

        if success:
            result_url = f"/results/{result_filename}"
            source = "bailian-live"
        else:
            # fallback: MediaPipe + OpenCV
            try:
                hand_bytes = Path(hand_path).read_bytes()
                sbytes = style_path.read_bytes() if style_path else _gen_placeholder(style.color_tone)
                result_bytes = tryon_engine.process_tryon(hand_bytes, sbytes)
                fb_name = f"tryon_{uuid.uuid4().hex}.png"
                (RESULTS_DIR / fb_name).write_bytes(result_bytes)
                result_url = f"/results/{fb_name}"
                source = "opencv"
            except Exception as e:
                raise HTTPException(500, f"试戴处理失败: {e}")

    duration_ms = int((time.time() - t0) * 1000)

    hand_db_id = None
    if hand_image_id:
        hand_db_id = hand_image_id
    elif hand_name.startswith("user_"):
        r = await db.execute(select(HandImage).where(HandImage.local_path.contains(hand_name)).order_by(desc(HandImage.id)))
        h = r.scalar_one_or_none()
        hand_db_id = h.id if h else None

    record = TryonRecord(hand_image_id=hand_db_id, nail_style_id=style_id, result_url=result_url, duration_ms=duration_ms)
    db.add(record)

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    r = await db.execute(select(StyleMetrics).where(StyleMetrics.style_id == style_id, StyleMetrics.date == today))
    metric = r.scalar_one_or_none()
    if metric:
        metric.tryons += 1
    else:
        db.add(StyleMetrics(style_id=style_id, date=today, tryons=1))
    await db.commit()

    return {"result_url": result_url, "duration_ms": duration_ms, "style_name": style.name, "source": source}


@router.get("/history")
async def tryon_history(limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    stmt = select(TryonRecord).order_by(desc(TryonRecord.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()
    total = (await db.execute(select(func.count(TryonRecord.id)))).scalar()
    items = []
    for r in records:
        style = await db.get(NailStyle, r.nail_style_id)
        items.append({
            "id": r.id, "style_id": r.nail_style_id, "style_name": style.name if style else "",
            "result_url": r.result_url, "duration_ms": r.duration_ms,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return {"items": items, "total": total}


def _gen_placeholder(color: str) -> bytes:
    from PIL import Image; import io
    img = Image.new("RGBA", (100, 60), color)
    buf = io.BytesIO(); img.save(buf, "PNG"); return buf.getvalue()
