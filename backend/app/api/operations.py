from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
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
