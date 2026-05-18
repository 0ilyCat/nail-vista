from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def list_styles(category: str = "", page: int = 1, size: int = 20):
    """款式列表"""
    return {"items": [], "total": 0, "page": page}


@router.get("/{style_id}")
async def style_detail(style_id: int):
    """款式详情"""
    return {"id": style_id, "name": ""}


@router.get("/hot/ranking")
async def hot_ranking(limit: int = 10):
    """热门排行"""
    return {"ranking": []}
