"""
商家 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional, List
from math import ceil
from pydantic import BaseModel

from app.core.database import get_db
from app.core.logger import get_logger
from app.models.models import Merchant, NailStyle, User
from app.schemas.schemas import MerchantOut, MerchantDetail, NailStyleOut
from app.api.auth import get_current_user

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


@router.get("/merchants/{merchant_id}", response_model=MerchantDetail)
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

    logger.info(f"商家详情返回 | name={m.name} styles={len(style_outs)}")
    return MerchantDetail(**_merchant_to_out(m).model_dump(), styles=style_outs)


@router.get("/merchants/cities")
async def merchant_cities(db: AsyncSession = Depends(get_db)):
    logger.info("获取商家城市列表")
    r = await db.execute(select(Merchant.city, func.count(Merchant.id)).group_by(Merchant.city))
    result = [{"city": row[0], "count": row[1]} for row in r.all() if row[0]]
    logger.info(f"城市列表返回 | count={len(result)}")
    return result


# ========== 商家入驻 ==========

class MerchantJoinRequest(BaseModel):
    name: str
    city: str
    district: str = ""
    address: str
    phone: str
    business_hours: str
    description: str = ""
    tags: List[str] = []


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
        tags=body.tags, user_id=user.id,
    )
    db.add(merchant)
    await db.flush()

    logger.info(f"入驻成功 | merchant_id={merchant.id} name={merchant.name}")
    return _merchant_to_out(merchant)
