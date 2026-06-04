"""
NailVista 数据导入脚本 — 创建初始店铺、用户、美甲款式、帖子
"""
import sys
sys.path.insert(0, ".")

import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import async_session_factory, init_db, engine, Base
from app.core.security import hash_password
from app.models.models import (
    User, Merchant, NailStyle, NailTag, StyleTag,
    Post, PostLike, HandImage,
)


# ============================================================
# 美甲款式数据（原项目25款）
# ============================================================
STYLES = [
    {"name": "通勤奶咖短甲", "desc": "适合黄皮的显白通勤款", "category": "通勤", "color_tone": "咖色", "scene": "通勤", "nail_shape": "短甲", "price": 128},
    {"name": "法式裸粉气质甲", "desc": "面试/见家长都不踩雷", "category": "裸色", "color_tone": "粉色", "scene": "面试", "nail_shape": "圆甲", "price": 158},
    {"name": "偏欧美的猫眼款", "desc": "适合聚会和夜场的高调选择", "category": "猫眼", "color_tone": "黑色", "scene": "派对", "nail_shape": "长甲", "price": 198},
    {"name": "果冻奶橘疗愈甲", "desc": "偏治愈系，适合周末放松", "category": "果冻", "color_tone": "橘色", "scene": "休闲", "nail_shape": "圆甲", "price": 148},
    {"name": "极简法式小红点", "desc": "一点小心机，办公室也合适", "category": "极简", "color_tone": "红色", "scene": "通勤", "nail_shape": "短甲", "price": 138},
    {"name": "墨绿方甲酷飒款", "desc": "秋冬穿搭绝配", "category": "手绘", "color_tone": "绿色", "scene": "派对", "nail_shape": "方甲", "price": 178},
    {"name": "裸色渐变长甲", "desc": "显手长，气质挂", "category": "裸色", "color_tone": "裸色", "scene": "约会", "nail_shape": "长甲", "price": 168},
    {"name": "樱花粉猫眼", "desc": "甜而不腻，约会必备", "category": "猫眼", "color_tone": "粉色", "scene": "约会", "nail_shape": "圆甲", "price": 178},
    {"name": "焦糖拿铁短甲", "desc": "低调显白，通勤首选", "category": "通勤", "color_tone": "咖色", "scene": "通勤", "nail_shape": "短甲", "price": 138},
    {"name": "香槟金跳色", "desc": "年会、婚礼都撑得住", "category": "手绘", "color_tone": "金色", "scene": "婚礼", "nail_shape": "长甲", "price": 218},
    {"name": "豆沙粉法式", "desc": "温柔显气色", "category": "裸色", "color_tone": "粉色", "scene": "约会", "nail_shape": "圆甲", "price": 158},
    {"name": "雾霾蓝极简", "desc": "冷调高级感", "category": "极简", "color_tone": "蓝色", "scene": "通勤", "nail_shape": "短甲", "price": 148},
    {"name": "琥珀色晕染", "desc": "秋冬氛围感拉满", "category": "手绘", "color_tone": "橘色", "scene": "休闲", "nail_shape": "长甲", "price": 188},
    {"name": "蜜桃乌龙甲", "desc": "春夏显嫩", "category": "果冻", "color_tone": "粉色", "scene": "约会", "nail_shape": "圆甲", "price": 168},
    {"name": "黑色酷感猫眼", "desc": "夜场、派对高调款", "category": "猫眼", "color_tone": "黑色", "scene": "派对", "nail_shape": "长甲", "price": 228},
    {"name": "薰衣草紫短甲", "desc": "冷白皮友好", "category": "果冻", "color_tone": "紫色", "scene": "休闲", "nail_shape": "短甲", "price": 138},
    {"name": "奶茶色渐变", "desc": "日常百搭不挑人", "category": "裸色", "color_tone": "咖色", "scene": "约会", "nail_shape": "圆甲", "price": 158},
    {"name": "玫瑰金细闪", "desc": "轻奢感，见家长加分", "category": "手绘", "color_tone": "粉色", "scene": "面试", "nail_shape": "长甲", "price": 188},
    {"name": "薄荷绿清新甲", "desc": "夏日清凉感", "category": "果冻", "color_tone": "绿色", "scene": "休闲", "nail_shape": "短甲", "price": 128},
    {"name": "酒红丝绒甲", "desc": "显白经典", "category": "手绘", "color_tone": "红色", "scene": "派对", "nail_shape": "长甲", "price": 198},
    {"name": "裸透果冻甲", "desc": "自然健康甲感", "category": "果冻", "color_tone": "裸色", "scene": "通勤", "nail_shape": "圆甲", "price": 138},
    {"name": "灰粉莫兰迪", "desc": "低饱和高级灰粉", "category": "极简", "color_tone": "粉色", "scene": "约会", "nail_shape": "短甲", "price": 158},
    {"name": "通勤黑白极简", "desc": "职场女性的高级选择", "category": "极简", "color_tone": "黑色", "scene": "通勤", "nail_shape": "短甲", "price": 128},
    {"name": "璀璨贴钻甲", "desc": "华丽不失优雅", "category": "手绘", "color_tone": "白色", "scene": "婚礼", "nail_shape": "长甲", "price": 258},
    {"name": "渐变蓝海风", "desc": "如海风拂过指尖", "category": "手绘", "color_tone": "蓝色", "scene": "休闲", "nail_shape": "圆甲", "price": 188},
]

