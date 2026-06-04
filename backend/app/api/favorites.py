"""
收藏 API — 商家收藏 & 款式收藏（切换 / 列表）
"""
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, Merchant, NailStyle, StyleTag, NailTag, UserFavoriteMerchant, UserFavoriteStyle
from app.api.auth import get_current_user

router = APIRouter(prefix="/favorites")
logger = get_logger("nailvista.favorites")


def _image_url(obj, field: str = "image_url") -> str:
    val = getattr(obj, field, "") or ""
    if not val:
        return ""
    return f"{settings.IMAGE_BASE_URL}/{val}"


def _list_image_urls(obj) -> list:
    images = getattr(obj, "images", None) or []
    return [f"{settings.IMAGE_BASE_URL}/{img}" for img in images]


# ════════════════════════════════════════════════════════════
# POST /favorites/merchants/{merchant_id} — 切换商家收藏
# ════════════════════════════════════════════════════════════
@router.post("/merchants/{merchant_id}")
async def toggle_favorite_merchant(
    merchant_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[POST] /favorites/merchants/{merchant_id} | user_id={current_user.id}")

    merchant_result = await db.execute(
        select(Merchant).where(Merchant.id == merchant_id)
    )
    if not merchant_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="商家不存在")

    result = await db.execute(
        select(UserFavoriteMerchant).where(
            (UserFavoriteMerchant.user_id == current_user.id) &
            (UserFavoriteMerchant.merchant_id == merchant_id)
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.flush()
        logger.info(f"[POST] /favorites/merchants/{merchant_id} | unfavorited")
        return {"favorited": False, "message": "已取消收藏"}
    else:
        fav = UserFavoriteMerchant(user_id=current_user.id, merchant_id=merchant_id)
        db.add(fav)
        await db.flush()
        logger.info(f"[POST] /favorites/merchants/{merchant_id} | favorited")
        return {"favorited": True, "message": "已添加收藏"}


# ════════════════════════════════════════════════════════════
# GET /favorites/merchants — 收藏商家列表
# ════════════════════════════════════════════════════════════
@router.get("/merchants")
async def list_favorite_merchants(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[GET] /favorites/merchants | user_id={current_user.id} page={page} page_size={page_size}")

    base_stmt = (
        select(UserFavoriteMerchant)
        .options(selectinload(UserFavoriteMerchant.merchant))
        .where(UserFavoriteMerchant.user_id == current_user.id)
        .order_by(desc(UserFavoriteMerchant.created_at))
    )

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = base_stmt.offset(offset).limit(page_size)
    result = await db.execute(stmt)
    favs = result.scalars().all()

    items = []
    for f in favs:
        m = f.merchant
        items.append({
            "id": m.id,
            "name": m.name,
            "description": m.description or "",
            "logo_url": _image_url(m, "logo_url"),
            "images": _list_image_urls(m),
            "city": m.city or "",
            "district": m.district or "",
            "address": m.address or "",
            "business_hours": m.business_hours or "",
            "phone": m.phone or "",
            "rating": m.rating or 5.0,
            "review_count": m.review_count or 0,
            "tags": m.tags or [],
            "favorited_at": f.created_at.isoformat() if f.created_at else "",
        })

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ════════════════════════════════════════════════════════════
# POST /favorites/styles/{style_id} — 切换款式收藏
# ════════════════════════════════════════════════════════════
@router.post("/styles/{style_id}")
async def toggle_favorite_style(
    style_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[POST] /favorites/styles/{style_id} | user_id={current_user.id}")

    style_result = await db.execute(
        select(NailStyle).where(NailStyle.id == style_id)
    )
    style = style_result.scalar_one_or_none()
    if not style:
        raise HTTPException(status_code=404, detail="款式不存在")

    result = await db.execute(
        select(UserFavoriteStyle).where(
            (UserFavoriteStyle.user_id == current_user.id) &
            (UserFavoriteStyle.style_id == style_id)
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.flush()
        if style.favorite_count > 0:
            style.favorite_count -= 1
            await db.flush()
        logger.info(f"[POST] /favorites/styles/{style_id} | unfavorited")
        return {"favorited": False, "message": "已取消收藏"}
    else:
        fav = UserFavoriteStyle(user_id=current_user.id, style_id=style_id)
        db.add(fav)
        await db.flush()
        style.favorite_count = (style.favorite_count or 0) + 1
        await db.flush()
        logger.info(f"[POST] /favorites/styles/{style_id} | favorited")
        return {"favorited": True, "message": "已添加收藏"}


# ════════════════════════════════════════════════════════════
# GET /favorites/styles — 收藏款式列表
# ════════════════════════════════════════════════════════════
@router.get("/styles")
async def list_favorite_styles(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[GET] /favorites/styles | user_id={current_user.id} page={page} page_size={page_size}")

    base_stmt = (
        select(UserFavoriteStyle)
        .options(
            selectinload(UserFavoriteStyle.style)
            .selectinload(NailStyle.merchant),
            selectinload(UserFavoriteStyle.style)
            .selectinload(NailStyle.tags)
            .selectinload(StyleTag.tag),
        )
        .where(UserFavoriteStyle.user_id == current_user.id)
        .order_by(desc(UserFavoriteStyle.created_at))
    )

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = base_stmt.offset(offset).limit(page_size)
    result = await db.execute(stmt)
    favs = result.scalars().all()

    items = []
    for f in favs:
        s = f.style
        merchant = s.merchant if s else None
        tag_names = []
        if s and s.tags:
            for st in s.tags:
                if hasattr(st, "tag") and st.tag:
                    tag_names.append(st.tag.name)

        items.append({
            "id": s.id,
            "name": s.name,
            "description": s.description or "",
            "image_url": _image_url(s, "image_url"),
            "category": s.category or "",
            "color_tone": s.color_tone or "",
            "scene": s.scene or "",
            "nail_shape": s.nail_shape or "",
            "difficulty": s.difficulty or "medium",
            "price": s.price or 0.0,
            "original_price": s.original_price or 0.0,
            "popularity": s.popularity or 0.0,
            "tryon_count": s.tryon_count or 0,
            "favorite_count": s.favorite_count or 0,
            "merchant_id": s.merchant_id,
            "merchant_name": merchant.name if merchant else "",
            "merchant_logo": _image_url(merchant, "logo_url") if merchant else "",
            "tags": tag_names,
            "is_active": s.is_active,
            "favorited_at": f.created_at.isoformat() if f.created_at else "",
        })

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
