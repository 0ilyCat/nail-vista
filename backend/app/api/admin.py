"""
管理员/商家管理 API — 款式增删改查 + 预约管理
"""
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, Merchant, NailStyle, Post, Appointment
from app.schemas.schemas import NailStyleOut, MerchantOut, PostOut
from app.api.auth import get_current_user

router = APIRouter()
logger = get_logger("admin")

# ────────────── Pydantic 请求体 ──────────────

class StyleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: str = ""
    category: str = ""
    price: float = 0
    color_tone: str = ""
    scene: str = ""
    nail_shape: str = ""
    difficulty: str = "medium"
    original_price: float = 0

class StyleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    color_tone: Optional[str] = None
    scene: Optional[str] = None
    nail_shape: Optional[str] = None
    difficulty: Optional[str] = None
    is_active: Optional[bool] = None

class AppointmentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(confirmed|completed|cancelled)$")

# ────────────── 权限辅助 ──────────────

async def _require_merchant(user: User, db: AsyncSession) -> Merchant:
    r = await db.execute(select(Merchant).where(Merchant.user_id == user.id))
    m = r.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=403, detail="仅已入驻商家可操作，请先完成商家入驻")
    return m

def _style_out(style: NailStyle, merchant: Merchant, tags: list = None) -> dict:
    return {
        "id": style.id, "name": style.name, "description": style.description or "",
        "image_url": style.image_url or "", "category": style.category or "",
        "color_tone": style.color_tone or "", "scene": style.scene or "",
        "nail_shape": style.nail_shape or "", "difficulty": style.difficulty or "medium",
        "price": style.price or 0, "original_price": style.original_price or 0,
        "popularity": style.popularity or 0, "tryon_count": style.tryon_count or 0,
        "favorite_count": style.favorite_count or 0,
        "merchant_id": style.merchant_id, "merchant_name": merchant.name,
        "tags": tags or [], "is_active": style.is_active if style.is_active is not None else True,
        "created_at": str(style.created_at) if style.created_at else "",
    }

# ═══════════════════════════════════════════════════
# 美甲款式 CRUD（商家视角）
# ═══════════════════════════════════════════════════

