"""
商家仪表盘 API — 商家端数据分析
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta, timezone
from math import ceil

from app.core.database import get_db
from app.core.logger import get_logger
from app.models.models import User, Merchant, NailStyle, Appointment
from app.api.auth import get_current_user

router = APIRouter()
logger = get_logger("dashboard")


async def _get_merchant(db: AsyncSession, user: User) -> Merchant:
    r = await db.execute(select(Merchant).where(Merchant.user_id == user.id))
    m = r.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=403, detail="当前用户不是商家角色")
    return m


@router.get("/dashboard/overview")
async def overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /dashboard/overview user={user.id}")
    merchant = await _get_merchant(db, user)

    total_r = await db.execute(select(func.count(Appointment.id)).where(Appointment.merchant_id == merchant.id))
    total = total_r.scalar() or 0

    completed_r = await db.execute(select(func.count(Appointment.id)).where(
        Appointment.merchant_id == merchant.id, Appointment.status == "completed"))
    completed = completed_r.scalar() or 0

    pending_r = await db.execute(select(func.count(Appointment.id)).where(
        Appointment.merchant_id == merchant.id, Appointment.status == "pending"))
    pending = pending_r.scalar() or 0

    rev_r = await db.execute(select(func.sum(Appointment.price)).where(
        Appointment.merchant_id == merchant.id, Appointment.status == "completed"))
    total_revenue = float(rev_r.scalar() or 0)

    top_styles_r = await db.execute(
        select(NailStyle.name, func.count(Appointment.id).label("cnt"), func.sum(Appointment.price).label("rev"))
        .join(NailStyle, Appointment.style_id == NailStyle.id)
        .where(Appointment.merchant_id == merchant.id)
        .group_by(NailStyle.id, NailStyle.name).order_by(desc("cnt")).limit(5)
    )
    top_styles = [{"style_name": r[0], "appointment_count": r[1], "revenue": float(r[2] or 0)} for r in top_styles_r.all()]

    monthly = []
    for i in range(5, -1, -1):
        start = datetime.now(timezone.utc).replace(day=1) - timedelta(days=30 * i)
        m_r = await db.execute(select(func.count(Appointment.id), func.sum(Appointment.price)).where(
            Appointment.merchant_id == merchant.id, Appointment.created_at >= start))
        row = m_r.one()
        monthly.append({"month": start.strftime("%Y-%m"), "count": row[0] or 0, "revenue": float(row[1] or 0)})

    return {
        "total_appointments": total, "completed_appointments": completed,
        "pending_appointments": pending, "total_revenue": total_revenue,
        "avg_order_value": round(total_revenue / completed, 2) if completed > 0 else 0,
        "top_styles": top_styles, "monthly_trend": monthly,
    }


@router.get("/dashboard/appointments")
async def appointments_list(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /dashboard/appointments user={user.id}")
    merchant = await _get_merchant(db, user)

    q = select(Appointment).where(Appointment.merchant_id == merchant.id)
    if status:
        q = q.where(Appointment.status == status)
    q = q.order_by(desc(Appointment.created_at))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    r = await db.execute(q)
    appts = r.scalars().all()

    items = []
    for a in appts:
        name = ""
        uname = ""
        if a.style_id:
            sr = await db.execute(select(NailStyle).where(NailStyle.id == a.style_id))
            s = sr.scalar_one_or_none()
            if s: name = s.name
        if a.user_id:
            ur = await db.execute(select(User).where(User.id == a.user_id))
            u = ur.scalar_one_or_none()
            if u: uname = u.nickname or u.username
        items.append({"id": a.id, "user_id": a.user_id, "user_name": uname,
            "merchant_id": a.merchant_id, "style_id": a.style_id,
            "style_name": name, "service_item": a.service_item or "",
            "appointment_time": str(a.appointment_time) if a.appointment_time else None,
            "status": a.status, "notes": a.notes or "", "price": float(a.price or 0),
            "created_at": str(a.created_at)})

    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": ceil(total / page_size) if total > 0 else 0}


@router.get("/dashboard/revenue")
async def revenue(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /dashboard/revenue user={user.id}")
    merchant = await _get_merchant(db, user)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    async def rev_since(since):
        r = await db.execute(select(func.sum(Appointment.price)).where(
            Appointment.merchant_id == merchant.id, Appointment.status == "completed",
            Appointment.created_at >= since))
        return float(r.scalar() or 0)

    async def cnt_since(since):
        r = await db.execute(select(func.count(Appointment.id)).where(
            Appointment.merchant_id == merchant.id, Appointment.status == "completed",
            Appointment.created_at >= since))
        return r.scalar() or 0

    return {
        "today": {"revenue": await rev_since(today_start), "orders": await cnt_since(today_start)},
        "this_week": {"revenue": await rev_since(week_start), "orders": await cnt_since(week_start)},
        "this_month": {"revenue": await rev_since(month_start), "orders": await cnt_since(month_start)},
        "total": {"revenue": await rev_since(datetime(2020,1,1,tzinfo=timezone.utc)), "orders": 0},
    }
