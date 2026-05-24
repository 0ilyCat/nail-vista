from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models.models import OperationsReport, StyleMetrics, NailStyle
from app.services.openclaw_service import longcat_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    type: str = "chat"


@router.post("/chat", response_model=ChatResponse)
async def operations_chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """与AI运营助手对话 — 调用LongCat"""
    # 构建上下文数据
    context = await _get_context(db)
    system_prompt = f"""你是美甲平台的AI运营助手。当前平台数据：
- 款式总数: {context['total_styles']}
- 今日试戴: {context['today_tryons']}
- 热门TOP3: {context['top_styles']}

请用中文简洁回答，给出数据驱动的建议。"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message},
    ]
    reply = await longcat_service.chat(messages)
    return ChatResponse(reply=reply)


@router.get("/reports")
async def list_reports(
    report_type: str = "daily",
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """运营报告列表"""
    stmt = (
        select(OperationsReport)
        .where(OperationsReport.report_type == report_type)
        .order_by(desc(OperationsReport.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()

    return {
        "reports": [
            {
                "id": r.id,
                "type": r.report_type,
                "content": r.content[:200] + "..." if len(r.content) > 200 else r.content,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in reports
        ],
        "total": len(reports),
    }


@router.get("/reports/{report_id}")
async def report_detail(report_id: int, db: AsyncSession = Depends(get_db)):
    """报告详情"""
    report = await db.get(OperationsReport, report_id)
    if not report:
        raise HTTPException(404, "报告不存在")
    return {
        "id": report.id,
        "type": report.report_type,
        "content": report.content,
        "metrics": report.metrics,
        "created_at": report.created_at.isoformat() if report.created_at else "",
    }


@router.post("/reports/generate")
async def generate_report(
    report_type: str = "daily",
    db: AsyncSession = Depends(get_db),
):
    """调用LongCat生成运营报告"""
    context = await _get_context(db)
    report_content = ""
    report_metrics = {}

    if report_type == "daily":
        report_content = await longcat_service.generate_daily_report(context)
        report_metrics = context
    elif report_type == "trend":
        trend_data = await _get_trend_data(db)
        report_content = await longcat_service.analyze_trends(trend_data)
        report_metrics = {"trend_data": trend_data}
    elif report_type == "strategy":
        report_content = await longcat_service.generate_strategy(context)
        report_metrics = context
    else:
        raise HTTPException(400, f"不支持的报告类型: {report_type}")

    report = OperationsReport(
        report_type=report_type,
        content=report_content,
        metrics=report_metrics,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {
        "id": report.id,
        "type": report.report_type,
        "content": report.content,
        "created_at": report.created_at.isoformat() if report.created_at else "",
    }


async def _get_context(db: AsyncSession) -> dict:
    """获取运营上下文"""
    total_styles = (await db.execute(select(func.count(NailStyle.id)))).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_tryons = (await db.execute(
        select(func.sum(StyleMetrics.tryons)).where(StyleMetrics.date == today)
    )).scalar() or 0

    top_stmt = (
        select(NailStyle.name, func.sum(StyleMetrics.tryons))
        .join(StyleMetrics, StyleMetrics.style_id == NailStyle.id)
        .where(StyleMetrics.date >= today - timedelta(days=7))
        .group_by(NailStyle.name)
        .order_by(desc(func.sum(StyleMetrics.tryons)))
        .limit(3)
    )
    top_result = await db.execute(top_stmt)
    top_styles = [f"{r[0]}({r[1]}次)" for r in top_result.all()]

    return {
        "total_styles": total_styles,
        "today_tryons": today_tryons,
        "top_styles": ", ".join(top_styles) if top_styles else "暂无",
    }


async def _get_trend_data(db: AsyncSession) -> list[dict]:
    """获取趋势数据"""
    since = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
    stmt = (
        select(
            StyleMetrics.date,
            func.sum(StyleMetrics.tryons),
            func.sum(StyleMetrics.views),
            func.sum(StyleMetrics.favorites),
        )
        .where(StyleMetrics.date >= since)
        .group_by(StyleMetrics.date)
        .order_by(StyleMetrics.date)
    )
    result = await db.execute(stmt)
    return [
        {"date": r[0].strftime("%m-%d"), "tryons": r[1] or 0, "views": r[2] or 0, "favorites": r[3] or 0}
        for r in result.all()
    ]


# ── NL2SQL / ChatBI endpoints ────────────────────────────

class ExecuteSQLRequest(BaseModel):
    sql: str
    confirm: bool = False  # User must confirm to execute

class NL2SQLRequest(BaseModel):
    question: str  # Natural language query

SAFE_TABLES = {
    "nail_styles", "style_metrics", "tryon_records", "hand_images",
    "orders", "refunds", "reviews", "daily_revenue",
    "traffic_metrics", "coupon_usage", "operations_reports", "user_feedback",
}


@router.post("/execute-sql")
async def execute_sql(req: ExecuteSQLRequest, db: AsyncSession = Depends(get_db)):
    """
    执行 SQL 查询（仅 SELECT，白名单表）。
    支持 ChatBI 流程：NL → SQL → 确认 → 执行 → 数据 + 图表。
    """
    sql = req.sql.strip()

    # Security: only allow SELECT
    if not sql.upper().startswith("SELECT"):
        raise HTTPException(400, "仅支持 SELECT 查询")

    # Check white-listed tables
    sql_upper = sql.upper()
    for table in SAFE_TABLES:
        sql_upper = sql_upper.replace(table.upper(), "")
    # Remove common SQL keywords
    for kw in ["SELECT", "FROM", "WHERE", "JOIN", "GROUP BY", "ORDER BY",
               "LIMIT", "HAVING", "COUNT", "SUM", "AVG", "MAX", "MIN",
               "LEFT JOIN", "INNER JOIN", "ON", "AND", "OR", "AS",
               "DESC", "ASC", "LIKE", "IN", "BETWEEN", "NOT", "NULL",
               "DISTINCT", "COALESCE", "CASE", "WHEN", "THEN", "ELSE", "END"]:
        sql_upper = sql_upper.replace(kw, "")
    # If any non-whitelisted identifier-like tokens remain, reject
    remaining = [t for t in sql_upper.split() if t and t not in ('', ',', '.', '(', ')', '*', '+', '-', '/', '=', '<', '>', '!', ';', '%', '||')]
    # Simple check: if there are suspicious words
    suspicious = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "EXEC", "EXECUTE"]
    for s in suspicious:
        if s in sql.upper():
            raise HTTPException(400, f"禁止的操作: {s}")

    if not req.confirm:
        return {"status": "preview", "sql": sql, "message": "SQL 已生成，请确认后执行。发送 confirm=true 确认执行。"}

    try:
        # Use raw connection for SQL execution (SQLite compatibility)
        from sqlalchemy import text as sa_text
        result = await db.execute(sa_text(sql))
        rows = result.all()

        # Convert to list of dicts
        columns = list(result.keys())
        data = []
        for row in rows:
            data.append({columns[i]: (str(row[i]) if row[i] is not None else None) for i in range(len(columns))})

        # Limit to 100 rows
        if len(data) > 100:
            data = data[:100]

        return {
            "status": "executed",
            "columns": columns,
            "data": data,
            "row_count": len(data),
            "sql_executed": sql,
        }
    except Exception as e:
        raise HTTPException(400, f"SQL 执行错误: {str(e)}")


@router.post("/nl2sql")
async def nl2sql(req: NL2SQLRequest, db: AsyncSession = Depends(get_db)):
    """
    自然语言→SQL 生成。
    返回生成的 SQL 供用户确认，确认后调用 /execute-sql 执行。
    """
    import httpx
    from app.core.config import get_settings

    settings = get_settings()

    # Build NL2SQL prompt with table schema
    schema = """