# 3家店铺
MERCHANTS = [
    {
        "name": "指间时光·美甲工作室", "city": "广州", "district": "天河区",
        "address": "天河路385号太古汇B1", "business_hours": "10:00-21:00",
        "phone": "13800001001", "rating": 4.8, "description": "专注日式美甲多年，环境优雅舒适，用专业技艺让你的指尖绽放光彩。",
        "tags": ["通勤", "猫眼", "裸色"],
        "images": [
            "merchants/微信图片_20260604172650_361_70.png",
            "merchants/微信图片_20260604172810_362_70.png",
        ],
    },
    {
        "name": "闪耀工厂·美甲工坊", "city": "广州", "district": "海珠区",
        "address": "江南西路66号富力海珠城2楼", "business_hours": "11:00-22:00",
        "phone": "13800001002", "rating": 4.7, "description": "潮流美甲工厂，紧跟时尚前沿，各种风格应有尽有！",
        "tags": ["手绘", "极简", "果冻"],
        "images": [
            "merchants/微信图片_20260604172832_363_70.png",
            "merchants/微信图片_20260604172846_364_70.png",
        ],
    },
    {
        "name": "北极星·潮流美甲", "city": "广州", "district": "越秀区",
        "address": "北京路168号光明广场3楼", "business_hours": "10:30-21:30",
        "phone": "13800001003", "rating": 4.9, "description": "市中心热门美甲店，技术一流，服务贴心，好评如潮。",
        "tags": ["猫眼", "手绘", "裸色"],
        "images": [
            "merchants/微信图片_20260604172852_365_70.png",
            "merchants/微信图片_20260604172902_366_70.png",
        ],
    },
]

# 初始用户
USERS = [
    {"username": "xiaomei", "nickname": "小美", "bio": "热爱美甲的小仙女", "role": "user"},
    {"username": "luna", "nickname": "Luna", "bio": "面试见家长都不踩雷", "role": "user"},
    {"username": "heifeng", "nickname": "黑猫", "bio": "夜场派对达人", "role": "user"},
    {"username": "nana", "nickname": "Nana", "bio": "气质手控", "role": "user"},
    {"username": "yinzi", "nickname": "樱子", "bio": "甜腻约会必备", "role": "user"},
    {"username": "merchant01", "nickname": "指尖时光主理人", "bio": "", "role": "merchant"},
    {"username": "merchant02", "nickname": "闪耀工厂主理人", "bio": "", "role": "merchant"},
    {"username": "merchant03", "nickname": "北极星主理人", "bio": "", "role": "merchant"},
]

