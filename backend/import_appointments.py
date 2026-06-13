"""
NailVista 预约数据导入脚本 — 为每个店铺生成模拟订单/预约数据
使运营看板有可分析的数据
"""
import sys
sys.path.insert(0, ".")

import asyncio
import random
from datetime import datetime, timedelta, timezone
from app.core.database import async_session_factory
from app.models.models import User, Merchant, NailStyle, Appointment
from sqlalchemy import select, func


# 模拟用户评论模板
NOTES_TEMPLATES = [
    "请帮我做简单款就好",
    "想加一颗小钻",
    "之前做过同款，很喜欢",
    "希望做得不要太长",
    "我指甲比较薄，麻烦轻一点",
    "想要和图片一模一样的",
    "颜色可以稍微淡一点",
    "上班穿的，低调一些",
    "周末约会用，要好看",
    "闺蜜推荐的这家店",
    "第一次来做，多多关照",
    "想试试猫眼效果",
    "做渐变款式",
    "甲型修圆一点",
    "帮忙推荐适合的颜色",
]

STATUS_WEIGHTS = {
    "pending": 0.10,
    "confirmed": 0.15,
    "completed": 0.65,
    "cancelled": 0.10,
}


def utcnow():
    return datetime.now(timezone.utc)


async def main():
    async with async_session_factory() as db:
        # 查找所有商家
        merchants_result = await db.execute(select(Merchant))
        merchants = merchants_result.scalars().all()
        print(f"找到 {len(merchants)} 家店铺")

        if not merchants:
            print("没有商家数据，请先运行 import_data.py")
            return

        # 查找普通用户作为预约用户
        users_result = await db.execute(
            select(User).where(User.role == "user")
        )
        users = users_result.scalars().all()
        print(f"找到 {len(users)} 个普通用户")

        if not users:
            print("没有普通用户数据，跳过")
            return

        # 检查已有预约数量（幂等：已有数据则跳过）
        existing_count = (await db.execute(select(func.count(Appointment.id)))).scalar() or 0
        print(f"当前已有 {existing_count} 条预约记录")
        if existing_count >= 30:
            print("预约数据已存在，跳过导入")
            return

        total_created = 0

        for merchant in merchants:
            # 查找该商家的款式
            styles_result = await db.execute(
                select(NailStyle).where(
                    NailStyle.merchant_id == merchant.id,
                    NailStyle.is_active == True,
                )
            )
            styles = styles_result.scalars().all()
            print(f"\n商家「{merchant.name}」id={merchant.id}: {len(styles)} 个款式")

            if not styles:
                print(f"  跳过（没有款式）")
                continue

            # 生成 30-60 条预约记录
            num_appointments = random.randint(30, 60)
            merchant_created = 0

            for _ in range(num_appointments):
                style = random.choice(styles)
                user = random.choice(users)

                # 随机时间：过去 30 天
                days_ago = random.randint(0, 29)
                hour = random.randint(9, 20)
                minute = random.choice([0, 15, 30, 45])
                random_date = utcnow() - timedelta(days=days_ago)
                appointment_time = random_date.replace(
                    hour=hour, minute=minute, second=0, microsecond=0
                )

                # 随机状态
                status = random.choices(
                    list(STATUS_WEIGHTS.keys()),
                    weights=list(STATUS_WEIGHTS.values()),
                    k=1,
                )[0]

                # 随机价格（款式价格 ±20 元）
                base_price = float(style.price or 128)
                price = round(base_price + random.randint(-20, 20), 2)
                price = max(68, price)  # 最低 68 元

                # 已完成和已取消的订单时间应在过去
                if status in ("completed", "cancelled"):
                    appointment_time = appointment_time - timedelta(
                        days=random.randint(1, 5),
                        hours=random.randint(0, 8),
                    )

                appointment = Appointment(
                    user_id=user.id,
                    merchant_id=merchant.id,
                    style_id=style.id,
                    service_item=style.name,
                    appointment_time=appointment_time,
                    status=status,
                    notes=random.choice(NOTES_TEMPLATES) if random.random() < 0.6 else "",
                    price=price,
                    created_at=appointment_time - timedelta(
                        days=random.randint(0, 3),
                        hours=random.randint(0, 23),
                    ),
                )

                db.add(appointment)
                merchant_created += 1

            total_created += merchant_created
            print(f"  创建了 {merchant_created} 条预约记录")

        await db.commit()
        print(f"\n总共创建 {total_created} 条预约记录")


if __name__ == "__main__":
    asyncio.run(main())
