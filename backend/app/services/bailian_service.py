"""
百炼AI图生图服务 — 供API和批量脚本共用
"""
import os
import base64
import logging
from pathlib import Path
import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
MODEL = "qwen-image-2.0-pro"


def _get_api_key() -> str:
    from app.core.config import get_settings
    return get_settings().DASHSCOPE_API_KEY


def image_to_base64(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/png")
    with open(filepath, "rb") as f:
        return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"


def generate_tryon_image(hand_path: str, style_path: str, output_path: str) -> tuple[bool, str]:
    """调用百炼 qwen-image-2.0-pro 图编辑API生成试戴效果图"""
    api_key = _get_api_key()
    if not api_key:
        return False, "DASHSCOPE_API_KEY 未配置（请在 .env 中设置）"

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        return True, "已缓存"

    try:
        hand_b64 = image_to_base64(hand_path)
        style_b64 = image_to_base64(style_path)
    except Exception as e:
        return False, f"图片编码失败: {e}"

    # 构造 prompt
    prompt = (
        f"把第一张图的手的指甲换成第二张手的美甲，其他保持不变，只修改第一张图的指甲"
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
            "prompt_extend": True,
            "watermark": False,
        }
    }

    try:
        resp = requests.post(BASE_URL, json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=120)
        data = resp.json()
        if resp.status_code != 200 or "output" not in data:
            err = data.get("message", data.get("code", str(resp.status_code)))
            logger.error(f"Bailian API error: {err}")
            return False, f"API错误: {err}"

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
    result_name = f"{hand_name}+style_{style_id:02d}.png"
    result_path = os.path.join(results_dir, result_name)
    if os.path.exists(result_path) and os.path.getsize(result_path) > 1000:
        return result_path
    return None
