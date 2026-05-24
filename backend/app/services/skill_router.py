"""
Skill Router — detects user intent, executes backend APIs internally, injects context for OpenClaw.

Architecture:
  User Message -> detect_skill() -> execute_skill_internal() -> format_skill_context() -> OpenClaw
"""
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.models.models import (
    NailStyle, StyleMetrics, TryonRecord,
    Order, Refund, Review, DailyRevenue, TrafficMetrics, CouponUsage,
)


# -- Skill definitions (extended with Meituan-style metrics) --------

SKILLS = {
    # ---- User side ----
    "nail-style-search": {
        "agent": "user",
        "keywords": ["搜索", "查找", "有没有", "找", "什么款式",
                     "法式", "渐变", "纯色", "猫眼", "闪粉",
                     "红色", "粉色", "蓝色", "白色", "黑色", "绿色", "紫色", "金色"],
        "description": "美甲款式搜索",
    },
    "nail-style-recommend": {
        "agent": "user",
        "keywords": ["推荐", "适合", "建议", "怎么搭配", "场合", "肤色",
                     "手型", "约会", "通勤", "派对", "日常", "婚礼",
                     "显白", "显手长"],
        "description": "美甲款式智能推荐",
    },
    "nail-categories": {
        "agent": "user",
        "keywords": ["分类", "类型", "有哪些种类", "所有类型"],
        "description": "美甲分类列表",
    },

    # ---- Dashboard / operations side (Meituan-style) ----
    "ops-overview": {
        "agent": "dashboard",
        "keywords": ["概览", "今天数据", "今日数据", "运营数据", "总览",
                     "今天怎么样", "数据怎么样", "整体情况", "概况",
                     "日报", "今天", "生意怎么样"],
        "description": "运营概览数据",
    },
    "ops-revenue": {
        "agent": "dashboard",
        "keywords": ["营收", "收入", "销售额", "GMV", "赚了", "卖了多少",
                     "营业额", "流水", "客单价", "毛利率"],
        "description": "营收分析",
    },
    "ops-refunds": {
        "agent": "dashboard",
        "keywords": ["退款", "退单", "退货", "退款率", "退款原因", "为什么退款"],
        "description": "退款分析",
    },
    "ops-reviews": {
        "agent": "dashboard",
        "keywords": ["评价", "评分", "好评", "差评", "口碑", "用户评价",
                     "顾客怎么说", "反馈", "星级"],
        "description": "评价分析",
    },
    "ops-customers": {
        "agent": "dashboard",
        "keywords": ["顾客", "客户", "新客", "老客", "复购", "留存",
                     "客户分析", "新老客", "回头客"],
        "description": "顾客分析",
    },
    "ops-traffic": {
        "agent": "dashboard",
        "keywords": ["流量", "曝光", "点击", "转化", "漏斗",
                     "进店", "浏览", "流量来源"],
        "description": "流量分析",
    },
    "ops-hot-styles": {
        "agent": "dashboard",
        "keywords": ["热门", "排行", "TOP", "最火", "热度", "排名",
                     "什么款式最火", "热榜", "哪款最受欢迎"],
        "description": "热门款式排行",
    },
    "ops-trends": {
        "agent": "dashboard",
        "keywords": ["趋势", "走势", "最近几天", "变化", "增长",
                     "下降", "波动", "曲线", "近7天", "近30天",
                     "最近7天", "最近30天"],
        "description": "趋势数据分析",
    },
    "ops-coupons": {
        "agent": "dashboard",
        "keywords": ["优惠券", "券", "折扣", "促销", "活动效果",
                     "核销", "发券"],
        "description": "优惠券分析",
    },
}


async def detect_skill(message: str, agent_type: str) -> Optional[dict]:
    """Detect which skill to use based on message keywords."""
    msg_lower = message.lower()
    best_score = 0
    best_skill = None

    for name, skill in SKILLS.items():
        if skill["agent"] != agent_type:
            continue
        score = 0
        for kw in skill["keywords"]:
            if kw.lower() in msg_lower:
                score += 1
        if score > best_score:
            best_score = score
            best_skill = (name, skill)

    if best_skill and best_score >= 1:
        return {"name": best_skill[0], **best_skill[1]}
    return None


