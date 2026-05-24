"""
数据种子脚本 — 导入Excel数据 + 生成美团风格运营Mock数据
包括: 款式、手图、订单、退款、评价、营收、流量、优惠券
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
from sqlalchemy import select, func, case
from app.core.database import async_session, init_db
from app.models.models import (
    NailStyle, HandImage, StyleMetrics, TryonRecord,
    Order, Refund, Review, DailyRevenue, TrafficMetrics, CouponUsage,
)


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
PRICE_RANGES = [88, 98, 128, 138, 158, 168, 188, 198, 228, 258, 288, 298, 328, 358, 388]

# 美甲店真实评价语料
REVIEW_POSITIVE = [
    "效果超好！做出来比图片还好看，同事都问在哪做的",
    "小姐姐手法很专业，做得很细致，下次还来",
    "颜色很显白，款式也好看，性价比很高",
    "第一次来这家店，体验感很好，已经推荐给朋友了",
    "还原度很高，款式图什么样做出来就是什么样",
    "做了猫眼款，阳光下闪闪的很漂亮",
    "环境干净，服务态度好，美甲师很耐心",
    "第三次来了，每次都很满意，已经成为常客了",
]
REVIEW_NEUTRAL = [
    "还可以吧，就是等待时间有点长",
    "效果还行，但颜色和图片有点色差",
    "价格适中，款式选择挺多的",
    "中规中矩，没有特别惊喜但也不差",
]
REVIEW_NEGATIVE = [
    "没图片好看，颜色不准，有点失望",
    "做了不到一周就开始掉了，质量一般",
    "预约了还等了半小时，效率太低了",
    "服务态度不太好，不会再来了",
]
REVIEW_TAGS = ["效果好评", "服务好", "性价比高", "环境好", "技术好",
              "款式多", "颜色好看", "显白", "还原度高", "等待快"]

REFUND_REASONS = [
    "临时有事去不了", "款式与图片不符", "预约时间冲突",
    "找到更便宜的", "朋友不去一个人不想做", "身体不适",
    "店铺位置不好找", "客服态度差",
]


async def seed_data():
    await init_db()

    xlsx_path = Path(__file__).parent.parent / "命题三美甲评测数据（对外版）.xlsx"
    if not xlsx_path.exists():
        xlsx_path = Path(__file__).parent / "命题三美甲评测数据（对外版）.xlsx"

    async with async_session() as session:
        # ── 1. Import nail styles ─────────────────────────
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
                    price=PRICE_RANGES[i % len(PRICE_RANGES)],
                )
                session.add(style)
        else:
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
                    price=PRICE_RANGES[i % len(PRICE_RANGES)],
                )
                session.add(style)

        # ── 2. Import hand images ─────────────────────────
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

        # ── 3. Generate 30 days of metrics ─────────────────
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        style_ids = list(range(1, 26))

        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            for sid in style_ids:
                base = random.randint(5, 50)
                day_factor = 1.0 + (0.05 * day_offset)
                views = int(base * day_factor * random.uniform(0.5, 2.0))
                tryons = int(views * random.uniform(0.1, 0.4))
                favorites = int(tryons * random.uniform(0.1, 0.3))
                shares = int(tryons * random.uniform(0.05, 0.15))
                orders = int(tryons * random.uniform(0.2, 0.5))
                refunds = int(orders * random.uniform(0.02, 0.08))
                duration = random.randint(20, 120)

                hot_score = round(
                    tryons * 0.35 + orders * 0.25 + favorites * 0.2 + views * 0.15 + shares * 0.05, 2
                )

                metric = StyleMetrics(
                    style_id=sid, date=day,
                    views=views, tryons=tryons, favorites=favorites,
                    shares=shares, orders=orders, refunds=refunds,
                    avg_duration=duration, hot_score=hot_score,
                )
                session.add(metric)

        await session.flush()

        # ── 4. Generate orders (last 30 days) ──────────────
        user_ids = [f"u{1000 + i:05d}" for i in range(80)]
        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            daily_orders = random.randint(8, 25)  # 8-25 单/天
            for oi in range(daily_orders):
                sid = random.choice(style_ids)
                is_new = random.random() < 0.45  # 45% 新客
                original = PRICE_RANGES[(sid - 1) % len(PRICE_RANGES)]
                coupon = random.choice([0, 0, 0, 5, 5, 10, 10, 15, 20, 30])
                amount = max(original - coupon, original * 0.5)
                hour = random.randint(9, 22)
                minute = random.randint(0, 59)
                order_time = day.replace(hour=hour, minute=minute)

                order = Order(
                    order_no=f"NV{day.strftime('%y%m%d')}{oi:04d}",
                    style_id=sid,
                    user_id=random.choice(user_ids),
                    amount=amount,
                    original_amount=original,
                    coupon_discount=coupon,
                    status="paid",
                    payment_method=random.choice(["wechat", "alipay", "wechat", "wechat"]),
                    is_new_customer=is_new,
                    created_at=order_time,
                )
                session.add(order)

        await session.flush()

        # ── 5. Generate refunds (~5% of orders) ───────────
        order_ids = [r[0] for r in (await session.execute(
            select(Order.id)
        )).all()]
        refund_order_ids = random.sample(order_ids, int(len(order_ids) * 0.05))
        for oid in refund_order_ids:
            refund_amount = random.uniform(50, 200)
            refund = Refund(
                order_id=oid,
                amount=round(refund_amount, 2),
                reason=random.choice(REFUND_REASONS),
                status=random.choice(["completed", "completed", "completed", "approved"]),
                created_at=today - timedelta(days=random.randint(0, 29), hours=random.randint(0, 23)),
            )
            session.add(refund)

        await session.flush()

        # ── 6. Generate reviews (~60% of orders) ───────────
        reviewed = set()
        for _ in range(int(len(order_ids) * 0.6)):
            oid = random.choice(order_ids)
            if oid in reviewed: continue
            reviewed.add(oid)
            rating_weights = [0.05, 0.05, 0.1, 0.25, 0.55]  # 5星55%, 4星25%...
            rating = random.choices([1, 2, 3, 4, 5], weights=rating_weights, k=1)[0]
            if rating >= 4:
                comment = random.choice(REVIEW_POSITIVE)
            elif rating == 3:
                comment = random.choice(REVIEW_NEUTRAL)
            else:
                comment = random.choice(REVIEW_NEGATIVE)
            tags = ", ".join(random.sample(REVIEW_TAGS, random.randint(1, 3)))

            review = Review(
                order_id=oid,
                style_id=random.choice(style_ids),
                user_id=random.choice(user_ids),
                rating=rating,
                tags=tags,
                comment=comment,
                has_photo=rating >= 4 and random.random() < 0.4,
                created_at=today - timedelta(days=random.randint(0, 29)),
            )
            session.add(review)

        await session.flush()

        # ── 7. Daily revenue summary (30 days) ─────────────
        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            day_start = day
            day_end = day + timedelta(days=1)

            # Aggregate from orders
            order_rows = (await session.execute(
                select(
                    func.count(Order.id), func.sum(Order.amount), func.sum(Order.coupon_discount),
                    func.sum(case((Order.is_new_customer == True, 1), else_=0)),
                    func.sum(case((Order.is_new_customer == False, 1), else_=0)),
                ).where(Order.created_at >= day_start, Order.created_at < day_end)
            )).first()

            total_orders = order_rows[0] or 0
            gross = order_rows[1] or 0.0
            coupon_total = order_rows[2] or 0.0
            new_cust = int(order_rows[3] or 0)
            repeat_cust = int(order_rows[4] or 0)

            # Aggregate from refunds
            refund_rows = (await session.execute(
                select(func.count(Refund.id), func.sum(Refund.amount))
                .where(Refund.created_at >= day_start, Refund.created_at < day_end)
            )).first()

            refund_cnt = refund_rows[0] or 0
            refund_amt = refund_rows[1] or 0.0

            net = round(gross - refund_amt, 2)
            aov = round(gross / total_orders, 2) if total_orders > 0 else 0.0

            rev = DailyRevenue(
                date=day,
                gross_revenue=round(gross, 2),
                net_revenue=net,
                order_count=total_orders,
                refund_amount=round(refund_amt, 2),
                refund_count=refund_cnt,
                new_customer_orders=new_cust,
                repeat_customer_orders=repeat_cust,
                coupon_discount_total=round(coupon_total, 2),
                avg_order_value=aov,
            )
            session.add(rev)

        # ── 8. Traffic metrics (30 days) ─────────────────
        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            exposure = random.randint(1500, 5000)
            clicks = int(exposure * random.uniform(0.05, 0.15))
            visits = int(clicks * random.uniform(0.3, 0.7))
            conversions = int(visits * random.uniform(0.08, 0.25))
            ctr = round(clicks / exposure * 100, 2)
            cvr = round(conversions / visits * 100, 2) if visits > 0 else 0

            tm = TrafficMetrics(
                date=day, exposure=exposure, click=clicks,
                visit=visits, order_conversion=conversions,
                ctr=ctr, cvr=cvr,
                source=random.choice(["organic", "organic", "search", "ad", "recommend"]),
            )
            session.add(tm)

        # ── 9. Coupon usage (30 days) ─────────────────────
        campaigns = ["新人立减券", "满100减10", "满200减25", "老客专属券", "节日活动券"]
        for day_offset in range(30):
            day = today - timedelta(days=day_offset)
            issued = random.randint(20, 80)
            used = int(issued * random.uniform(0.15, 0.45))
            cu = CouponUsage(
                date=day, issued=issued, used=used,
                discount_total=round(used * random.uniform(8, 25), 2),
                usage_rate=round(used / issued * 100, 1),
                campaign=random.choice(campaigns),
            )
            session.add(cu)

        # ── 10. Mock tryon records ─────────────────────────
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

    print(f"✅ 数据导入完成:")
    print(f"   25 款式 (含价格)")
    print(f"   {len(seen_urls) or 10} 手图")
    print(f"   750 条日指标")
    print(f"   ~{len(order_ids) if 'order_ids' in dir() else '600'} 订单")
    print(f"   ~{len(refund_order_ids)} 退款")
    print(f"   ~{len(reviewed)} 评价")
    print(f"   30 天营收汇总")
    print(f"   30 天流量数据")
    print(f"   30 天优惠券数据")
    print(f"   200 条试戴记录")


if __name__ == "__main__":
    asyncio.run(seed_data())
