"""
Analytics API — 美团风格运营数据看板
覆盖: 概览、营收、退款、评价、流量、客户、趋势、热门款式
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, case, extract
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.models import (
    NailStyle, HandImage, TryonRecord, StyleMetrics,
    Order, Refund, Review, DailyRevenue, TrafficMetrics, CouponUsage,
)

router = APIRouter()

TODAY = lambda: datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


# ── 运营总览（增强版） ──────────────────────────────────

@router.get("/overview")
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    """运营总览 — 9大核心指标"""
    today = TODAY()
    yesterday = today - timedelta(days=1)

    # 基础指标
    total_styles = (await db.execute(select(func.count(NailStyle.id)))).scalar() or 0
    total_tryons = (await db.execute(select(func.count(TryonRecord.id)))).scalar() or 0
    today_tryons = (await db.execute(
        select(func.count(TryonRecord.id)).where(TryonRecord.created_at >= today)
    )).scalar() or 0
    yesterday_tryons = (await db.execute(
        select(func.count(TryonRecord.id)).where(
            TryonRecord.created_at >= yesterday, TryonRecord.created_at < today
        )
    )).scalar() or 0

    # 营收指标
    today_rev = (await db.execute(
        select(DailyRevenue).where(DailyRevenue.date == today)
    )).scalar()
    yest_rev = (await db.execute(
        select(DailyRevenue).where(DailyRevenue.date == yesterday)
    )).scalar()

    gross = today_rev.gross_revenue if today_rev else 0
    orders_today = today_rev.order_count if today_rev else 0
    aov = today_rev.avg_order_value if today_rev else 0
    refund_amt = today_rev.refund_amount if today_rev else 0

    # 环比
    rev_change = 0
    if yest_rev and yest_rev.gross_revenue > 0:
        rev_change = round((gross - yest_rev.gross_revenue) / yest_rev.gross_revenue * 100, 1)

    tryon_change = 0
    if yesterday_tryons > 0:
        tryon_change = round((today_tryons - yesterday_tryons) / yesterday_tryons * 100, 1)

    # 评价统计
    rating_stats = (await db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .where(Review.created_at >= today)
    )).first()
    avg_rating = round(rating_stats[0], 1) if rating_stats[0] else 0
    review_count = rating_stats[1] or 0

    # 转化漏斗
    today_traffic = (await db.execute(
        select(TrafficMetrics).where(TrafficMetrics.date == today)
    )).scalar()
    exposure = today_traffic.exposure if today_traffic else 0
    clicks = today_traffic.click if today_traffic else 0
    cvr = today_traffic.cvr if today_traffic else 0

    return {
        "total_styles": total_styles,
        "total_tryons": total_tryons,
        "today_tryons": today_tryons,
        "yesterday_tryons": yesterday_tryons,
        "tryon_change_pct": tryon_change,
        "today_revenue": gross,
        "today_orders": orders_today,
        "avg_order_value": aov,
        "refund_amount": refund_amt,
        "revenue_change_pct": rev_change,
        "avg_rating": avg_rating,
        "review_count": review_count,
        "exposure": exposure,
        "clicks": clicks,
        "cvr": cvr,
    }


# ── 营收趋势 ─────────────────────────────────────────

@router.get("/revenue")
async def revenue_trend(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """N日营收趋势"""
    since = TODAY() - timedelta(days=days)
    stmt = (
        select(DailyRevenue)
        .where(DailyRevenue.date >= since)
        .order_by(DailyRevenue.date)
    )
    rows = (await db.execute(stmt)).scalars().all()

    data = [{
        "date": r.date.strftime("%m-%d"),
        "gross_revenue": r.gross_revenue,
        "net_revenue": r.net_revenue,
        "order_count": r.order_count,
        "refund_amount": r.refund_amount,
        "avg_order_value": r.avg_order_value,
    } for r in rows]

    totals = {
        "gross_revenue": sum(d["gross_revenue"] for d in data),
        "net_revenue": sum(d["net_revenue"] for d in data),
        "order_count": sum(d["order_count"] for d in data),
        "refund_amount": sum(d["refund_amount"] for d in data),
    }
    return {"revenue": data, "totals": totals, "period_days": days}


# ── 退款分析 ─────────────────────────────────────────

@router.get("/refunds")
async def refund_analysis(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """退款分析"""
    since = TODAY() - timedelta(days=days)
    total_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since)
    )).scalar() or 1
    total_refunds = (await db.execute(
        select(func.count(Refund.id)).where(Refund.created_at >= since)
    )).scalar() or 0

    refund_rate = round(total_refunds / total_orders * 100, 2)

    # 退款原因分布
    reason_stmt = (
        select(Refund.reason, func.count(Refund.id))
        .where(Refund.created_at >= since)
        .group_by(Refund.reason)
        .order_by(desc(func.count(Refund.id)))
    )
    reasons = [{"reason": r[0], "count": r[1]} for r in (await db.execute(reason_stmt)).all()]

    # 每日退款
    daily = (await db.execute(
        select(DailyRevenue.date, DailyRevenue.refund_amount, DailyRevenue.refund_count, DailyRevenue.order_count)
        .where(DailyRevenue.date >= since).order_by(DailyRevenue.date)
    )).all()
    daily_data = [{
        "date": d[0].strftime("%m-%d"),
        "refund_amount": d[1] or 0,
        "refund_count": d[2] or 0,
        "order_count": d[3] or 0,
        "refund_rate": round((d[2] or 0) / (d[3] or 1) * 100, 1),
    } for d in daily]

    return {"total_refunds": total_refunds, "refund_rate": refund_rate,
            "reasons": reasons, "daily": daily_data, "period_days": days}


# ── 评价分析 ─────────────────────────────────────────

@router.get("/reviews")
async def review_analysis(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """评价分析"""
    since = TODAY() - timedelta(days=days)

    avg_r = (await db.execute(
        select(func.avg(Review.rating)).where(Review.created_at >= since)
    )).scalar() or 0
    total_r = (await db.execute(
        select(func.count(Review.id)).where(Review.created_at >= since)
    )).scalar() or 0
    photo_r = (await db.execute(
        select(func.count(Review.id)).where(Review.created_at >= since, Review.has_photo == True)
    )).scalar() or 0

    # 评分分布
    dist = (await db.execute(
        select(Review.rating, func.count(Review.id))
        .where(Review.created_at >= since).group_by(Review.rating).order_by(Review.rating.desc())
    )).all()
    distribution = [{"rating": r[0], "count": r[1]} for r in dist]

    # 评价标签
    tag_rows = (await db.execute(
        select(Review.tags).where(Review.created_at >= since)
    )).scalars().all()
    tag_counter = {}
    for tags in tag_rows:
        if tags:
            for t in tags.split(", "):
                tag_counter[t] = tag_counter.get(t, 0) + 1
    top_tags = sorted(tag_counter.items(), key=lambda x: x[1], reverse=True)[:10]

    # 最新评价
    recent = (await db.execute(
        select(Review, NailStyle.name)
        .join(NailStyle, Review.style_id == NailStyle.id, isouter=True)
        .where(Review.created_at >= since)
        .order_by(desc(Review.created_at)).limit(10)
    )).all()
    recent_reviews = [{
        "rating": r[0].rating, "comment": r[0].comment,
        "tags": r[0].tags, "style": r[1] or "",
        "date": r[0].created_at.strftime("%m-%d %H:%M") if r[0].created_at else "",
    } for r in recent]

    return {"avg_rating": round(avg_r, 1), "total_reviews": total_r,
            "photo_review_pct": round(photo_r / max(total_r, 1) * 100, 1),
            "distribution": distribution,
            "top_tags": [{"tag": t[0], "count": t[1]} for t in top_tags],
            "recent_reviews": recent_reviews, "period_days": days}


# ── 流量分析 ─────────────────────────────────────────

@router.get("/traffic")
async def traffic_analysis(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """流量漏斗分析"""
    since = TODAY() - timedelta(days=days)
    rows = (await db.execute(
        select(TrafficMetrics).where(TrafficMetrics.date >= since).order_by(TrafficMetrics.date)
    )).scalars().all()

    data = [{
        "date": r.date.strftime("%m-%d"),
        "exposure": r.exposure, "click": r.click,
        "visit": r.visit, "order_conversion": r.order_conversion,
        "ctr": r.ctr, "cvr": r.cvr, "source": r.source,
    } for r in rows]

    totals = {
        "exposure": sum(d["exposure"] for d in data),
        "clicks": sum(d["click"] for d in data),
        "visits": sum(d["visit"] for d in data),
        "conversions": sum(d["order_conversion"] for d in data),
    }

    # 来源分布
    source_rows = (await db.execute(
        select(TrafficMetrics.source, func.sum(TrafficMetrics.exposure), func.sum(TrafficMetrics.order_conversion))
        .where(TrafficMetrics.date >= since).group_by(TrafficMetrics.source)
    )).all()
    sources = [{"source": s[0], "exposure": s[1] or 0, "conversions": s[2] or 0} for s in source_rows]

    return {"traffic": data, "totals": totals, "sources": sources, "period_days": days}


# ── 顾客分析 ─────────────────────────────────────────

@router.get("/customers")
async def customer_analysis(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """新老客分析"""
    since = TODAY() - timedelta(days=days)

    new_cnt = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since, Order.is_new_customer == True)
    )).scalar() or 0
    repeat_cnt = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since, Order.is_new_customer == False)
    )).scalar() or 0

    total = new_cnt + repeat_cnt
    new_pct = round(new_cnt / max(total, 1) * 100, 1)
    repeat_pct = round(repeat_cnt / max(total, 1) * 100, 1)

    # 每日新老客
    daily_rows = (await db.execute(
        select(DailyRevenue.date, DailyRevenue.new_customer_orders, DailyRevenue.repeat_customer_orders)
        .where(DailyRevenue.date >= since).order_by(DailyRevenue.date)
    )).all()
    daily = [{
        "date": d[0].strftime("%m-%d"),
        "new_customers": d[1] or 0, "repeat_customers": d[2] or 0,
    } for d in daily_rows]

    # 客单价
    new_aov = (await db.execute(
        select(func.avg(Order.amount)).where(Order.created_at >= since, Order.is_new_customer == True)
    )).scalar() or 0
    repeat_aov = (await db.execute(
        select(func.avg(Order.amount)).where(Order.created_at >= since, Order.is_new_customer == False)
    )).scalar() or 0

    return {
        "new_customer_count": new_cnt, "repeat_customer_count": repeat_cnt,
        "new_pct": new_pct, "repeat_pct": repeat_pct,
        "new_customer_aov": round(new_aov, 2), "repeat_customer_aov": round(repeat_aov, 2),
        "daily": daily, "period_days": days,
    }


# ── 优惠券分析 ─────────────────────────────────────────

@router.get("/coupons")
async def coupon_analysis(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """优惠券效果"""
    since = TODAY() - timedelta(days=days)
    rows = (await db.execute(
        select(CouponUsage).where(CouponUsage.date >= since).order_by(CouponUsage.date)
    )).scalars().all()

    data = [{
        "date": r.date.strftime("%m-%d"), "issued": r.issued,
        "used": r.used, "usage_rate": r.usage_rate,
        "discount_total": r.discount_total, "campaign": r.campaign,
    } for r in rows]

    totals = {
        "issued": sum(d["issued"] for d in data),
        "used": sum(d["used"] for d in data),
        "total_discount": sum(d["discount_total"] for d in data),
        "avg_usage_rate": round(sum(d["usage_rate"] for d in data) / max(len(data), 1), 1),
    }
    return {"coupons": data, "totals": totals, "period_days": days}


# ── 趋势（增强版：+营收、退款） ──────────────────────

@router.get("/trends")
async def trends(days: int = Query(7, ge=1, le=30), db: AsyncSession = Depends(get_db)):
    """N日趋势（试戴+浏览+收藏+营收）"""
    since = TODAY() - timedelta(days=days)

    # 款式指标聚合
    metrics_stmt = (
        select(
            StyleMetrics.date,
            func.sum(StyleMetrics.tryons), func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites), func.sum(StyleMetrics.orders),
            func.sum(StyleMetrics.refunds),
        )
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.date).order_by(StyleMetrics.date)
    )
    metric_rows = (await db.execute(metrics_stmt)).all()

    # 营收数据
    rev_rows = (await db.execute(
        select(DailyRevenue).where(DailyRevenue.date >= since).order_by(DailyRevenue.date)
    )).scalars().all()
    rev_map = {r.date.strftime("%Y-%m-%d"): r for r in rev_rows}

    trend_data = []
    for row in metric_rows:
        date_str = row[0].strftime("%Y-%m-%d") if row[0] else ""
        rev = rev_map.get(date_str)
        trend_data.append({
            "date": row[0].strftime("%m-%d") if row[0] else "",
            "tryons": row[1] or 0, "views": row[2] or 0,
            "favorites": row[3] or 0, "orders": row[4] or 0,
            "refunds": row[5] or 0,
            "revenue": rev.gross_revenue if rev else 0,
        })

    return {"trends": trend_data, "period_days": days}


# ── 热门款式（增加订单/退款/评价维度） ──────────────────

@router.get("/hot-styles")
async def hot_styles(limit: int = Query(10, ge=1, le=50), days: int = Query(7, ge=1, le=30),
                     db: AsyncSession = Depends(get_db)):
    """热门款式排行（多维度：试戴、订单、评价、退款率）"""
    from app.services.trend_analyzer import trend_analyzer

    since = TODAY() - timedelta(days=days)

    stmt = (
        select(
            StyleMetrics.style_id, NailStyle.name, NailStyle.category, NailStyle.price,
            func.sum(StyleMetrics.tryons), func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites), func.sum(StyleMetrics.orders),
            func.sum(StyleMetrics.refunds),
        )
        .join(NailStyle, NailStyle.id == StyleMetrics.style_id)
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.style_id, NailStyle.name, NailStyle.category, NailStyle.price)
    )
    rows = (await db.execute(stmt)).all()

    # 评价数据
    review_stmt = (
        select(Review.style_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.created_at >= since)
        .group_by(Review.style_id)
    )
    review_rows = (await db.execute(review_stmt)).all()
    review_map = {r[0]: {"avg_rating": round(r[1], 1) if r[1] else 0, "count": r[2]} for r in review_rows}

    current = []
    for row in rows:
        sid = row[0]
        orders = row[7] or 0
        refunds = row[8] or 0
        metrics = {"tryons": row[4] or 0, "views": row[5] or 0,
                   "favorites": row[6] or 0, "orders": orders, "refunds": refunds}
        hot_score = trend_analyzer.calc_hot_score(metrics)

        refund_rate = round(refunds / max(orders, 1) * 100, 1)
        rv = review_map.get(sid, {})

        current.append({
            "style_id": sid, "name": row[1], "category": row[2], "price": row[3] or 0,
            "tryons": metrics["tryons"], "views": metrics["views"],
            "favorites": metrics["favorites"], "orders": orders,
            "refund_rate": refund_rate, "hot_score": hot_score,
            "avg_rating": rv.get("avg_rating", 0), "review_count": rv.get("count", 0),
        })

    ranked = sorted(current, key=lambda x: x["hot_score"], reverse=True)[:limit]
    for i, item in enumerate(ranked):
        item["rank"] = i + 1

    return {"styles": ranked, "period_days": days}
