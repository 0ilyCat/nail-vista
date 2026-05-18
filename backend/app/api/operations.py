from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def operations_chat(message: str = ""):
    """与OpenClaw AI运营助手对话"""
    return {"reply": f"AI助手已收到：{message}", "type": "chat"}


@router.get("/reports")
async def list_reports(report_type: str = "daily", limit: int = 10):
    """运营报告列表"""
    return {"reports": [], "total": 0}


@router.get("/reports/{report_id}")
async def report_detail(report_id: int):
    """报告详情"""
    return {"id": report_id, "content": ""}
