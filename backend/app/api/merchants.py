"""
商家 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from math import ceil
from pydantic import BaseModel, field_validator

from app.core.database import get_db
from app.core.logger import get_logger
from app.models.models import Merchant, NailStyle, User, Appointment, NailTag
from app.schemas.schemas import MerchantOut, MerchantDetail, NailStyleOut
from app.api.auth import get_current_user
from app.services.local_image_service import save_image, get_image_url

router = APIRouter()
logger = get_logger("merchants")


def _merchant_to_out(m: Merchant) -> MerchantOut:
    return MerchantOut(
        id=m.id, name=m.name, description=m.description or "",
        logo_url=m.logo_url or "", images=m.images or [],
        city=m.city or "", district=m.district or "",
        address=m.address or "", business_hours=m.business_hours or "",
        phone=m.phone or "", rating=m.rating or 5.0,
        review_count=m.review_count or 0, tags=m.tags or [],
        created_at=m.created_at,
    )


@router.get("/merchants")
async def list_merchants(
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("rating"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"获取商家列表 | city={city} sort={sort} page={page}")
    q = select(Merchant)

    if city:
        q = q.where(Merchant.city == city)
    if search:
        q = q.where(Merchant.name.contains(search) | Merchant.description.contains(search))

    if sort == "popular":
        q = q.order_by(desc(Merchant.review_count))
    else:
        q = q.order_by(desc(Merchant.rating))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    result = await db.execute(q)
    merchants = result.scalars().all()
    items = [_merchant_to_out(m) for m in merchants]

    logger.info(f"商家列表返回 | total={total} count={len(items)}")
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "total_pages": ceil(total / page_size) if total > 0 else 0}


@router.get("/merchants/cities")
async def merchant_cities(db: AsyncSession = Depends(get_db)):
    logger.info("获取商家城市列表")
    r = await db.execute(select(Merchant.city, func.count(Merchant.id)).group_by(Merchant.city))
    result = [{"city": row[0], "count": row[1]} for row in r.all() if row[0]]
    logger.info(f"城市列表返回 | count={len(result)}")
    return result


@router.get("/merchants/{merchant_id}")
async def get_merchant(merchant_id: int, db: AsyncSession = Depends(get_db)):
    logger.info(f"获取商家详情 | id={merchant_id}")
    result = await db.execute(select(Merchant).where(Merchant.id == merchant_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="商家不存在")

    s_result = await db.execute(
        select(NailStyle).where(NailStyle.merchant_id == merchant_id, NailStyle.is_active == True)
        .order_by(desc(NailStyle.popularity))
    )
    styles = s_result.scalars().all()
    style_outs = [NailStyleOut(
        id=s.id, name=s.name, description=s.description or "",
        image_url=s.image_url or "", category=s.category or "",
        color_tone=s.color_tone or "", scene=s.scene or "",
        nail_shape=s.nail_shape or "", difficulty=s.difficulty or "medium",
        price=float(s.price or 0), original_price=float(s.original_price or 0),
        popularity=s.popularity or 0, tryon_count=s.tryon_count or 0,
        favorite_count=s.favorite_count or 0, merchant_id=s.merchant_id,
        merchant_name=m.name, tags=[], is_active=s.is_active, created_at=s.created_at,
    ) for s in styles]

    base = _merchant_to_out(m).model_dump()
    base["time_slots"] = m.time_slots or []
    base["styles"] = [s.model_dump() for s in style_outs]

    logger.info(f"商家详情返回 | name={m.name} styles={len(style_outs)} slots={len(m.time_slots or [])}")
    return base


# ========== 商家入驻 ==========

@router.post("/merchants/upload-image")
async def upload_merchant_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """商家上传店面图片 — 返回图片路径供入驻表单提交"""
    logger.info(f"POST /merchants/upload-image filename={file.filename} user={user.id}")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    data = await file.read()
    image_path = save_image(data, "merchants", file.filename)
    image_url = get_image_url(image_path)

    logger.info(f"图片上传成功 path={image_path}")
    return {"image_path": image_path, "image_url": image_url, "message": "上传成功"}


class MerchantJoinRequest(BaseModel):
    name: str
    city: str
    district: str = ""
    address: str
    phone: str
    business_hours: str
    description: str = ""
    tags: List[str] = []
    images: List[str] = []

    @field_validator("images")
    @classmethod
    def validate_images(cls, v: List[str]) -> List[str]:
        if len(v) < 1:
            raise ValueError("至少上传一张店面图片")
        if len(v) > 3:
            raise ValueError("最多上传三张店面图片")
        return v


@router.post("/merchants/join", response_model=MerchantOut)
async def merchant_join(
    body: MerchantJoinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """商家入驻 — 创建门店记录"""
    logger.info(f"商家入驻 | user_id={user.id} name={body.name}")

    # 检查是否已入驻
    existing = (await db.execute(select(Merchant).where(Merchant.user_id == user.id))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="您已经入驻过了")

    merchant = Merchant(
        name=body.name, city=body.city, district=body.district or "",
        address=body.address, business_hours=body.business_hours,
        phone=body.phone, description=body.description or "",
        tags=body.tags, images=body.images, user_id=user.id,
    )
    db.add(merchant)
    await db.flush()

    logger.info(f"入驻成功 | merchant_id={merchant.id} name={merchant.name}")
    return _merchant_to_out(merchant)


# ═══════════════════════════════════════════════════
# 预设标签
# ═══════════════════════════════════════════════════

@router.get("/tags")
async def get_preset_tags(db: AsyncSession = Depends(get_db)):
    """返回所有预设标签选项（分类、色调、场景、甲型）"""
    logger.info("GET /tags")
    r = await db.execute(select(NailTag))
    tags = r.scalars().all()

    categories = sorted(set(t.name for t in tags if t.tag_type == "category"))
    color_tones = sorted(set(t.name for t in tags if t.tag_type == "color_tone"))
    scenes = sorted(set(t.name for t in tags if t.tag_type == "scene"))
    nail_shapes = sorted(set(t.name for t in tags if t.tag_type == "shape"))

    return {
        "categories": categories or ["通勤", "约会", "派对", "日常", "婚礼"],
        "color_tones": color_tones or ["暖色", "冷色", "中性", "亮色", "暗色"],
        "scenes": scenes or ["通勤", "约会", "派对", "日常", "婚礼", "面试"],
        "nail_shapes": nail_shapes or ["短甲", "长甲", "方圆", "椭圆", "尖形", "芭蕾"],
    }


# ═══════════════════════════════════════════════════
# 商家时段管理
# ═══════════════════════════════════════════════════

@router.get("/merchants/{merchant_id}/slots")
async def get_merchant_slots(
    merchant_id: int,
    date: Optional[str] = Query(None, description="预约日期 YYYY-MM-DD，默认今天"),
    db: AsyncSession = Depends(get_db),
):
    """获取商家可用时段及剩余容量"""
    logger.info(f"GET /merchants/{merchant_id}/slots date={date}")

    from datetime import date as date_type, datetime

    if date:
        target_date = date_type.fromisoformat(date)
    else:
        target_date = date_type.today()

    merchant = await db.get(Merchant, merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="商家不存在")

    slots_config = merchant.time_slots or []
    if not slots_config:
        return {"merchant_id": merchant_id, "date": str(target_date), "slots": [], "message": "商家暂未设置预约时段"}

    # 统计当天每个时段已预约数量
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    day_end = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)

    r = await db.execute(
        select(Appointment).where(
            Appointment.merchant_id == merchant_id,
            Appointment.appointment_time >= day_start,
            Appointment.appointment_time < day_end,
            Appointment.status.in_(["pending", "confirmed"]),
        )
    )
    day_appointments = r.scalars().all()

    # 计算每个时段已预约数
    slot_booked: dict[str, int] = {}
    for a in day_appointments:
        if a.appointment_time:
            time_str = a.appointment_time.strftime("%H:%M")
            for slot in slots_config:
                if slot["start"] <= time_str <= slot["end"]:
                    slot_booked[slot["start"]] = slot_booked.get(slot["start"], 0) + 1
                    break

    slots_with_capacity = []
    for slot in slots_config:
        booked = slot_booked.get(slot["start"], 0)
        max_b = slot.get("max_bookings", 1)
        slots_with_capacity.append({
            "start": slot["start"],
            "end": slot["end"],
            "max_bookings": max_b,
            "booked": booked,
            "available": max(0, max_b - booked),
        })

    return {"merchant_id": merchant_id, "date": str(target_date), "slots": slots_with_capacity}