# 帖子 — 小红书风格
POSTS = [
    {"title": "越简单的款越好看啊 奶咖色短甲太温柔了🍂", "content": "黄皮天菜！做完感觉自己手白了两度，通勤日常随便搭，已经安利给全办公室了🥹#通勤美甲 #短甲", "style_idx": 0, "user_idx": 0},
    {"title": "法式裸粉真的杀疯了🫧面试见家长闭眼冲", "content": "低饱和粉色打底+极细银边，太有质感了！面试官都夸指甲好看，温柔又有气场✨#法式美甲 #气质款", "style_idx": 1, "user_idx": 1},
    {"title": "周末蹦迪当然要闪💅黑色猫眼yyds", "content": "灯光下那个光泽感真的拍不出来，手机原图直出都绝了🖤深色猫眼真的是辣妹必备，夜店最亮的崽#猫眼美甲", "style_idx": 14, "user_idx": 2},
    {"title": "做完这个裸色渐变 第一次觉得自己的手可以这么好看🥺", "content": "从深到浅过渡得太自然了，显手长第一名✋本来短粗星人终于找到本命款，做完美甲狂拍一万张#渐变美甲 #显手长", "style_idx": 6, "user_idx": 3},
    {"title": "约会神器🌸樱花粉猫眼也太甜了吧", "content": "淡淡的粉底+金色猫眼光泽，甜而不腻的那种！男朋友说今天手怎么这么好看哈哈哈，直男都夸的程度🌸#约会美甲 #猫眼", "style_idx": 7, "user_idx": 4},
    {"title": "年会做这个香槟金跳色 被全公司要链接了✨", "content": "blingbling但是完全不浮夸，配小黑裙绝美！年会那天被七八个同事问在哪里做的，美甲店老板应该给我打钱😂#年会美甲 #闪粉", "style_idx": 9, "user_idx": 0},
    {"title": "被小红书种草的果冻奶橘🍊太元气了吧", "content": "像橘子汽水洒在指尖上！半透明的果冻感+奶橘色调，夏天涂真的太治愈了🧡周末做完心情好了一整天#果冻美甲 #夏日美甲", "style_idx": 3, "user_idx": 1},
    {"title": "冷白皮姐妹冲这个雾霾蓝❄️高级感拉满", "content": "低饱和的蓝灰色太绝了，配白衬衫/灰西装都好看得要命。冷白皮做冷色调是真的老天赏饭吃🥶#极简美甲 #冷色调", "style_idx": 11, "user_idx": 2},
    {"title": "秋天第一杯奶茶没喝 先做了焦糖拿铁美甲☕️", "content": "每年秋冬必做色系！焦糖棕+奶咖色跳涂，显白又不挑衣服。穿毛衣露出指甲太好看了🍁#秋日美甲 #焦糖色", "style_idx": 8, "user_idx": 3},
    {"title": "夏日小短甲🧊希望这个夏天没有尽头", "content": "薄荷绿清清凉凉的，看着就降温三度🌿短甲也可以很精致！搭配白T牛仔裤清爽到不行～#夏日美甲 #短甲", "style_idx": 18, "user_idx": 4},
    {"title": "新美甲look🫧偏欧美猫眼也太A了吧", "content": "长甲+深色猫眼=气场全开💅方形甲片修得特别好看，配金属戒指简直了。聚会拍照焦点预定✨#欧美风 #长甲", "style_idx": 2, "user_idx": 2},
    {"title": "极简红点法式🔴就一点小心机谁懂啊", "content": "裸色底+指尖一个小红点，低调但是好精致！办公室完全不会太夸张，但伸手递文件的时候绝对会被注意到👀#极简美甲 #小心机", "style_idx": 4, "user_idx": 0},
    {"title": "雾粉色莫兰迪💕温柔到骨子里了", "content": "灰调的粉太高级了，不挑皮！见家长/约会/上班全场景通杀，做完感觉整个人都温柔了起来～#莫兰迪 #温柔系", "style_idx": 22, "user_idx": 1},
    {"title": "做完这个蜜桃乌龙甲🍑被男朋友夸了一天", "content": "春夏显嫩必备！蜜桃粉+果冻感，甜甜的但不会太幼～阳光下看更好看，已经想好下次做什么颜色了🤭#春夏美甲 #粉色", "style_idx": 13, "user_idx": 3},
    {"title": "海洋风美甲来了🌊清新到想立刻去海边", "content": "渐变蓝+白色海浪纹，做完就想买机票飞三亚✈️实物比照片好看一百倍！夏天一定要做一次蓝色系🐚#海洋风 #渐变蓝", "style_idx": 24, "user_idx": 4},
    {"title": "酒红绒面甲🍷秋冬氛围感的神", "content": "显白届的王者回来了！丝绒质感的酒红色，配大衣配围巾不要太好看。又A又御，冷艳姐姐必做款🖤#酒红美甲 #秋冬", "style_idx": 19, "user_idx": 2},
    {"title": "琥珀色晕染🍂像把秋天封在了指尖", "content": "焦糖色到透明色的过渡晕染太美了，像琥珀一样～配毛衣绝了！美甲师说这个款最近超火🔥#晕染美甲 #琥珀色", "style_idx": 12, "user_idx": 0},
    {"title": "薰衣草紫短甲💜短甲星人的春天来了", "content": "淡淡的紫色好温柔，短甲做纯色居然这么好看！之前一直觉得短甲不好做美甲，是我打开方式不对🤭#短甲 #薰衣草色", "style_idx": 15, "user_idx": 1},
    {"title": "通勤日系极简风⚫️黑白就是最高级的", "content": "黑白色块的几何搭配，简约但好有设计感。上班开会疯狂转笔也不会太突兀，同事说像艺术品哈哈哈#极简美甲 #黑白", "style_idx": 23, "user_idx": 3},
    {"title": "璀璨贴钻甲💎这辈子一定要做一次", "content": "虽然不是日常款但真的太美了！婚礼/年会/生日趴都很值。钻在灯光下闪到不行，全程不忍心干活怕刮到🥹#贴钻美甲 #华丽款", "style_idx": 23, "user_idx": 4},
]

