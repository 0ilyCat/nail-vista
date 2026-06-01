from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pathlib import Path
import logging
from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import NailStyle, StyleMetrics, TryonRecord

router = APIRouter()
settings = get_settings()
logger = logging.getLogger("nailvista.styles")

STYLES_DIR = Path(settings.STATIC_DIR) / "styles"


def _style_local_url(style_id: int) -> str:
    """获取款式本地图片URL"""
    fname = f"style_{style_id:02d}.png"
    fpath = STYLES_DIR / fname
    if fpath.exists():
        return f"/static/styles/{fname}"
    return ""


@router.get("")
async def list_styles(
    category: str = "",
    search: str = "",
    sort: str = "newest",
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """款式列表，支持分类/搜索/排序"""
    stmt = select(NailStyle)
    if category:
        stmt = stmt.where(NailStyle.category == category)
    if search:
        stmt = stmt.where(NailStyle.name.contains(search))

    if sort == "popular":
        stmt = stmt.order_by(desc(NailStyle.popularity))
    elif sort == "name":
        stmt = stmt.order_by(NailStyle.name)
    else:
        stmt = stmt.order_by(desc(NailStyle.created_at))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * size
    stmt = stmt.offset(offset).limit(size)
    result = await db.execute(stmt)
    styles = result.scalars().all()

    items = []
    for s in styles:
        # 获取今日试戴数
        from datetime import datetime
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        metrics_stmt = select(func.coalesce(func.sum(StyleMetrics.tryons), 0)).where(
            StyleMetrics.style_id == s.id,
            StyleMetrics.date == today,
        )
        today_tryons = (await db.execute(metrics_stmt)).scalar() or 0

        items.append({
            "id": s.id,
            "name": s.name,
            "local_url": _style_local_url(s.id),
            "original_url": s.original_url,
            "enhanced_url": s.enhanced_url,
            "category": s.category,
            "color_tone": s.color_tone,
            "tags": s.tags or [],
            "description": s.description,
            "popularity": s.popularity,
            "today_tryons": today_tryons,
        })

    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    """获取所有分类及数量"""
    stmt = select(NailStyle.category, func.count(NailStyle.id)).group_by(NailStyle.category)
    result = await db.execute(stmt)
    rows = result.all()
    return {"categories": [{"name": r[0], "count": r[1]} for r in rows if r[0]]}


@router.get("/{style_id}")
async def style_detail(style_id: int, db: AsyncSession = Depends(get_db)):
    """款式详情，含统计"""
    style = await db.get(NailStyle, style_id)
    if not style:
        raise HTTPException(404, "款式不存在")

    today_tryons_stmt = select(func.sum(StyleMetrics.tryons)).where(
        StyleMetrics.style_id == style_id,
    )
    total_tryons = (await db.execute(today_tryons_stmt)).scalar() or 0

    # 最近试戴记录
    recent_stmt = (
        select(TryonRecord)
        .where(TryonRecord.nail_style_id == style_id)
        .order_by(desc(TryonRecord.created_at))
        .limit(5)
    )
    recent_result = await db.execute(recent_stmt)
    recent = []
    for r in recent_result.scalars().all():
        recent.append({
            "result_url": r.result_url,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return {
        "id": style.id,
        "name": style.name,
        "original_url": style.original_url,
        "enhanced_url": style.enhanced_url,
        "category": style.category,
        "color_tone": style.color_tone,
        "tags": style.tags or [],
        "description": style.description,
        "popularity": style.popularity,
        "total_tryons": total_tryons,
        "recent_tryons": recent,
        "created_at": style.created_at.isoformat() if style.created_at else "",
    }


@router.get("/hot/ranking")
async def hot_ranking(
    limit: int = 10,
    days: int = 7,
    db: AsyncSession = Depends(get_db),
):
    """热门排行（按最近N天热度分）"""
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(days=days)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)

    stmt = (
        select(
            NailStyle.id,
            NailStyle.name,
            NailStyle.category,
            NailStyle.color_tone,
            func.coalesce(func.sum(StyleMetrics.tryons), 0).label("total_tryons"),
            func.coalesce(func.sum(StyleMetrics.views), 0).label("total_views"),
            func.coalesce(func.sum(StyleMetrics.favorites), 0).label("total_favs"),
            func.coalesce(func.avg(StyleMetrics.hot_score), 0).label("avg_hot"),
        )
        .join(StyleMetrics, StyleMetrics.style_id == NailStyle.id)
        .where(StyleMetrics.date >= since)
        .group_by(NailStyle.id)
        .order_by(desc("avg_hot"))
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    ranking = []
    for i, row in enumerate(rows):
        ranking.append({
            "rank": i + 1,
            "style_id": row[0],
            "name": row[1],
            "category": row[2],
            "color_tone": row[3],
            "total_tryons": row[4],
            "total_views": row[5],
            "total_favorites": row[6],
            "hot_score": round(float(row[7]), 1),
        })

    return {"ranking": ranking, "period_days": days}
