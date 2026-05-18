from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

router = APIRouter()


@router.post("/upload-hand")
async def upload_hand(file: UploadFile = File(...)):
    """上传手部照片"""
    return JSONResponse({"message": "uploaded", "filename": file.filename})


@router.post("/try-on")
async def try_on(hand_image_id: int = Form(...), style_id: int = Form(...)):
    """执行AI试戴"""
    return JSONResponse({
        "message": "try-on completed",
        "hand_image_id": hand_image_id,
        "style_id": style_id,
        "result_url": "/results/mock_result.png"
    })


@router.get("/history")
async def tryon_history(limit: int = 20, offset: int = 0):
    """试戴历史记录"""
    return {"records": [], "total": 0}