@router.get("/admin/styles")
async def list_merchant_styles(
    is_active: Optional[bool] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出当前商家的所有款式"""
    logger.info(f"GET /admin/styles user={user.id} is_active={is_active}")
    merchant = await _require_merchant(user, db)

    stmt = select(NailStyle).where(NailStyle.merchant_id == merchant.id)
    if is_active is not None:
        stmt = stmt.where(NailStyle.is_active == is_active)
    stmt = stmt.order_by(desc(NailStyle.created_at))

    r = await db.execute(stmt)
    styles = r.scalars().all()

    return {"items": [_style_out(s, merchant) for s in styles], "total": len(styles)}


@router.post("/admin/styles")
async def create_style(
    body: StyleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新款式"""
    logger.info(f"POST /admin/styles name={body.name} user={user.id}")
    merchant = await _require_merchant(user, db)

    style = NailStyle(
        name=body.name, description=body.description, category=body.category,
        price=body.price, original_price=body.original_price,
        color_tone=body.color_tone, scene=body.scene,
        nail_shape=body.nail_shape, difficulty=body.difficulty,
        merchant_id=merchant.id, image_url="",
    )
    db.add(style)
    await db.flush()
    await db.refresh(style)

    logger.info(f"POST /admin/styles created id={style.id}")
    return _style_out(style, merchant)


@router.put("/admin/styles/{style_id}")
async def update_style(
    style_id: int,
    body: StyleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新款式信息"""
    logger.info(f"PUT /admin/styles/{style_id} user={user.id}")
    merchant = await _require_merchant(user, db)

    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")
    if style.merchant_id != merchant.id:
        raise HTTPException(status_code=403, detail="只能修改自己店铺的款式")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(style, field, value)

    await db.flush()
    await db.refresh(style)

    logger.info(f"PUT /admin/styles/{style_id} updated fields={list(update_data.keys())}")
    return _style_out(style, merchant)


@router.delete("/admin/styles/{style_id}")
async def delete_style(
    style_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """软删除款式"""
    logger.info(f"DELETE /admin/styles/{style_id} user={user.id}")
    merchant = await _require_merchant(user, db)

    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")
    if style.merchant_id != merchant.id:
        raise HTTPException(status_code=403, detail="只能删除自己店铺的款式")

    style.is_active = False
    await db.flush()
    logger.info(f"DELETE /admin/styles/{style_id} soft-deleted")
    return {"ok": True, "message": "款式已下架"}


@router.post("/admin/styles/upload-image")
async def upload_style_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传款式图片到 OSS"""
    logger.info(f"POST /admin/styles/upload-image file={file.filename} user={user.id}")
    await _require_merchant(user, db)

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    from app.services.oss_service import upload_bytes, generate_oss_key

    ext = Path(file.filename).suffix if file.filename else ".png"
    content = await file.read()
    oss_key = generate_oss_key("styles", file.filename, ext)
    public_url = upload_bytes(content, oss_key, file.content_type or "image/png")

    logger.info(f"POST /admin/styles/upload-image done key={oss_key}")
    return {"image_url": oss_key, "full_url": public_url, "message": "上传成功"}


@router.post("/admin/styles/{style_id}/image")
async def set_style_image(
    style_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """为已有款式设置/更换图片"""
    logger.info(f"POST /admin/styles/{style_id}/image file={file.filename} user={user.id}")
    merchant = await _require_merchant(user, db)

    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")
    if style.merchant_id != merchant.id:
        raise HTTPException(status_code=403, detail="只能修改自己店铺的款式")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    from app.services.oss_service import upload_bytes, generate_oss_key

    ext = Path(file.filename).suffix if file.filename else ".png"
    content = await file.read()
    oss_key = generate_oss_key("styles", file.filename, ext)
    upload_bytes(content, oss_key, file.content_type or "image/png")

    style.image_url = oss_key
    await db.flush()

    logger.info(f"POST /admin/styles/{style_id}/image done key={oss_key}")
    return {"image_url": oss_key, "message": "图片已更新"}


# ═══════════════════════════════════════════════════
# 预约管理（商家视角）
# ═══════════════════════════════════════════════════

@router.get("/admin/appointments")
async def list_merchant_appointments(
    status: Optional[str] = Query(None, description="pending/confirmed/completed/cancelled"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """商家查看所有预约"""
    logger.info(f"GET /admin/appointments user={user.id} status={status}")
    merchant = await _require_merchant(user, db)

    stmt = select(Appointment).where(Appointment.merchant_id == merchant.id)
    if status:
        if status not in ("pending", "confirmed", "completed", "cancelled"):
            raise HTTPException(status_code=400, detail="无效的状态值")
        stmt = stmt.where(Appointment.status == status)
    stmt = stmt.order_by(desc(Appointment.created_at))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    from math import ceil
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    r = await db.execute(stmt)
    appointments = r.scalars().all()

    items = []
    for a in appointments:
        uname = ""
        style_name = ""
        style_image = ""
        if a.user_id:
            ur = await db.execute(select(User).where(User.id == a.user_id))
            u = ur.scalar_one_or_none()
            if u:
                uname = u.nickname or u.username
        if a.style_id:
            sr = await db.execute(select(NailStyle).where(NailStyle.id == a.style_id))
            s = sr.scalar_one_or_none()
            if s:
                style_name = s.name
                style_image = settings.IMAGE_BASE_URL + "/" + (s.image_url or "").lstrip("/") if s.image_url else ""

        items.append({
            "id": a.id, "user_id": a.user_id, "user_name": uname,
            "merchant_id": a.merchant_id, "style_id": a.style_id,
            "style_name": style_name, "style_image": style_image,
            "service_item": a.service_item or "",
            "appointment_time": str(a.appointment_time) if a.appointment_time else None,
            "status": a.status, "notes": a.notes or "",
            "price": float(a.price or 0),
            "created_at": str(a.created_at) if a.created_at else "",
        })

    return {
        "items": items, "total": total, "page": page,
        "page_size": page_size, "total_pages": max(1, ceil(total / page_size)) if total > 0 else 0,
    }


@router.put("/admin/appointments/{appointment_id}")
async def update_appointment_status(
    appointment_id: int,
    body: AppointmentStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """商家修改预约状态"""
    logger.info(f"PUT /admin/appointments/{appointment_id} status={body.status} user={user.id}")
    merchant = await _require_merchant(user, db)

    appointment = await db.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if appointment.merchant_id != merchant.id:
        raise HTTPException(status_code=403, detail="只能管理自己店铺的预约")

    appointment.status = body.status
    await db.flush()

    logger.info(f"PUT /admin/appointments/{appointment_id} status updated to {body.status}")
    return {"ok": True, "message": f"预约状态已更新为 {body.status}", "appointment_id": appointment_id}