# -- Internal query functions ------------------------------------

TODAY = lambda: datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


async def _get_overview(db: AsyncSession) -> dict:
    today = TODAY()
    yesterday = today - timedelta(days=1)

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
    refund_cnt = today_rev.refund_count if today_rev else 0

    tryon_change = 0
    if yesterday_tryons > 0:
        tryon_change = round((today_tryons - yesterday_tryons) / yesterday_tryons * 100, 1)
    rev_change = 0
    if yest_rev and yest_rev.gross_revenue > 0:
        rev_change = round((gross - yest_rev.gross_revenue) / yest_rev.gross_revenue * 100, 1)

    avg_r = (await db.execute(
        select(func.avg(Review.rating)).where(Review.created_at >= today)
    )).scalar() or 0
    review_count = (await db.execute(
        select(func.count(Review.id)).where(Review.created_at >= today)
    )).scalar() or 0

    today_traffic = (await db.execute(
        select(TrafficMetrics).where(TrafficMetrics.date == today)
    )).scalar()

    return {
        "total_styles": total_styles, "total_tryons": total_tryons,
        "today_tryons": today_tryons, "yesterday_tryons": yesterday_tryons,
        "tryon_change_pct": tryon_change,
        "today_revenue": gross, "today_orders": orders_today,
        "avg_order_value": aov, "refund_amount": refund_amt,
        "refund_count": refund_cnt, "revenue_change_pct": rev_change,
        "avg_rating": round(avg_r, 1), "review_count": review_count,
        "exposure": today_traffic.exposure if today_traffic else 0,
        "clicks": today_traffic.click if today_traffic else 0,
        "cvr": today_traffic.cvr if today_traffic else 0,
    }


async def _get_revenue(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    rows = (await db.execute(
        select(DailyRevenue).where(DailyRevenue.date >= since).order_by(DailyRevenue.date)
    )).scalars().all()
    return {
        "revenue": [{ "date": r.date.strftime("%m-%d"), "gross": r.gross_revenue,
                      "net": r.net_revenue, "orders": r.order_count,
                      "refund": r.refund_amount, "aov": r.avg_order_value } for r in rows],
        "period_days": days,
    }


async def _get_refunds(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    total_orders = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since)
    )).scalar() or 1
    total_refunds = (await db.execute(
        select(func.count(Refund.id)).where(Refund.created_at >= since)
    )).scalar() or 0
    refund_rate = round(total_refunds / total_orders * 100, 2)

    reasons = [{"reason": r[0], "count": r[1]} for r in (await db.execute(
        select(Refund.reason, func.count(Refund.id))
        .where(Refund.created_at >= since).group_by(Refund.reason).order_by(desc(func.count(Refund.id)))
    )).all()]

    return {"total_refunds": total_refunds, "refund_rate": refund_rate,
            "reasons": reasons, "period_days": days}


async def _get_reviews(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    avg_r = (await db.execute(
        select(func.avg(Review.rating)).where(Review.created_at >= since)
    )).scalar() or 0
    total_r = (await db.execute(
        select(func.count(Review.id)).where(Review.created_at >= since)
    )).scalar() or 0

    dist = [{"rating": r[0], "count": r[1]} for r in (await db.execute(
        select(Review.rating, func.count(Review.id))
        .where(Review.created_at >= since).group_by(Review.rating).order_by(Review.rating.desc())
    )).all()]

    # Top tags
    tag_rows = (await db.execute(
        select(Review.tags).where(Review.created_at >= since)
    )).scalars().all()
    tag_counter = {}
    for tags in tag_rows:
        if tags:
            for t in tags.split(", "):
                tag_counter[t] = tag_counter.get(t, 0) + 1
    top_tags = sorted(tag_counter.items(), key=lambda x: x[1], reverse=True)[:8]

    return {"avg_rating": round(avg_r, 1), "total_reviews": total_r,
            "distribution": dist, "top_tags": [{"tag": t[0], "count": t[1]} for t in top_tags],
            "period_days": days}


async def _get_customers(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    new_cnt = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since, Order.is_new_customer == True)
    )).scalar() or 0
    repeat_cnt = (await db.execute(
        select(func.count(Order.id)).where(Order.created_at >= since, Order.is_new_customer == False)
    )).scalar() or 0
    total = max(new_cnt + repeat_cnt, 1)
    return {
        "new_customers": new_cnt, "repeat_customers": repeat_cnt,
        "new_pct": round(new_cnt / total * 100, 1),
        "repeat_pct": round(repeat_cnt / total * 100, 1),
        "period_days": days,
    }


