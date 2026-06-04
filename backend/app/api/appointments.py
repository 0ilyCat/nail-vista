"""
预约 API — 创建、列表、详情、更新状态、取消
"""
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import Appointment, Merchant, NailStyle, User
from app.schemas.schemas import AppointmentCreate, AppointmentOut
from app.api.auth import get_current_user

router = APIRouter(prefix="/appointments")
logger = get_logger("nailvista.appointments")


class AppointmentStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|confirmed|completed|cancelled)$")


def _image_url(image_url: str) -> str:
    if not image_url:
        return ""
    return f"{settings.IMAGE_BASE_URL}/{image_url}"


def _appt_dict(a) -> dict:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "merchant_id": a.merchant_id,
        "merchant_name": a.merchant.name if a.merchant else "",
        "style_id": a.style_id,
        "style_name": a.style.name if a.style else "",
        "style_image": _image_url(a.style.image_url) if a.style else "",
        "service_item": a.service_item or "",
        "appointment_time": a.appointment_time.isoformat() if a.appointment_time else None,
        "status": a.status,
        "notes": a.notes or "",
        "price": a.price or 0.0,
        "created_at": a.created_at.isoformat() if a.created_at else "",
    }


# ────────────────────────────────────────────────────────────
# POST /appointments — 创建预约
# ────────────────────────────────────────────────────────────
@router.post("")
async def create_appointment(
    req: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        f"[POST] /appointments | user_id={current_user.id} "
        f"merchant_id={req.merchant_id} style_id={req.style_id}"
    )

    merchant_result = await db.execute(
        select(Merchant).where(Merchant.id == req.merchant_id)
    )
    merchant = merchant_result.scalar_one_or_none()
    if not merchant:
        raise HTTPException(status_code=404, detail="商家不存在")

    style = None
    if req.style_id:
        style_result = await db.execute(
            select(NailStyle).where(NailStyle.id == req.style_id)
        )
        style = style_result.scalar_one_or_none()
        if not style:
            raise HTTPException(status_code=404, detail="款式不存在")

    appointment = Appointment(
        user_id=current_user.id,
        merchant_id=req.merchant_id,
        style_id=req.style_id,
        service_item=req.service_item or "",
        appointment_time=req.appointment_time,
        notes=req.notes or "",
        price=req.price or 0.0,
        status="pending",
    )
    db.add(appointment)
    await db.flush()

    # eager-load for response
    await db.refresh(appointment)

    # fetch merchant/style names
    logger.info(f"[POST] /appointments | created appointment_id={appointment.id}")

    # Re-query with eager load for full response
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.merchant), selectinload(Appointment.style))
        .where(Appointment.id == appointment.id)
    )
    appointment = result.scalar_one()

    return _appt_dict(appointment)


# ────────────────────────────────────────────────────────────
# GET /appointments — 当前用户预约列表
# ────────────────────────────────────────────────────────────
@router.get("")
async def list_appointments(
    status: Optional[str] = Query(None, description="状态筛选: pending/confirmed/completed/cancelled"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        f"[GET] /appointments | user_id={current_user.id} "
        f"status={status} page={page} page_size={page_size}"
    )

    stmt = (
        select(Appointment)
        .options(selectinload(Appointment.merchant), selectinload(Appointment.style))
        .where(Appointment.user_id == current_user.id)
    )

    if status:
        if status not in ("pending", "confirmed", "completed", "cancelled"):
            raise HTTPException(status_code=400, detail="无效的状态值")
        stmt = stmt.where(Appointment.status == status)

    stmt = stmt.order_by(desc(Appointment.created_at))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)
    result = await db.execute(stmt)
    appointments = result.scalars().all()

    items = [_appt_dict(a) for a in appointments]

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ────────────────────────────────────────────────────────────
# GET /appointments/{appointment_id} — 预约详情
# ────────────────────────────────────────────────────────────
@router.get("/{appointment_id}")
async def appointment_detail(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[GET] /appointments/{appointment_id} | user_id={current_user.id}")

    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.merchant), selectinload(Appointment.style))
        .where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权查看该预约")

    return _appt_dict(appointment)


# ────────────────────────────────────────────────────────────
# PUT /appointments/{appointment_id} — 更新预约状态
# ────────────────────────────────────────────────────────────
@router.put("/{appointment_id}")
async def update_appointment_status(
    appointment_id: int,
    req: AppointmentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        f"[PUT] /appointments/{appointment_id} | "
        f"user_id={current_user.id} new_status={req.status}"
    )

    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.merchant), selectinload(Appointment.style))
        .where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改该预约")

    appointment.status = req.status
    await db.flush()
    await db.refresh(appointment)

    logger.info(f"[PUT] /appointments/{appointment_id} | status updated to {req.status}")

    return _appt_dict(appointment)


# ────────────────────────────────────────────────────────────
# DELETE /appointments/{appointment_id} — 取消预约
# ────────────────────────────────────────────────────────────
@router.delete("/{appointment_id}")
async def cancel_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[DELETE] /appointments/{appointment_id} | user_id={current_user.id}")

    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="预约不存在")
    if appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权取消该预约")

    appointment.status = "cancelled"
    await db.flush()

    logger.info(f"[DELETE] /appointments/{appointment_id} | cancelled")

    return {"message": "预约已取消", "appointment_id": appointment_id}
