from fastapi import APIRouter

router = APIRouter()


@router.get("/overview")
async def analytics_overview():
    """运营总览数据"""
    return {
        "total_styles": 25,
        "total_tryons": 0,
        "total_views": 0,
        "avg_conversion": 0.0,
    }


@router.get("/trends")
async def trends(days: int = 7):
    """趋势数据"""
    return {"trends": [], "period": f"{days}d"}


@router.get("/hot-styles")
async def hot_styles(limit: int = 10):
    """热门款式"""
    return {"styles": []}
