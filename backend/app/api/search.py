"""
统一搜索 API — 无需认证
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from math import ceil

from app.core.database import get_db
from app.core.logger import get_logger
from app.models.models import NailStyle, Post, Merchant, User
from app.schemas.schemas import NailStyleOut, PostOut, MerchantOut

router = APIRouter()
logger = get_logger("search")


@router.get("/search")
async def search_all(
    q: str = Query(..., min_length=1),
    type: str = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /search q={q} type={type}")

    result = {"styles": [], "posts": [], "merchants": []}

    if type in ("all", "styles"):
        result["styles"] = await _search_styles(db, q, page, page_size)

    if type in ("all", "posts"):
        result["posts"] = await _search_posts(db, q, page, page_size)

    if type in ("all", "merchants"):
        result["merchants"] = await _search_merchants(db, q, page, page_size)

    return result


async def _search_styles(db, keyword, page, size):
    q = select(NailStyle).options(selectinload(NailStyle.merchant)).where(
        NailStyle.is_active == True,
        NailStyle.name.contains(keyword) | NailStyle.description.contains(keyword) | NailStyle.category.contains(keyword),
    ).order_by(desc(NailStyle.popularity)).limit(size)
    r = await db.execute(q)
    styles = r.scalars().all()
    return [NailStyleOut(
        id=s.id, name=s.name, description=s.description or "",
        image_url=s.image_url or "", category=s.category or "",
        color_tone=s.color_tone or "", scene=s.scene or "",
        nail_shape=s.nail_shape or "", difficulty=s.difficulty or "medium",
        price=float(s.price or 0), original_price=float(s.original_price or 0),
        popularity=s.popularity or 0, tryon_count=s.tryon_count or 0,
        favorite_count=s.favorite_count or 0, merchant_id=s.merchant_id,
        merchant_name=s.merchant.name if s.merchant else "",
        tags=[], is_active=s.is_active, created_at=s.created_at,
    ) for s in styles]


async def _search_posts(db, keyword, page, size):
    q = select(Post).options(selectinload(Post.author), selectinload(Post.style)).where(
        Post.title.contains(keyword) | Post.content.contains(keyword),
    ).order_by(desc(Post.created_at)).limit(size)
    r = await db.execute(q)
    posts = r.scalars().all()
    return [PostOut(
        id=p.id, title=p.title, content=p.content or "",
        image_url=p.image_url or "", user_id=p.user_id,
        author_name=p.author.nickname if p.author else "",
        author_avatar=p.author.avatar_url if p.author else "",
        style_id=p.style_id,
        style_name=p.style.name if p.style else "",
        style_price=float(p.style.price) if p.style else 0.0,
        likes_count=p.likes_count or 0, favorites_count=p.favorites_count or 0,
        created_at=p.created_at,
    ) for p in posts]


async def _search_merchants(db, keyword, page, size):
    q = select(Merchant).where(
        Merchant.name.contains(keyword) | Merchant.city.contains(keyword) | Merchant.description.contains(keyword),
    ).order_by(desc(Merchant.rating)).limit(size)
    r = await db.execute(q)
    merchants = r.scalars().all()
    return [MerchantOut(
        id=m.id, name=m.name, description=m.description or "",
        logo_url=m.logo_url or "", images=m.images or [],
        city=m.city or "", district=m.district or "",
        address=m.address or "", business_hours=m.business_hours or "",
        phone=m.phone or "", rating=m.rating or 5.0, review_count=m.review_count or 0,
        tags=m.tags or [], created_at=m.created_at,
    ) for m in merchants]
