"""
NailVista 帖子数据导入脚本 — 清空旧帖子后导入新帖（不影响用户、商家、款式等已有数据）
用法: python import_posts.py
"""
import sys
sys.path.insert(0, ".")

import asyncio
from datetime import datetime, timezone
from app.core.database import async_session_factory, init_db
from app.models.models import User, NailStyle, Post, PostLike

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


async def main():
    print("Importing posts...")
    await init_db()

    db = async_session_factory()

    try:
        from sqlalchemy import select, delete as sql_delete

        # 加载已有用户（按索引匹配）
        users = (await db.execute(select(User).order_by(User.id))).scalars().all()
        # 加载已有款式（按索引匹配）
        styles = (await db.execute(select(NailStyle).order_by(NailStyle.id))).scalars().all()

        if len(users) < 8 or len(styles) < 25:
            print(f"警告：用户数={len(users)} 款式数={len(styles)}，请先运行 import_data.py 导入基础数据")
            return

        # 清空旧帖子和点赞
        await db.execute(sql_delete(PostLike))
        await db.execute(sql_delete(Post))
        await db.flush()
        print("已清空旧帖子")

        # 插入新帖子
        count = 0
        for p in POSTS:
            user = users[p["user_idx"]]
            style = styles[p["style_idx"]]
            obj = Post(
                title=p["title"],
                content=p["content"],
                image_url=f"styles/style_{p['style_idx'] + 1:02d}.png",
                images=[f"styles/style_{p['style_idx'] + 1:02d}.png"],
                user_id=user.id,
                style_id=style.id,
                likes_count=p["style_idx"] * 15 + 10,
            )
            db.add(obj)
            count += 1

        await db.commit()
        print(f"导入完成！共 {count} 条帖子")

    except Exception as e:
        await db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