async def _get_traffic(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    rows = (await db.execute(
        select(TrafficMetrics).where(TrafficMetrics.date >= since).order_by(TrafficMetrics.date)
    )).scalars().all()
    data = [{"date": r.date.strftime("%m-%d"), "exposure": r.exposure, "click": r.click,
             "visit": r.visit, "conversion": r.order_conversion, "ctr": r.ctr, "cvr": r.cvr} for r in rows]
    return {"traffic": data, "period_days": days}


async def _get_coupons(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    rows = (await db.execute(
        select(CouponUsage).where(CouponUsage.date >= since).order_by(CouponUsage.date)
    )).scalars().all()
    data = [{"date": r.date.strftime("%m-%d"), "issued": r.issued, "used": r.used,
             "usage_rate": r.usage_rate, "discount_total": r.discount_total,
             "campaign": r.campaign} for r in rows]
    totals = {"issued": sum(d["issued"] for d in data), "used": sum(d["used"] for d in data),
              "avg_usage_rate": round(sum(d["usage_rate"] for d in data) / max(len(data), 1), 1)}
    return {"coupons": data, "totals": totals, "period_days": days}


async def _get_styles(db: AsyncSession, search: str = "", category: str = "",
                      sort: str = "popular", size: int = 8) -> dict:
    stmt = select(NailStyle)
    if category: stmt = stmt.where(NailStyle.category == category)
    if search: stmt = stmt.where(NailStyle.name.contains(search))
    if sort == "popular": stmt = stmt.order_by(desc(NailStyle.popularity))
    elif sort == "name": stmt = stmt.order_by(NailStyle.name)
    else: stmt = stmt.order_by(desc(NailStyle.created_at))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.limit(size)
    result = await db.execute(stmt)
    styles = result.scalars().all()

    today = TODAY()
    items = []
    for s in styles:
        today_tryons = (await db.execute(
            select(func.coalesce(func.sum(StyleMetrics.tryons), 0))
            .where(StyleMetrics.style_id == s.id, StyleMetrics.date == today)
        )).scalar() or 0
        items.append({
            "id": s.id, "name": s.name, "category": s.category,
            "color_tone": s.color_tone, "tags": s.tags or [],
            "description": s.description, "popularity": s.popularity,
            "price": s.price, "today_tryons": today_tryons,
        })
    return {"items": items, "total": total}


async def _get_categories(db: AsyncSession) -> dict:
    stmt = select(NailStyle.category, func.count(NailStyle.id)).group_by(NailStyle.category)
    rows = (await db.execute(stmt)).all()
    return {"categories": [{"name": r[0], "count": r[1]} for r in rows if r[0]]}


async def _get_hot_styles(db: AsyncSession, limit: int = 10, days: int = 7) -> dict:
    from app.services.trend_analyzer import trend_analyzer
    since = TODAY() - timedelta(days=days)

    rows = (await db.execute(
        select(
            StyleMetrics.style_id, NailStyle.name, NailStyle.category, NailStyle.price,
            func.sum(StyleMetrics.tryons), func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites), func.sum(StyleMetrics.orders),
            func.sum(StyleMetrics.refunds),
        )
        .join(NailStyle, NailStyle.id == StyleMetrics.style_id)
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.style_id, NailStyle.name, NailStyle.category, NailStyle.price)
    )).all()

    # Review data
    review_rows = (await db.execute(
        select(Review.style_id, func.avg(Review.rating), func.count(Review.id))
        .where(Review.created_at >= since).group_by(Review.style_id)
    )).all()
    review_map = {r[0]: {"avg_rating": round(r[1], 1) if r[1] else 0, "count": r[2]} for r in review_rows}

    current = []
    for row in rows:
        sid, orders, refunds = row[0], row[7] or 0, row[8] or 0
        metrics = {"tryons": row[4] or 0, "views": row[5] or 0, "favorites": row[6] or 0,
                   "orders": orders, "refunds": refunds}
        hot_score = trend_analyzer.calc_hot_score(metrics)
        rv = review_map.get(sid, {})
        current.append({
            "style_id": sid, "name": row[1], "category": row[2], "price": row[3] or 0,
            "tryons": metrics["tryons"], "views": metrics["views"],
            "favorites": metrics["favorites"], "orders": orders,
            "refund_rate": round(refunds / max(orders, 1) * 100, 1),
            "hot_score": hot_score,
            "avg_rating": rv.get("avg_rating", 0), "review_count": rv.get("count", 0),
        })

    ranked = sorted(current, key=lambda x: x["hot_score"], reverse=True)[:limit]
    for i, item in enumerate(ranked):
        item["rank"] = i + 1
    return {"styles": ranked, "period_days": days}


