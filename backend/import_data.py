"""
数据导入脚本 — 将 Excel 数据导入 PostgreSQL
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from sqlalchemy import text
from app.core.database import async_session, init_db, engine
from app.models.models import NailStyle, HandImage


async def import_data():
    await init_db()

    xlsx_path = os.path.join(os.path.dirname(__file__), "..", "命题三美甲评测数据（对外版）.xlsx")
    if not os.path.exists(xlsx_path):
        xlsx_path = os.path.join(os.path.dirname(__file__), "命题三美甲评测数据（对外版）.xlsx")
        if not os.path.exists(xlsx_path):
            print(f"数据文件未找到: {xlsx_path}")
            return

    df_styles = pd.read_excel(xlsx_path, sheet_name="款式图")
    df_hands = pd.read_excel(xlsx_path, sheet_name="手图")

    async with async_session() as session:
        # 导入款式
        categories = ["纯色", "渐变", "法式", "闪粉", "手绘"]
        colors = ["#ffe4e1", "#6a5acd", "#ffb7c5", "#dc143c", "#deb887"]
        for i, row in df_styles.iterrows():
            style = NailStyle(
                name=f"款式{row.get('序号', i+1)}",
                original_url=str(row.get("原始款式图URL", "")),
                enhanced_url=str(row.get("增强后款式图URL", "")),
                category=categories[i % len(categories)],
                color_tone=colors[i % len(colors)],
                tags=[categories[i % len(categories)]],
            )
            session.add(style)

        # 导入手图（取唯一URL）
        seen = set()
        for i, row in df_hands.iterrows():
            url = str(row.get("手图URL", ""))
            if pd.isna(row.get("手图URL")) or url in seen:
                continue
            seen.add(url)
            hand = HandImage(
                image_url=url,
                skin_tone=["白皙", "自然", "小麦"][i % 3],
                hand_type=["纤细", "标准", "圆润"][i % 3],
            )
            session.add(hand)

        await session.commit()

    print(f"导入完成: {len(df_styles)} 款式, {len(seen)} 手图")


if __name__ == "__main__":
    asyncio.run(import_data())
