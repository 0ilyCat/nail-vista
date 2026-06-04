"""
美甲款式 API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from math import ceil

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import NailStyle, NailTag, StyleTag, Merchant
from app.schemas.schemas import NailStyleOut, NailStyleDetail

router = APIRouter()
logger = get_logger("styles")


def _style_to_out(s: NailStyle, tags: list[str] = None) -> NailStyleOut:
    return NailStyleOut(
        id=s.id, name=s.name, description=s.description or "",
        image_url=s.image_url, category=s.category or "", color_tone=s.color_tone or "",
        scene=s.scene or "", nail_shape=s.nail_shape or "", difficulty=s.difficulty or "medium",
        price=s.price or 0, original_price=s.original_price or 0,
        popularity=s.popularity or 0, tryon_count=s.tryon_count or 0,
        favorite_count=s.favorite_count or 0, merchant_id=s.merchant_id,
        merchant_name=s.merchant.name if hasattr(s, "merchant") and s.merchant else "",
        tags=tags or [], is_active=s.is_active, created_at=s.created_at,
    )


async def _get_style_tags(db: AsyncSession, style_id: int) -> list[str]:
    r = await db.execute(
        select(NailTag.name).join(StyleTag).where(StyleTag.style_id == style_id)
    )
    return [row[0] for row in r.all()]


@router.get("/styles")
async def list_styles(
    category: Optional[str] = Query(None),
    color_tone: Optional[str] = Query(None),
    scene: Optional[str] = Query(None),
    nail_shape: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    merchant_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /styles category={category} sort={sort} search={search} page={page}")
    q = select(NailStyle).options(selectinload(NailStyle.merchant)).where(NailStyle.is_active == True)

    if category:
        q = q.where(NailStyle.category == category)
    if color_tone:
        q = q.where(NailStyle.color_tone == color_tone)
    if scene:
        q = q.where(NailStyle.scene == scene)
    if nail_shape:
        q = q.where(NailStyle.nail_shape == nail_shape)
    if min_price is not None:
        q = q.where(NailStyle.price >= min_price)
    if max_price is not None:
        q = q.where(NailStyle.price <= max_price)
    if merchant_id:
        q = q.where(NailStyle.merchant_id == merchant_id)
    if search:
        q = q.where(NailStyle.name.contains(search) | NailStyle.description.contains(search))

    sort_map = {
        "newest": desc(NailStyle.created_at),
        "popular": desc(NailStyle.popularity),
        "price_asc": NailStyle.price.asc(),
        "price_desc": NailStyle.price.desc(),
    }
    q = q.order_by(sort_map.get(sort, desc(NailStyle.created_at)))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    result = await db.execute(q)
    styles = result.scalars().all()

    items = []
    for s in styles:
        tags = await _get_style_tags(db, s.id)
        items.append(_style_to_out(s, tags))

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(total / page_size) if total > 0 else 0,
    }


@router.get("/styles/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    logger.info("GET /styles/categories")
    r = await db.execute(
        select(NailStyle.category, func.count(NailStyle.id))
        .where(NailStyle.is_active == True)
        .group_by(NailStyle.category)
    )
    return [{"category": row[0] or "未分类", "count": row[1]} for row in r.all()]


@router.get("/styles/{style_id}", response_model=NailStyleDetail)
async def get_style(style_id: int, db: AsyncSession = Depends(get_db)):
    logger.info(f"GET /styles/{style_id}")
    q = select(NailStyle).options(selectinload(NailStyle.merchant)).where(NailStyle.id == style_id)
    result = await db.execute(q)
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="款式不存在")

    tags = await _get_style_tags(db, s.id)
    return NailStyleDetail(
        **_style_to_out(s, tags).model_dump(),
        merchant={"id": s.merchant.id, "name": s.merchant.name, "logo_url": s.merchant.logo_url or "",
                   "description": s.merchant.description or "", "images": s.merchant.images or [],
                   "city": s.merchant.city or "", "district": s.merchant.district or "",
                   "address": s.merchant.address or "", "business_hours": s.merchant.business_hours or "",
                   "phone": s.merchant.phone or "", "rating": s.merchant.rating,
                   "review_count": s.merchant.review_count or 0, "tags": s.merchant.tags or [],
                   "created_at": s.merchant.created_at},
    )


@router.get("/styles/hot/ranking")
async def hot_ranking(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /styles/hot/ranking limit={limit}")
    q = select(NailStyle).options(selectinload(NailStyle.merchant)).where(
        NailStyle.is_active == True
    ).order_by(desc(NailStyle.popularity)).limit(limit)
    result = await db.execute(q)
    styles = result.scalars().all()
    items = []
    for s in styles:
        tags = await _get_style_tags(db, s.id)
        items.append(_style_to_out(s, tags))
    return items


@router.get("/styles/{style_id}/related")
async def related_styles(style_id: int, limit: int = Query(4), db: AsyncSession = Depends(get_db)):
    logger.info(f"GET /styles/{style_id}/related")
    s_result = await db.execute(select(NailStyle).where(NailStyle.id == style_id))
    style = s_result.scalar_one_or_none()
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")

    q = select(NailStyle).options(selectinload(NailStyle.merchant)).where(
        NailStyle.merchant_id == style.merchant_id,
        NailStyle.id != style_id,
        NailStyle.is_active == True,
    ).order_by(desc(NailStyle.popularity)).limit(limit)
    result = await db.execute(q)
    related = result.scalars().all()
    items = []
    for s in related:
        tags = await _get_style_tags(db, s.id)
        items.append(_style_to_out(s, tags))
    return items