async def _get_trends(db: AsyncSession, days: int = 7) -> dict:
    since = TODAY() - timedelta(days=days)
    metric_rows = (await db.execute(
        select(
            StyleMetrics.date,
            func.sum(StyleMetrics.tryons), func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites), func.sum(StyleMetrics.orders),
            func.sum(StyleMetrics.refunds),
        )
        .where(StyleMetrics.date >= since).group_by(StyleMetrics.date).order_by(StyleMetrics.date)
    )).all()

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


# -- Execute skill (router) -----------------------------------

async def execute_skill(skill: dict, message: str, db: AsyncSession) -> dict:
    try:
        skill_name = skill["name"]

        if skill_name == "ops-overview":
            data = await _get_overview(db)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-revenue":
            days = _extract_days(message)
            data = await _get_revenue(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-refunds":
            days = _extract_days(message)
            data = await _get_refunds(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-reviews":
            days = _extract_days(message)
            data = await _get_reviews(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-customers":
            days = _extract_days(message)
            data = await _get_customers(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-traffic":
            days = _extract_days(message)
            data = await _get_traffic(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-coupons":
            days = _extract_days(message)
            data = await _get_coupons(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-hot-styles":
            days = _extract_days(message)
            data = await _get_hot_styles(db, limit=10, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "ops-trends":
            days = _extract_days(message)
            data = await _get_trends(db, days=days)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name in ("nail-style-search", "nail-style-recommend"):
            sort = "popular"
            if "最新" in message: sort = "newest"
            if "名称" in message: sort = "name"
            if skill_name == "nail-style-recommend":
                data = await _get_styles(db, search="", sort=sort, size=8)
            else:
                style_keywords = [
                    "法式", "渐变", "纯色", "猫眼", "闪粉", "手绘", "晕染",
                    "红色", "粉色", "蓝色", "白色", "黑色", "绿色", "紫色", "金色",
                    "裸色", "豆沙", "蜜桃", "樱花", "星空", "马卡龙",
                ]
                search = ""
                for kw in style_keywords:
                    if kw in message:
                        search = kw
                        break
                data = await _get_styles(db, search=search, sort=sort, size=8)
            return {"skill": skill_name, "success": True, "data": data}

        elif skill_name == "nail-categories":
            data = await _get_categories(db)
            return {"skill": skill_name, "success": True, "data": data}

        else:
            return {"skill": skill_name, "success": False, "error": f"Unknown skill: {skill_name}"}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"skill": skill.get("name", "?"), "success": False, "error": str(e)}


def _extract_days(message: str) -> int:
    if "30" in message or "三十" in message or "月" in message: return 30
    if "14" in message or "两周" in message: return 14
    return 7


# -- Format context for AI -----------------------------------

def format_skill_context(skill_result: dict, skill_name: str) -> str:
    if not skill_result.get("success"):
        return "[后端数据查询失败，请基于你的知识回复用户]"

    data = skill_result["data"]

    # === OPS OVERVIEW (enhanced) ===
    if skill_name == "ops-overview":
        o = data
        return f"""📊 今日运营概览（后端实时查询，非虚构）：

**试戴数据**
- 款式总数: {o.get('total_styles', 0)} 款
- 今日试戴: {o.get('today_tryons', 0)} 次（昨日 {o.get('yesterday_tryons', 0)} 次，环比 {o.get('tryon_change_pct', '+0' if o.get('tryon_change_pct',0)>=0 else '')}{o.get('tryon_change_pct', 0)}%）
- 累计试戴: {o.get('total_tryons', 0)} 次

**营收数据**
- 今日营收: ¥{o.get('today_revenue', 0):.0f}（环比 {o.get('revenue_change_pct', '+0' if o.get('revenue_change_pct',0)>=0 else '')}{o.get('revenue_change_pct', 0)}%）
- 今日订单: {o.get('today_orders', 0)} 单
- 客单价: ¥{o.get('avg_order_value', 0):.0f}
- 今日退款: ¥{o.get('refund_amount', 0):.0f}（{o.get('refund_count', 0)} 单）

**口碑数据**
- 今日评分: {o.get('avg_rating', 0)} ⭐（{o.get('review_count', 0)} 条评价）

**流量漏斗**
- 曝光 {o.get('exposure', 0)} → 点击 {o.get('clicks', 0)} → 转化率 {o.get('cvr', 0)}%

请用 Markdown 表格按"试戴 / 营收 / 口碑 / 流量"四个维度分组展示以上数据。
然后在表格下方生成一张柱状图:
```chart
{{"type": "bar", "title": "今日运营核心指标",
  "xAxis": ["款式数", "今日试戴", "今日订单", "今日营收(百元)", "评分(×10)"],
  "series": [{{"name": "数值", "data": [{o.get('total_styles',0)}, {o.get('today_tryons',0)}, {o.get('today_orders',0)}, {int(o.get('today_revenue',0)/100)}, {int(o.get('avg_rating',0)*10)}]}}]
}}
```
最后给出 3 条运营建议（标注优先级: ⚠️紧急 / 📌重要 / 💡建议）。"""

    # === OPS REVENUE ===
    elif skill_name == "ops-revenue":
        rev = data.get("revenue", [])
        lines = [f"💰 {data.get('period_days', 7)}日营收数据:"]
        for r in rev:
            lines.append(f"{r['date']}: 营收 ¥{r['gross']:.0f}, 净营收 ¥{r['net']:.0f}, {r['orders']}单, 退款 ¥{r['refund']:.0f}, 客单价 ¥{r['aov']:.0f}")
        dates = json.dumps([r["date"] for r in rev], ensure_ascii=False)
        grosses = json.dumps([r["gross"] for r in rev])
        orders = json.dumps([r["orders"] for r in rev])
        lines.append(f"""
请用 Markdown 表格展示每日营收趋势，并生成图表:
```chart
{{"type": "line", "title": "近{data.get('period_days',7)}天营收趋势",
 "xAxis": {dates},
 "series": [{{"name": "营收(元)", "data": {grosses}}}, {{"name": "订单数", "data": {orders}}}]}}
```
分析营收趋势，找出波峰波谷原因，给出提升营收的建议。""")
        return "\n".join(lines)

    # === OPS REFUNDS ===
    elif skill_name == "ops-refunds":
        d = data
        reasons_str = json.dumps([r["reason"][:6] for r in d.get("reasons", [])], ensure_ascii=False)
        counts = json.dumps([r["count"] for r in d.get("reasons", [])])
        lines = [f"""🔄 退款分析（{d.get('period_days', 7)}天）:
- 退款率: {d.get('refund_rate', 0)}%（共 {d.get('total_refunds', 0)} 单）
- 主要退款原因:"""]
        for r in d.get("reasons", [])[:5]:
            lines.append(f"  · {r['reason']}: {r['count']} 单")
        lines.append(f"""
请分析退款原因，并生成饼图:
```chart
{{"type": "pie", "title": "退款原因分布",
 "xAxis": {reasons_str},
 "series": [{{"name": "退款单数", "data": {counts}}}]}}
```
给出降低退款率的运营建议。""")
        return "\n".join(lines)

    # === OPS REVIEWS ===
    elif skill_name == "ops-reviews":
        d = data
        dist_labels = json.dumps([f"{r['rating']}星" for r in d.get("distribution", [])], ensure_ascii=False)
        dist_counts = json.dumps([r["count"] for r in d.get("distribution", [])])
        tags_str = ", ".join(f"{t['tag']}({t['count']})" for t in d.get("top_tags", [])[:5])
        lines = [f"""⭐ 评价分析（{d.get('period_days', 7)}天）:
- 平均评分: {d.get('avg_rating', 0)} ⭐（{d.get('total_reviews', 0)} 条评价）
- 带图评价: {d.get('photo_review_pct', 0)}%
- 热门标签: {tags_str}"""]
        lines.append(f"""
请用 Markdown 表格展示评分分布，并生成柱状图:
```chart
{{"type": "bar", "title": "评分分布",
 "xAxis": {dist_labels},
 "series": [{{"name": "评价数", "data": {dist_counts}}}]}}
```
分析顾客满意度，给出提升评分的建议。""")
        return "\n".join(lines)

    # === OPS CUSTOMERS ===
    elif skill_name == "ops-customers":
        d = data
        return f"""👥 顾客分析（{d.get('period_days', 7)}天）:
- 新客: {d.get('new_customers', 0)} 单（{d.get('new_pct', 0)}%）
- 老客: {d.get('repeat_customers', 0)} 单（{d.get('repeat_pct', 0)}%）

请生成对比饼图展示新老客占比:
```chart
{{"type": "pie", "title": "新老客占比",
 "xAxis": ["新客", "老客"],
 "series": [{{"name": "订单数", "data": [{d.get('new_customers',0)}, {d.get('repeat_customers',0)}]}}]}}
```
分析新老客结构，给出拉新和促活的建议。"""

    # === OPS TRAFFIC ===
    elif skill_name == "ops-traffic":
        d = data
        tf = d.get("traffic", [])
        dates = json.dumps([t["date"] for t in tf], ensure_ascii=False)
        exposures = json.dumps([t["exposure"] for t in tf])
        conversions = json.dumps([t["conversion"] for t in tf])
        lines = [f"📈 流量分析（{d.get('period_days', 7)}天）:"]
        for t in tf:
            lines.append(f"{t['date']}: 曝光 {t['exposure']} → 点击 {t['click']} → 转化 {t['conversion']} (CTR {t['ctr']}% CVR {t['cvr']}%)")
        lines.append(f"""
请分析流量漏斗，并生成双轴图:
```chart
{{"type": "line", "title": "曝光量 & 转化数趋势",
 "xAxis": {dates},
 "series": [{{"name": "曝光量", "data": {exposures}}}, {{"name": "转化数", "data": {conversions}}}]}}
```
给出提升曝光和转化率的建议。""")
        return "\n".join(lines)

    # === OPS HOT STYLES ===
    elif skill_name == "ops-hot-styles":
        styles = data.get("styles", [])[:10]
        lines = [f"🔥 热门款式 TOP {len(styles)} ({data.get('period_days', 7)}天，含订单/评价/退款率):"]
        names, tryons, orders_list, hot_scores = [], [], [], []
        for s in styles:
            lines.append(
                f"{s['rank']}. {s['name']} [{s.get('category', '')}] ¥{s.get('price', 0)} — "
                f"试戴 {s['tryons']} | 订单 {s['orders']} | 退款率 {s.get('refund_rate', 0)}% "
                f"| ⭐{s.get('avg_rating', 0)} | 热度 {s['hot_score']:.1f}"
            )
            names.append(s['name'])
            tryons.append(s['tryons'])
            orders_list.append(s['orders'])
            hot_scores.append(s['hot_score'])

        lines.append(f"""
请在 Markdown 表格中展示排行（含价格、订单、退款率、评分），并生成图表:
```chart
{{"type": "bar", "title": "热门款式多维度对比",
 "xAxis": {json.dumps(names, ensure_ascii=False)},
 "series": [
   {{"name": "试戴次数", "data": {json.dumps(tryons)}}},
   {{"name": "订单数", "data": {json.dumps(orders_list)}}},
   {{"name": "热度分", "data": {json.dumps(hot_scores)}}}
 ]}}
```
分析 TOP3 热门原因（从价格、评价、退款率角度）。""")
        return "\n".join(lines)

    # === OPS TRENDS ===
    elif skill_name == "ops-trends":
        trends = data.get("trends", [])
        lines = [f"📈 {data.get('period_days', 7)}日趋势数据（试戴+订单+营收）:"]
        for t in trends:
            lines.append(
                f"{t['date']}: 试戴 {t['tryons']} | 订单 {t['orders']} | 退款 {t['refunds']} | 营收 ¥{t.get('revenue', 0):.0f}"
            )
        lines.append(f"""
请分析趋势，并生成 ECharts 折线图:
```chart
{{"type": "line", "title": "近{data.get('period_days',7)}天核心指标趋势",
 "xAxis": {json.dumps([t['date'] for t in trends])},
 "series": [
   {{"name": "试戴量", "data": {json.dumps([t['tryons'] for t in trends])}}},
   {{"name": "订单量", "data": {json.dumps([t['orders'] for t in trends])}}},
   {{"name": "退款量", "data": {json.dumps([t['refunds'] for t in trends])}}}
 ]}}
```
给出数据洞察和运营建议（标注 ⚠️/📌/💡 优先级）。""")
        return "\n".join(lines)

    # === OPS COUPONS ===
    elif skill_name == "ops-coupons":
        d = data
        cp = d.get("coupons", [])
        dates = json.dumps([c["date"] for c in cp], ensure_ascii=False)
        issued = json.dumps([c["issued"] for c in cp])
        used = json.dumps([c["used"] for c in cp])
        lines = [f"🎫 优惠券效果（{d.get('period_days', 7)}天）:"]
        for c in cp:
            lines.append(f"{c['date']}: 发放 {c['issued']} → 核销 {c['used']} (核销率 {c['usage_rate']}%) — {c['campaign']}")
        lines.append(f"""
请分析优惠券核销效果，并生成图表:
```chart
{{"type": "line", "title": "优惠券发放 & 核销趋势",
 "xAxis": {dates},
 "series": [{{"name": "发放量", "data": {issued}}}, {{"name": "核销量", "data": {used}}}]}}
```
给出优化发券策略的建议。""")
        return "\n".join(lines)

    # === NAIL STYLES ===
    elif skill_name in ("nail-style-search", "nail-style-recommend"):
        items = data.get("items", [])
        total = data.get("total", 0)
        prefix = "搜索结果" if skill_name == "nail-style-search" else "热门款式推荐"
        lines = [f"💅 {prefix} (共 {total} 款，后端实时查询):"]
        for s in items:
            lines.append(
                f"- {s['name']} [{s.get('category', '')}] ¥{s.get('price', 'N/A')} "
                f"| 热度: {s.get('popularity', 0)} | 今日试戴: {s.get('today_tryons', 0)}"
            )
        if skill_name == "nail-style-recommend":
            lines.append("\n请根据用户的偏好和场景，推荐最合适的2-3款并说明推荐理由（场合/肤色/季节/价格）。")
        else:
            lines.append("\n请用友好的方式介绍这些款式，用 Markdown 表格展示，推荐前3款。")
        return "\n".join(lines)

    elif skill_name == "nail-categories":
        cats = data.get("categories", [])
        lines = [f"📂 美甲分类 (共 {len(cats)} 类):"]
        for c in cats:
            lines.append(f"- {c['name']}: {c['count']} 款")
        lines.append("\n请用友好方式向用户介绍分类，并询问想看哪一类。")
        return "\n".join(lines)

    return f"查询成功。数据: {json.dumps(data, ensure_ascii=False)}"