TAGS = [
    "猫眼", "通勤", "裸色", "极简", "手绘", "彩绘", "日式", "贴钻",
    "果冻", "渐变", "法式", "闪粉", "晕染", "跳色", "方甲", "圆甲",
    "短甲", "长甲", "杏仁甲",
]


async def main():
    print("Creating tables...")
    await init_db()

    db = async_session_factory()

    try:
        # ========== 用户 ==========
        user_objs = []
        for u in USERS:
            existing = (await db.execute(select(User).where(User.username == u["username"]))).scalar_one_or_none()
            if existing:
                user_objs.append(existing)
                continue
            obj = User(
                username=u["username"], password_hash=hash_password("123456"),
                nickname=u["nickname"], bio=u["bio"], role=u["role"],
            )
            db.add(obj)
            user_objs.append(obj)
        await db.flush()
        print(f"Created {len(user_objs)} users")

        # ========== 商家 ==========
        merchant_objs = []
        for i, m in enumerate(MERCHANTS):
            existing = (await db.execute(select(Merchant).where(Merchant.name == m["name"]))).scalar_one_or_none()
            if existing:
                merchant_objs.append(existing)
                continue
            obj = Merchant(
                name=m["name"], city=m["city"], district=m["district"],
                address=m["address"], business_hours=m["business_hours"],
                phone=m["phone"], rating=m["rating"], description=m["description"],
                tags=m["tags"], images=m.get("images", []),
                time_slots=[
                    {"start": "09:00", "end": "10:00", "max_bookings": 2},
                    {"start": "10:00", "end": "11:00", "max_bookings": 2},
                    {"start": "11:00", "end": "12:00", "max_bookings": 2},
                    {"start": "14:00", "end": "15:00", "max_bookings": 2},
                    {"start": "15:00", "end": "16:00", "max_bookings": 2},
                    {"start": "16:00", "end": "17:00", "max_bookings": 3},
                    {"start": "17:00", "end": "18:00", "max_bookings": 3},
                ],
                user_id=user_objs[5 + i].id if 5 + i < len(user_objs) else None,
            )
            db.add(obj)
            merchant_objs.append(obj)
        await db.flush()
        print(f"Created {len(merchant_objs)} merchants")

        # ========== 标签 ==========
        tag_objs = {}
        for t_name in TAGS:
            obj = NailTag(name=t_name, tag_type="style")
            db.add(obj)
            tag_objs[t_name] = obj
        await db.flush()
        print(f"Created {len(tag_objs)} tags")

        # ========== 美甲款式（25款，均分3家店铺）==========
        style_objs = []
        for i, s in enumerate(STYLES):
            mid = i % 3  # 均分到3家店铺
            obj = NailStyle(
                name=s["name"], description=s["desc"],
                image_url=f"styles/style_{i + 1:02d}.png",
                category=s["category"], color_tone=s["color_tone"],
                scene=s["scene"], nail_shape=s["nail_shape"],
                price=s["price"], original_price=int(s["price"] * 1.2),
                merchant_id=merchant_objs[mid].id,
                popularity=100 + (25 - i) * 5 + i * 3,  # varied popularity
            )
            db.add(obj)
            style_objs.append(obj)
        await db.flush()
        print(f"Created {len(style_objs)} nail styles")

        # ========== 款式-标签关联 ==========
        tag_assignments = [
            (0, ["通勤", "短甲"]), (1, ["裸色", "法式"]), (2, ["猫眼", "长甲"]),
            (3, ["果冻", "圆甲"]), (4, ["极简", "法式", "短甲"]), (5, ["手绘", "方甲"]),
            (6, ["裸色", "渐变", "长甲"]), (7, ["猫眼", "圆甲"]), (8, ["通勤", "短甲"]),
            (9, ["手绘", "跳色", "长甲"]), (10, ["裸色", "法式"]), (11, ["极简", "短甲"]),
            (12, ["手绘", "晕染"]), (13, ["果冻", "圆甲"]), (14, ["猫眼", "长甲"]),
            (15, ["果冻", "短甲"]), (16, ["裸色", "渐变"]), (17, ["手绘", "闪粉"]),
            (18, ["果冻", "短甲"]), (19, ["手绘", "长甲"]), (20, ["果冻", "裸色"]),
            (21, ["极简", "短甲"]), (22, ["极简", "短甲"]), (23, ["手绘", "贴钻", "长甲"]),
            (24, ["手绘", "渐变"]),
        ]
        for style_idx, tag_names in tag_assignments:
            for t_name in tag_names:
                if t_name in tag_objs:
                    db.add(StyleTag(style_id=style_objs[style_idx].id, tag_id=tag_objs[t_name].id))
        await db.flush()
        print("Style-tag associations created")

        # ========== 帖子 ==========
        post_objs = []
        for p in POSTS:
            obj = Post(
                title=p["title"], content=p["content"],
                image_url=f"styles/style_{p['style_idx'] + 1:02d}.png",
                images=[f"styles/style_{p['style_idx'] + 1:02d}.png"],
                user_id=user_objs[p["user_idx"]].id,
                style_id=style_objs[p["style_idx"]].id,
                likes_count=p["style_idx"] * 15 + 10,
            )
            db.add(obj)
            post_objs.append(obj)
        await db.flush()
        print(f"Created {len(post_objs)} posts")

        # ========== 预设手图 ==========
        for i in range(3):
            h = HandImage(
                user_id=None, image_url=f"hands/preset_{i + 1}.png",
                skin_tone="natural", hand_type="left", is_preset=True,
            )
            db.add(h)
        await db.flush()
        print("Created preset hand images")

        await db.commit()  # Explicit commit

        print("\n===== 数据导入完成 =====")
        print(f"用户: {len(user_objs)}")
        print(f"商家: {len(merchant_objs)}")
        print(f"美甲款式: {len(style_objs)}")
        print(f"帖子: {len(post_objs)}")
        print(f"标签: {len(tag_objs)}")
        print("\n默认密码: 123456")

    except Exception as e:
        await db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
