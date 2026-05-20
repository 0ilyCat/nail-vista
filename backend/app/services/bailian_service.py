"""
百炼AI图生图服务 — 供API和批量脚本共用
"""
import os
import base64
import logging
from pathlib import Path
import requests

logger = logging.getLogger(__name__)

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
MODEL = "qwen-image-2.0-pro"


def image_to_base64(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/png")
    with open(filepath, "rb") as f:
        return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"


def generate_tryon_image(hand_path: str, style_path: str, output_path: str) -> tuple[bool, str]:
    """
    调用百炼 qwen-image-2.0-pro 图编辑API生成试戴效果图
    
    Returns:
        (success: bool, message: str)
    """
    if not DASHSCOPE_API_KEY:
        return False, "DASHSCOPE_API_KEY 未设置"

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        return True, "已缓存"

    try:
        hand_b64 = image_to_base64(hand_path)
        style_b64 = image_to_base64(style_path)
    except Exception as e:
        return False, f"图片编码失败: {e}"

    prompt = (
        "将第二张图的美甲款式精确应用到第一张手部照片的指甲上。"
        "保持手部皮肤质感、光影和角度不变，只替换指甲区域的颜色和图案。"
        "确保指甲形状与手部自然匹配，边缘平滑不溢出。保持原始图片的真实感。"
    )

    payload = {
        "model": MODEL,
        "input": {
            "messages": [{
                "role": "user",
                "content": [
                    {"image": hand_b64},
                    {"image": style_b64},
                    {"text": prompt},
                ]
            }]
        },
        "parameters": {
            "n": 1,
            "negative_prompt": "变形、扭曲、模糊、低质量、比例失调、颜色溢出",
            "prompt_extend": False,
            "watermark": False,
        }
    }

    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(BASE_URL, json=payload, headers=headers, timeout=120)
        data = resp.json()

        if resp.status_code != 200 or "output" not in data:
            err_msg = data.get("message", data.get("code", str(resp.status_code)))
            logger.error(f"Bailian API error: {err_msg}")
            return False, f"API错误: {err_msg}"

        image_url = data["output"]["choices"][0]["message"]["content"][0]["image"]
        img_resp = requests.get(image_url, timeout=60)
        img_resp.raise_for_status()

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(img_resp.content)

        logger.info(f"Bailian generated: {output_path} ({os.path.getsize(output_path)}B)")
        return True, "生成成功"

    except requests.exceptions.Timeout:
        return False, "请求超时"
    except Exception as e:
        logger.error(f"Bailian generation failed: {e}")
        return False, str(e)


def find_cached_result(hand_name: str, style_id: int, results_dir: str = "results") -> str | None:
    """按命名规则查找已缓存的试戴结果"""
    result_name = f"{hand_name}+style_{style_id:02d}.png"
    result_path = os.path.join(results_dir, result_name)
    if os.path.exists(result_path) and os.path.getsize(result_path) > 1000:
        return result_path
    return None
