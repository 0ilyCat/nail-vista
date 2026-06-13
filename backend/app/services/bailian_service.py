"""
百炼AI 图生图服务 — 调用 qwen-image-2.0-pro-2026-04-22 生成试戴效果图

使用方式:
    from app.services.bailian_service import generate_tryon_image
    success, msg = await generate_tryon_image(hand_path, style_path, output_path)
"""
import os
import base64
import logging
import time
from pathlib import Path
import httpx

logger = logging.getLogger("bailian")

BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
MODEL = "qwen-image-2.0-pro-2026-04-22"
GENERATE_TIMEOUT = 300  # 生图接口超时（秒）
DOWNLOAD_TIMEOUT = 120   # 下载结果图超时（秒）


def image_to_base64(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/png")
    with open(filepath, "rb") as f:
        data = base64.b64encode(f.read()).decode('utf-8')
    return f"data:{mime};base64,{data}"


async def generate_tryon_image(hand_path: str, style_path: str, output_path: str, api_key: str) -> tuple[bool, str]:
    """
    调用百炼 qwen-image-2.0-pro-2026-04-22 图编辑API 生成美甲试戴效果图

    Args:
        hand_path: 手部图片本地路径
        style_path: 美甲款式图片本地路径
        output_path: 输出结果路径
        api_key: 百炼API密钥

    Returns:
        (success, message)
    """
    start_time = time.time()

    if not api_key:
        logger.error("[百炼生图] 调用失败：DASHSCOPE_API_KEY 未配置")
        return False, "DASHSCOPE_API_KEY 未配置（请在 .env 中设置）"

    # 缓存检查
    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        elapsed = time.time() - start_time
        logger.info(f"[百炼生图] 缓存命中 文件={output_path} 耗时={elapsed:.2f}秒")
        return True, "已缓存"

    # 图片编码
    try:
        hand_b64 = image_to_base64(hand_path)
        style_b64 = image_to_base64(style_path)
    except FileNotFoundError as e:
        logger.error(f"[百炼生图] 图片编码失败：文件不存在 error={e}")
        return False, f"图片文件不存在: {e}"
    except Exception as e:
        logger.error(f"[百炼生图] 图片编码失败 error={e}")
        return False, f"图片编码失败: {e}"

    payload = {
        "model": MODEL,
        "input": {
            "messages": [{
                "role": "user",
                "content": [
                    {"image": hand_b64},
                    {"image": style_b64},
                    {"text": "把第一张图的手的指甲换成第二张图的美甲，其他保持不变，只修改第一张图的指甲，保持手部皮肤自然"},
                ]
            }]
        },
        "parameters": {
            "n": 1,
            "prompt_extend": True,
            "watermark": False,
        }
    }

    logger.info(f"[百炼生图] 开始调用 模型={MODEL} 超时={GENERATE_TIMEOUT}秒")

    try:
        async with httpx.AsyncClient(timeout=GENERATE_TIMEOUT) as client:
            resp = await client.post(
                BASE_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            data = resp.json()

        if resp.status_code != 200 or "output" not in data:
            err = data.get("message", data.get("code", str(resp.status_code)))
            logger.error(f"[百炼生图] 调用失败 HTTP状态码={resp.status_code} 错误信息={err} 完整响应={data}")
            return False, f"百炼API调用失败: {err}"

        # 提取生成的图片URL
        image_url = data["output"]["choices"][0]["message"]["content"][0]["image"]

        # 下载保存
        async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT) as client:
            img_resp = await client.get(image_url)
            img_resp.raise_for_status()
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(img_resp.content)

        total_time = time.time() - start_time
        logger.info(f"[百炼生图] 生成完成 文件大小={os.path.getsize(output_path)}字节 总耗时={total_time:.2f}秒")
        return True, "生成成功"

    except httpx.TimeoutException:
        logger.error(f"[百炼生图] 请求超时 超时阈值={GENERATE_TIMEOUT}秒")
        return False, "百炼API请求超时"
    except Exception as e:
        logger.error(f"[百炼生图] 生成异常 类型={type(e).__name__} 信息={e}")
        return False, f"生成失败: {e}"


def get_hand_path(hand_image_url: str, static_dir: str) -> str:
    """根据 hand_image 的 URL 获取本地文件路径"""
    relative = hand_image_url.replace("/static/", "").lstrip("/")
    return os.path.join(static_dir, relative)


def get_style_path(style_image_url: str, static_dir: str) -> str:
    """根据 style 图片 URL 获取本地文件路径"""
    relative = style_image_url.replace("/static/", "").lstrip("/")
    return os.path.join(static_dir, relative)
