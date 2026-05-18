from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.models import NailStyle, HandImage, TryonRecord, StyleMetrics

router = APIRouter()


@router.get("/overview")
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    """运营总览"""
    total_styles_stmt = select(func.count(NailStyle.id))
    total_styles = (await db.execute(total_styles_stmt)).scalar() or 0

    total_tryons_stmt = select(func.count(TryonRecord.id))
    total_tryons = (await db.execute(total_tryons_stmt)).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_tryons_stmt = select(func.count(TryonRecord.id)).where(
        TryonRecord.created_at >= today
    )
    today_tryons = (await db.execute(today_tryons_stmt)).scalar() or 0

    yesterday = today - timedelta(days=1)
    yesterday_tryons_stmt = select(func.count(TryonRecord.id)).where(
        TryonRecord.created_at >= yesterday,
        TryonRecord.created_at < today,
    )
    yesterday_tryons = (await db.execute(yesterday_tryons_stmt)).scalar() or 0

    change_pct = 0
    if yesterday_tryons > 0:
        change_pct = round((today_tryons - yesterday_tryons) / yesterday_tryons * 100, 1)

    today_views_stmt = select(func.sum(StyleMetrics.views)).where(
        StyleMetrics.date == today
    )
    today_views = (await db.execute(today_views_stmt)).scalar() or 0

    return {
        "total_styles": total_styles,
        "total_tryons": total_tryons,
        "today_tryons": today_tryons,
        "yesterday_tryons": yesterday_tryons,
        "tryon_change_pct": change_pct,
        "today_views": today_views,
    }


@router.get("/trends")
async def trends(
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """N日趋势"""
    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)

    stmt = (
        select(
            StyleMetrics.date,
            func.sum(StyleMetrics.tryons).label("tryons"),
            func.sum(StyleMetrics.views).label("views"),
            func.sum(StyleMetrics.favorites).label("favorites"),
        )
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.date)
        .order_by(StyleMetrics.date)
    )
    result = await db.execute(stmt)
    rows = result.all()

    trend_data = []
    for row in rows:
        trend_data.append({
            "date": row[0].strftime("%Y-%m-%d") if row[0] else "",
            "tryons": row[1] or 0,
            "views": row[2] or 0,
            "favorites": row[3] or 0,
        })

    return {"trends": trend_data, "period_days": days}


@router.get("/hot-styles")
async def hot_styles(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """热门款式数据"""
    from app.services.trend_analyzer import trend_analyzer

    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    prev_since = since - timedelta(days=days)

    # 当前周期汇总
    stmt = (
        select(
            StyleMetrics.style_id,
            NailStyle.name,
            NailStyle.category,
            func.sum(StyleMetrics.tryons),
            func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites),
            func.avg(StyleMetrics.avg_duration),
        )
        .join(NailStyle, NailStyle.id == StyleMetrics.style_id)
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.style_id, NailStyle.name, NailStyle.category)
    )
    result = await db.execute(stmt)
    rows = result.all()

    # 上周期汇总
    prev_stmt = (
        select(
            StyleMetrics.style_id,
            func.sum(StyleMetrics.tryons),
        )
        .where(StyleMetrics.date >= prev_since, StyleMetrics.date < since)
        .group_by(StyleMetrics.style_id)
    )
    prev_result = await db.execute(prev_stmt)
    prev_map = {r[0]: r[1] for r in prev_result.all()}

    current = []
    for row in rows:
        sid = row[0]
        metrics = {
            "style_id": sid,
            "tryons": row[3] or 0,
            "views": row[4] or 0,
            "favorites": row[5] or 0,
            "avg_duration": int(row[6] or 0),
        }
        metrics["hot_score"] = trend_analyzer.calc_hot_score(metrics)

        prev_tryons = prev_map.get(sid, 0)
        change_pct = 0
        if prev_tryons > 0:
            change_pct = round((metrics["tryons"] - prev_tryons) / prev_tryons * 100, 1)
        elif metrics["tryons"] > 0:
            change_pct = 100

        current.append({
            "style_id": sid,
            "name": row[1],
            "category": row[2],
            "tryons": metrics["tryons"],
            "views": metrics["views"],
            "favorites": metrics["favorites"],
            "hot_score": metrics["hot_score"],
            "change_pct": change_pct,
        })

    ranked = sorted(current, key=lambda x: x["hot_score"], reverse=True)[:limit]
    for i, item in enumerate(ranked):
        item["rank"] = i + 1

    return {"styles": ranked, "period_days": days}
