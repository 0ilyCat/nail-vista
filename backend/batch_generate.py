"""
批量AI试戴图生成脚本 — 阿里百炼千问图编辑API
============================================
用法:
  python batch_generate.py                     # 生成全部 13×25=325 张
  python batch_generate.py --sample 5          # 只生成 5 张示例
  python batch_generate.py --hands 1-3 --styles 1-5  # 指定范围

生成的图片保存在 static/results/{hand_name}+{style_name}.png

API: 阿里百炼 qwen-image-2.0-pro 图编辑（多图融合）
环境变量: DASHSCOPE_API_KEY
"""
import os
import sys
import time
import json
import argparse
from pathlib import Path
from urllib.parse import urlparse
import requests

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# 配置
# ============================================================
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
BASE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
MODEL = "qwen-image-2.0-pro"

STYLES_DIR = Path("static/styles")
HANDS_DIR = Path("static/hands")
RESULTS_DIR = Path("results")
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# 工具函数
# ============================================================

def image_to_base64(filepath: str) -> str:
    """将图片文件编码为 base64 data URI"""
    import base64
    ext = os.path.splitext(filepath)[1].lower()
    mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
    mime = mime_map.get(ext, "image/png")
    with open(filepath, "rb") as f:
        return f"data:{mime};base64,{base64.b64encode(f.read()).decode('utf-8')}"


def generate_tryon(hand_path: str, style_path: str, output_path: str, 
                   style_name: str = "", hand_name: str = "") -> bool:
    """
    调用百炼图编辑API生成试戴效果图
    
    Args:
        hand_path: 手部照片本地路径
        style_path: 款式图本地路径  
        output_path: 输出保存路径
        style_name: 款式名（用于prompt）
        hand_name: 手图名
    """
    if not DASHSCOPE_API_KEY:
        print("  ❌ DASHSCOPE_API_KEY 未设置")
        return False

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        print(f"  ⏭ 已存在，跳过")
        return True

    # Base64 编码两张图
    try:
        hand_b64 = image_to_base64(hand_path)
        style_b64 = image_to_base64(style_path)
    except Exception as e:
        print(f"  ❌ 图片编码失败: {e}")
        return False

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

    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(BASE_URL, json=payload, headers=headers, timeout=120)
        data = resp.json()

        if resp.status_code != 200 or "output" not in data:
            err_msg = data.get("message", data.get("code", str(resp.status_code)))
            print(f"  ❌ API错误: {err_msg}")
            return False

        # 提取图片URL并下载
        image_url = data["output"]["choices"][0]["message"]["content"][0]["image"]
        img_resp = requests.get(image_url, timeout=60)
        img_resp.raise_for_status()
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "wb") as f:
            f.write(img_resp.content)
        
        print(f"  ✅ 已保存 ({os.path.getsize(output_path)}B)")
        return True

    except requests.exceptions.Timeout:
        print(f"  ❌ 请求超时")
        return False
    except Exception as e:
        print(f"  ❌ 异常: {e}")
        return False


def get_hand_style_pairs(xlsx_path: str) -> list[tuple[str, str, int, int]]:
    """
    从xlsx读取所有手图-款式配对
    
    Returns:
        list of (hand_path, style_path, hand_index, style_id)
    """
    df_h = pd.read_excel(xlsx_path, sheet_name="手图")
    df_s = pd.read_excel(xlsx_path, sheet_name="款式图")

    # 手图: 按URL去重，按出现顺序编号
    hand_urls = []
    seen = set()
    for _, row in df_h.iterrows():
        url = row["手图URL"]
        if pd.isna(url) or url in seen:
            continue
        seen.add(url)
        hand_urls.append(url)

    # 款式图
    style_urls = []
    for _, row in df_s.iterrows():
        style_urls.append((row["序号"], row["增强后款式图URL"]))

    # 匹配本地文件
    pairs = []
    for hi, hurl in enumerate(hand_urls, 1):
        # 找到对应的本地手图文件
        hand_files = list(HANDS_DIR.glob(f"hand_{hi:02d}.*"))
        if not hand_files:
            print(f"  ⚠ 手图 hand_{hi:02d} 本地文件缺失")
            continue
        
        for sid, surl in style_urls:
            style_file = STYLES_DIR / f"style_{sid:02d}.png"
            if not style_file.exists():
                print(f"  ⚠ 款式 style_{sid:02d} 本地文件缺失")
                continue
            pairs.append((str(hand_files[0]), str(style_file), hi, int(sid)))
    
    return pairs