-- nail_styles: id, name, category, color_tone, tags, description, popularity, price, original_url, enhanced_url, created_at
-- style_metrics: id, style_id, date, views, tryons, favorites, shares, orders, refunds, avg_duration, hot_score
-- tryon_records: id, hand_image_id, nail_style_id, result_url, duration_ms, created_at
-- hand_images: id, image_url, local_path, skin_tone, hand_type, landmarks, created_at
-- orders: id, order_no, style_id, user_id, amount, original_amount, coupon_discount, status, payment_method, is_new_customer, created_at
-- refunds: id, order_id, amount, reason, status, created_at
-- reviews: id, order_id, style_id, user_id, rating, tags, comment, has_photo, created_at
-- daily_revenue: id, date, gross_revenue, net_revenue, order_count, refund_amount, refund_count, new_customer_orders, repeat_customer_orders, coupon_discount_total, avg_order_value
-- traffic_metrics: id, date, exposure, click, visit, order_conversion, ctr, cvr, source
-- coupon_usage: id, date, issued, used, discount_total, usage_rate, campaign
"""

    prompt = f"""你是 SQL 专家。根据以下数据库 schema 和用户问题，生成一条 SELECT 查询。

{schema}

用户问题: {req.question}

要求:
1. 只生成 SELECT 语句，不要任何其他内容
2. 使用中文列别名（AS）
3. 限制返回行数 LIMIT 50
4. 只使用白名单表

SQL:"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OPENCLAW_BASE_URL}/v1/chat/completions",
                json={
                    "model": "xiaomi-coding/mimo-v2.5-pro",
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}",
                },
            )
            if resp.status_code != 200:
                raise HTTPException(502, f"AI 服务错误: {resp.status_code}")

            data = resp.json()
            sql = data["choices"][0]["message"]["content"].strip()

            # Clean up SQL (remove markdown formatting)
            sql = sql.replace("```sql", "").replace("```", "").strip()
            if not sql.upper().startswith("SELECT"):
                # Try to extract SELECT statement
                import re
                match = re.search(r'SELECT[\s\S]*?(?:;|$)', sql, re.IGNORECASE)
                if match:
                    sql = match.group(0).strip()

            return {
                "status": "generated",
                "sql": sql,
                "question": req.question,
                "hint": "请检查 SQL 是否正确。确认后调用 POST /api/operations/execute-sql 执行。",
            }
    except httpx.ConnectError:
        raise HTTPException(503, "AI 服务不可用")
    except Exception as e:
        raise HTTPException(500, f"SQL 生成失败: {str(e)}")
