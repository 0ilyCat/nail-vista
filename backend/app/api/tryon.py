from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pathlib import Path
import time
import uuid
import shutil
import threading

from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import HandImage, NailStyle, TryonRecord, StyleMetrics
from app.services.tryon_engine import tryon_engine
from app.services.bailian_service import generate_tryon_image, find_cached_result
from datetime import datetime

router = APIRouter()
settings = get_settings()

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
HANDS_DIR = Path(settings.STATIC_DIR) / "hands"
STYLES_DIR = Path(settings.STATIC_DIR) / "styles"
RESULTS_DIR = Path(settings.STATIC_DIR) / "results"
for d in [UPLOAD_DIR, HANDS_DIR, STYLES_DIR, RESULTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# 用户上传计数器（避免和预设hand_01~13冲突）
_COUNTER_FILE = UPLOAD_DIR / ".upload_counter"


def _next_user_hand_name() -> str:
    """分配下一个用户手图名: user_0001, user_0002 ..."""
    if _COUNTER_FILE.exists():
        n = int(_COUNTER_FILE.read_text().strip())
    else:
        # 扫描已有user_文件确定起点
        existing = list(UPLOAD_DIR.glob("user_*.*"))
        nums = []
        for f in existing:
            try:
                nums.append(int(f.stem.split("_")[1]))
            except (ValueError, IndexError):
                pass
        n = max(nums) if nums else 0
    n += 1
    _COUNTER_FILE.write_text(str(n))
    return f"user_{n:04d}"


def _list_all_hands() -> list[dict]:
    """返回所有手图：用户上传的在前，预设的在后"""
    hands = []

    # 用户上传的手图 (从 uploads/ 目录)
    user_files = sorted(UPLOAD_DIR.glob("user_*.*"), key=lambda f: f.stat().st_mtime, reverse=True)
    for f in user_files:
        hands.append({
            "id": f.stem,
            "name": f"我的上传 #{f.stem.split('_')[1]}",
            "url": f"/uploads/{f.name}",
            "path": str(f),
            "type": "user",
        })

    # 预设手图
    preset_files = sorted(HANDS_DIR.glob("hand_*.*"))
    for f in preset_files:
        hands.append({
            "id": f.stem,
            "name": f.stem.replace("_", " ").title(),
            "url": f"/static/hands/{f.name}",
            "path": str(f),
            "type": "preset",
        })

    return hands


def _generate_async(hand_path: str, hand_name: str, style_id: int, style_path: str):
    """后台线程：为指定手图+款式组合预生成所有缺失的试戴图"""
    result_name = f"{hand_name}+style_{style_id:02d}.png"
    result_path = str(RESULTS_DIR / result_name)
    if not Path(result_path).exists():
        generate_tryon_image(hand_path, style_path, result_path)


@router.get("/hand-images")
async def list_hand_images():
    """获取所有可用手图（上传记录在前，预设在后）"""
    hands = _list_all_hands()
    return {"hands": hands, "total": len(hands)}


@router.post("/upload-hand")
async def upload_hand(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """上传手部照片，自动重命名，加入历史记录"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "仅支持图片文件")

    ext = Path(file.filename).suffix or ".png"
    hand_name = _next_user_hand_name()  # user_0001, user_0002 ...
    filename = f"{hand_name}{ext}"

    # 保存到 uploads/
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    filepath.write_bytes(content)

    # 同时复制到 static/hands/ 以便批量脚本也能使用
    hands_copy = HANDS_DIR / filename
    shutil.copy2(str(filepath), str(hands_copy))

    hand = HandImage(
        image_url=f"/uploads/{filename}",
        local_path=str(filepath),
        skin_tone="auto",
        hand_type="auto",
    )
    db.add(hand)
    await db.commit()
    await db.refresh(hand)

    return {
        "hand_id": hand_name,
        "image_url": f"/uploads/{filename}",
        "db_id": hand.id,
        "message": "上传成功",
    }


@router.post("/try-on")
async def try_on(
    hand_id: str = Form(""),
    hand_image_id: int = Form(None),
    style_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """执行AI试戴 — 缓存优先，无缓存时调用百炼实时生成"""
    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(404, "款式不存在")

    # 解析 hand_name
    hand_name = hand_id
    if hand_image_id is not None:
        h = await db.get(HandImage, hand_image_id)
        hand_name = Path(h.local_path).stem if h and h.local_path else f"upload_{hand_image_id}"
    if not hand_name:
        raise HTTPException(400, "请提供 hand_id")

    t0 = time.time()
    style_name = f"style_{style_id:02d}"
    result_name = f"{hand_name}+{style_name}.png"
    result_path = RESULTS_DIR / result_name
    source = ""

    # ===== 1. 查找缓存 =====
    if result_path.exists() and result_path.stat().st_size > 1000:
        result_url = f"/static/results/{result_name}"
        source = "bailian-cached"
    else:
        # ===== 2. 实时生成 =====
        # 定位手图文件
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

        # 先试百炼
        success, msg = False, ""
        if style_path:
            success, msg = generate_tryon_image(hand_path, str(style_path), str(result_path))

        if success:
            result_url = f"/static/results/{result_name}"
            source = "bailian-live"
        else:
            # fallback: MediaPipe + OpenCV
            try:
                hand_bytes = Path(hand_path).read_bytes()
                style_bytes = style_path.read_bytes() if style_path else _gen_placeholder(style.color_tone)
                result_bytes = tryon_engine.process_tryon(hand_bytes, style_bytes)
                fallback_name = f"tryon_{uuid.uuid4().hex}.png"
                (Path(settings.RESULT_DIR) / fallback_name).write_bytes(result_bytes)
                result_url = f"/results/{fallback_name}"
                source = "opencv"
            except Exception as e:
                raise HTTPException(500, f"试戴处理失败: {e}")

    duration_ms = int((time.time() - t0) * 1000)

    # 记录
    hand_db_id = None
    if hand_image_id:
        hand_db_id = hand_image_id
    elif hand_name.startswith("user_"):
        stmt = select(HandImage).where(HandImage.local_path.contains(hand_name)).order_by(desc(HandImage.id))
        r = await db.execute(stmt)
        h = r.scalar_one_or_none()
        hand_db_id = h.id if h else None

    record = TryonRecord(hand_image_id=hand_db_id, nail_style_id=style_id, result_url=result_url, duration_ms=duration_ms)
    db.add(record)

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    stmt = select(StyleMetrics).where(StyleMetrics.style_id == style_id, StyleMetrics.date == today)
    r = await db.execute(stmt)
    metric = r.scalar_one_or_none()
    if metric:
        metric.tryons += 1
    else:
        db.add(StyleMetrics(style_id=style_id, date=today, tryons=1))
    await db.commit()

    return {
        "result_url": result_url,
        "duration_ms": duration_ms,
        "style_name": style.name,
        "source": source,
    }


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
            "id": r.id, "style_id": r.nail_style_id,
            "style_name": style.name if style else "",
            "result_url": r.result_url, "duration_ms": r.duration_ms,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return {"items": items, "total": total}


def _gen_placeholder(color: str) -> bytes:
    from PIL import Image
    import io
    img = Image.new("RGBA", (100, 60), color)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()