# ============================================================
# 主流程
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="批量生成AI试戴效果图")
    parser.add_argument("--sample", type=int, default=0, help="只生成N张示例")
    parser.add_argument("--hands", type=str, default="", help="手图范围，如 1-3")
    parser.add_argument("--styles", type=str, default="", help="款式范围，如 1-5")
    parser.add_argument("--check", action="store_true", help="仅检查待生成状态")
    parser.add_argument("--xlsx", type=str, 
                        default="../命题三美甲评测数据（对外版）.xlsx",
                        help="Excel数据文件路径")
    args = parser.parse_args()

    if not DASHSCOPE_API_KEY:
        print("=" * 60)
        print("⚠️  请先设置 DASHSCOPE_API_KEY 环境变量")
        print("   export DASHSCOPE_API_KEY=sk-xxxx")
        print("=" * 60)
        return

    xlsx_path = args.xlsx
    if not os.path.exists(xlsx_path):
        print(f"❌ 找不到 {xlsx_path}")
        return

    # 获取所有配对
    pairs = get_hand_style_pairs(xlsx_path)
    print(f"\n📊 共发现 {len(pairs)} 组手图×款式组合 ({len(set(p[2] for p in pairs))}手 × {len(set(p[3] for p in pairs))}款)\n")

    # 过滤范围
    if args.hands:
        parts = args.hands.split("-")
        lo, hi = int(parts[0]), int(parts[1]) if len(parts) > 1 else int(parts[0])
        pairs = [p for p in pairs if lo <= p[2] <= hi]
    if args.styles:
        parts = args.styles.split("-")
        lo, hi = int(parts[0]), int(parts[1]) if len(parts) > 1 else int(parts[0])
        pairs = [p for p in pairs if lo <= p[3] <= hi]

    # --check 模式：仅统计当前的覆盖情况
    if args.check:
        exists = 0
        missing = 0
        for hand_path, style_path, hand_idx, style_id in pairs:
            result_name = f"hand_{hand_idx:02d}+style_{style_id:02d}.png"
            result_path = RESULTS_DIR / result_name
            # 判断有效文件（存在且不为空）
            if result_path.exists() and result_path.stat().st_size > 1000:
                exists += 1
            else:
                missing += 1
        print(f"  已存在: {exists}")
        print(f"  待生成: {missing}")
        print(f"  总计范围: {len(pairs)}")
        return

    # 去重逻辑：剔除本地已生成的图片，避免被放入生图队列占用 --sample 名额
    pending_pairs = []
    for p in pairs:
        hand_idx, style_id = p[2], p[3]
        result_name = f"hand_{hand_idx:02d}+style_{style_id:02d}.png"
        result_path = RESULTS_DIR / result_name
        if result_path.exists() and result_path.stat().st_size > 1000:
            continue
        pending_pairs.append(p)
    pairs = pending_pairs

    # 限制数量
    if args.sample > 0:
        pairs = pairs[:args.sample]

    total = len(pairs)
    if total == 0:
        print(f"🎯 指定范围内所有图片已生成完毕，无需重复生成！\n")
        return
    print(f"🎯 本次将实际生成 {total} 张试戴效果图\n")

    success = 0
    for i, (hand_path, style_path, hand_idx, style_id) in enumerate(pairs, 1):
        hand_name = f"hand_{hand_idx:02d}"
        style_name = f"style_{style_id:02d}"
        result_name = f"{hand_name}+{style_name}.png"
        result_path = str(RESULTS_DIR / result_name)

        print(f"[{i}/{total}] {result_name} ...", end=" ")
        sys.stdout.flush()
        
        if generate_tryon(hand_path, style_path, result_path, style_name, hand_name):
            success += 1
        
        # API限流延迟
        if i < total:
            time.sleep(2)

    print(f"\n{'='*60}")
    print(f"✅ 完成: {success}/{total} 成功")
    print(f"📁 输出目录: {RESULTS_DIR.resolve()}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
