"""
数据种子脚本 — 导入Excel数据 + 生成Mock运营指标
"""
import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from app.core.database import async_session, init_db
from app.models.models import NailStyle, HandImage, StyleMetrics, TryonRecord


CATEGORIES = ["纯色", "渐变", "法式", "闪粉", "手绘", "猫眼", "晕染", "大理石"]
COLORS = ["#ffe4e1", "#6a5acd", "#ffb7c5", "#dc143c", "#deb887",
          "#ffd700", "#98fb98", "#87ceeb", "#d2691e", "#e8b4b8",
          "#f5deb3", "#b0c4de", "#dda0dd", "#f0e68c", "#20b2aa"]
STYLE_NAMES = [
    "法式简约", "星空渐变", "樱花粉", "经典红", "裸色优雅",
    "闪钻奢华", "莫兰迪绿", "雾霾蓝", "焦糖棕", "玫瑰金",
    "大理石纹理", "奶油白", "薰衣草紫", "蜜桃橘", "薄荷绿",
    "深海蓝", "酒红丝绒", "豆沙粉", "香槟金", "银河流星",
    "暗黑系", "马卡龙", "蜜糖裸", "彩虹渐变", "珍珠白",
]


async def seed_data():
    await init_db()

    xlsx_path = Path(__file__).parent.parent / "命题三美甲评测数据（对外版）.xlsx"
    if not xlsx_path.exists():
        xlsx_path = Path(__file__).parent / "命题三美甲评测数据（对外版）.xlsx"

    async with async_session() as session:
        # 1. 导入款式
        if xlsx_path.exists():
            df_styles = pd.read_excel(xlsx_path, sheet_name="款式图")
            for i, (_, row) in enumerate(df_styles.iterrows()):
                style = NailStyle(
                    name=STYLE_NAMES[i] if i < len(STYLE_NAMES) else f"款式{row.get('序号', i+1)}",
                    original_url=str(row.get("原始款式图URL", "")),
                    enhanced_url=str(row.get("增强后款式图URL", "")),
                    category=CATEGORIES[i % len(CATEGORIES)],
                    color_tone=COLORS[i % len(COLORS)],
                    tags=[CATEGORIES[i % len(CATEGORIES)], COLORS[i % len(COLORS)]],
                    description=f"{STYLE_NAMES[i] if i < len(STYLE_NAMES) else '精美款式'} — {CATEGORIES[i % len(CATEGORIES)]}风格",
                    popularity=random.randint(10, 200),
                )
                session.add(style)
        else:
            # Mock 25款
            for i in range(25):
                style = NailStyle(
                    name=STYLE_NAMES[i],
                    original_url="",
                    enhanced_url="",
                    category=CATEGORIES[i % len(CATEGORIES)],
                    color_tone=COLORS[i % len(COLORS)],
                    tags=[CATEGORIES[i % len(CATEGORIES)]],
                    description=f"{STYLE_NAMES[i]} — {CATEGORIES[i % len(CATEGORIES)]}风格",
                    popularity=random.randint(10, 200),
                )
                session.add(style)

        # 2. 导入手图
        seen_urls = set()
        if xlsx_path.exists():
            df_hands = pd.read_excel(xlsx_path, sheet_name="手图")
            skin_tones = ["白皙", "自然", "小麦", "白皙", "自然"]
            hand_types = ["纤细", "标准", "圆润", "标准", "纤细"]
            for i, (_, row) in enumerate(df_hands.iterrows()):
                url = str(row.get("手图URL", ""))
                if pd.isna(row.get("手图URL")) or url in seen_urls:
                    continue
                seen_urls.add(url)
                hand = HandImage(
                    image_url=url,
                    skin_tone=skin_tones[i % 5],
                    hand_type=hand_types[i % 5],
                )
                session.add(hand)

        await session.flush()

        # 3. 生成30天Mock指标
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        style_ids = list(range(1, 26))

        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            for sid in style_ids:
                base = random.randint(5, 50)
                day_factor = 1.0 + (0.05 * day_offset)  # 近期数据稍高
                views = int(base * day_factor * random.uniform(0.5, 2.0))
                tryons = int(views * random.uniform(0.1, 0.4))
                favorites = int(tryons * random.uniform(0.1, 0.3))
                shares = int(tryons * random.uniform(0.05, 0.15))
                duration = random.randint(20, 120)

                hot_score = round(
                    tryons * 0.4 + favorites * 0.25 + views * 0.2 + shares * 0.1 + min(duration / 300, 1) * 100 * 0.05, 2
                )

                metric = StyleMetrics(
                    style_id=sid,
                    date=day,
                    views=views,
                    tryons=tryons,
                    favorites=favorites,
                    shares=shares,
                    avg_duration=duration,
                    hot_score=hot_score,
                )
                session.add(metric)

        # 4. 生成一些Mock试戴记录
        for _ in range(200):
            rec = TryonRecord(
                hand_image_id=random.randint(1, max(1, len(seen_urls))),
                nail_style_id=random.randint(1, 25),
                result_url=f"/results/mock_{random.randint(1, 10)}.png",
                duration_ms=random.randint(200, 3000),
                created_at=today - timedelta(hours=random.randint(0, 720)),
            )
            session.add(rec)

        await session.commit()

    print(f"数据导入完成: {25} 款式, {len(seen_urls) or 10} 手图, 750 条日指标, 200 条试戴记录")


if __name__ == "__main__":
    asyncio.run(seed_data())
