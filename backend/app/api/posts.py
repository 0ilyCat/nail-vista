"""
帖子社区路由 — 列表 / 详情 / 发布 / 删除 / 点赞 / 收藏 / 图片上传
"""
import math
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Header, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.config import settings
from app.core.security import decode_access_token
from app.core.logger import get_logger
from app.models.models import User, Post, PostLike, NailStyle, UserFavoriteStyle, StyleTag, NailTag
from app.schemas.schemas import PostCreate
from app.api.auth import get_current_user

router = APIRouter()
logger = get_logger("nailvista.posts")


from app.services.local_image_service import get_image_url


def _image_url(path: str) -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    return get_image_url(path)


# ──────────────────────── 可选认证依赖 ────────────────────────
async def get_optional_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """尝试从 Authorization 头提取当前用户，未登录返回 None"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    payload = decode_access_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    return await db.get(User, int(user_id))


# ──────────────────────── 帖子列表 ────────────────────────
@router.get("/posts")
async def list_posts(
    tab: str = Query("recommend", description="recommend=按点赞 / latest=按时间"),
    style_id: int = Query(None, description="筛选特定款式"),
    user_id: int = Query(None, description="筛选特定用户"),
    search: str = Query("", description="关键词搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(
        f"GET /posts tab={tab!r} style_id={style_id} user_id={user_id} search={search!r} "
        f"page={page} page_size={page_size} user={current_user.id if current_user else 'anon'}"
    )

    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.style),
        )
    )

    if style_id is not None:
        stmt = stmt.where(Post.style_id == style_id)
    if user_id is not None:
        stmt = stmt.where(Post.user_id == user_id)
    if search:
        stmt = stmt.where(Post.title.contains(search) | Post.content.contains(search))

    if tab == "latest":
        stmt = stmt.order_by(desc(Post.created_at))
    else:
        stmt = stmt.order_by(desc(Post.likes_count), desc(Post.created_at))

    # 总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    total_pages = max(1, math.ceil(total / page_size))

    # 分页
    offset = (page - 1) * page_size
    stmt = stmt.offset(offset).limit(page_size)

    result = await db.execute(stmt)
    posts = result.unique().scalars().all()

    # 批量查询点赞状态
    liked_post_ids = set()
    if current_user and posts:
        liked_result = await db.execute(
            select(PostLike.post_id).where(
                PostLike.user_id == current_user.id,
                PostLike.post_id.in_([p.id for p in posts]),
            )
        )
        liked_post_ids = {row[0] for row in liked_result.all()}

    items = []
    for p in posts:
        post_images = (p.images or [])
        main_image = post_images[0] if post_images else p.image_url
        items.append({
            "id": p.id,
            "title": p.title,
            "content": p.content or "",
            "image_url": _image_url(main_image) if main_image else "",
            "images": [_image_url(img) for img in post_images],
            "user_id": p.user_id,
            "author_name": p.author.nickname or p.author.username if p.author else "",
            "author_avatar": _image_url(p.author.avatar_url) if p.author else "",
            "style_id": p.style_id,
            "style_name": p.style.name if p.style else "",
            "style_price": p.style.price if p.style else 0.0,
            "likes_count": p.likes_count,
            "favorites_count": p.favorites_count,
            "is_liked": p.id in liked_post_ids,
            "created_at": p.created_at,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ──────────────────────── 帖子详情 ────────────────────────
@router.get("/posts/{post_id}")
async def post_detail(
    post_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"GET /posts/{post_id} user={current_user.id if current_user else 'anon'}")

    stmt = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.style).selectinload(NailStyle.merchant),
            selectinload(Post.style).selectinload(NailStyle.tags).selectinload(StyleTag.tag),
        )
        .where(Post.id == post_id)
    )
    result = await db.execute(stmt)
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "帖子不存在")

    # 当前用户是否已点赞
    is_liked = False
    if current_user:
        like_record = await db.execute(
            select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
        )
        is_liked = like_record.scalar_one_or_none() is not None

    # 同款相关帖子 (limit 4)
    related_items = []
    if post.style_id:
        related_stmt = (
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.style_id == post.style_id, Post.id != post.id)
            .order_by(desc(Post.likes_count), desc(Post.created_at))
            .limit(4)
        )
        related_result = await db.execute(related_stmt)
        related_posts = related_result.scalars().all()

        for rp in related_posts:
            related_items.append({
                "id": rp.id,
                "title": rp.title,
                "content": rp.content or "",
                "image_url": _image_url(rp.image_url),
                "user_id": rp.user_id,
                "author_name": rp.author.nickname or rp.author.username if rp.author else "",
                "author_avatar": _image_url(rp.author.avatar_url) if rp.author else "",
                "style_id": rp.style_id,
                "likes_count": rp.likes_count,
                "created_at": rp.created_at,
            })

    style = post.style
    author = post.author

    style_data = None
    if style:
        style_data = {
            "id": style.id,
            "name": style.name,
            "description": style.description or "",
            "image_url": _image_url(style.image_url),
            "category": style.category or "",
            "color_tone": style.color_tone or "",
            "scene": style.scene or "",
            "nail_shape": style.nail_shape or "",
            "difficulty": style.difficulty or "medium",
            "price": style.price,
            "original_price": style.original_price,
            "popularity": style.popularity,
            "tryon_count": style.tryon_count,
            "favorite_count": style.favorite_count,
            "merchant_id": style.merchant_id,
            "merchant_name": style.merchant.name if style.merchant else "",
            "tags": [st.tag.name for st in style.tags if st.tag],
            "is_active": style.is_active,
            "created_at": style.created_at,
        }

    return {
        "id": post.id,
        "title": post.title,
        "content": post.content or "",
        "image_url": _image_url(post.image_url),
        "images": [_image_url(img) for img in (post.images or [])],
        "user_id": post.user_id,
        "author_name": author.nickname or author.username if author else "",
        "author_avatar": _image_url(author.avatar_url) if author else "",
        "style_id": post.style_id,
        "style_name": style.name if style else "",
        "style_price": style.price if style else 0.0,
        "likes_count": post.likes_count,
        "favorites_count": post.favorites_count,
        "is_liked": is_liked,
        "created_at": post.created_at,
        "style": style_data,
        "related_posts": related_items,
    }


# ──────────────────────── 发布帖子 ────────────────────────
@router.post("/posts")
async def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"POST /posts body={body.model_dump()} user_id={current_user.id}")

    if body.style_id:
        style = await db.get(NailStyle, body.style_id)
        if not style:
            raise HTTPException(404, "关联款式不存在")

    post = Post(
        title=body.title,
        content=body.content or "",
        image_url=body.image_url or "",
        images=body.images or [],
        user_id=current_user.id,
        style_id=body.style_id,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    logger.info(f"POST /posts done | post_id={post.id}")
    return {
        "id": post.id,
        "title": post.title,
        "content": post.content or "",
        "image_url": _image_url(post.image_url),
        "user_id": post.user_id,
        "style_id": post.style_id,
        "likes_count": post.likes_count,
        "created_at": post.created_at,
        "message": "发布成功",
    }


# ──────────────────────── 删除帖子 ────────────────────────
@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"DELETE /posts/{post_id} user_id={current_user.id}")

    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "帖子不存在")
    if post.user_id != current_user.id:
        raise HTTPException(403, "无权删除他人帖子")

    await db.delete(post)
    await db.commit()

    logger.info(f"DELETE /posts/{post_id} done")
    return {"message": "已删除"}


# ──────────────────────── 点赞/取消点赞 ────────────────────────
@router.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"POST /posts/{post_id}/like user_id={current_user.id}")

    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "帖子不存在")

    existing = (await db.execute(
        select(PostLike).where(
            PostLike.post_id == post_id,
            PostLike.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        post.likes_count = max(0, post.likes_count - 1)
        await db.commit()
        logger.info(f"POST /posts/{post_id}/like | unliked | likes_count={post.likes_count}")
        return {"liked": False, "likes_count": post.likes_count}
    else:
        new_like = PostLike(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        post.likes_count += 1
        await db.commit()
        logger.info(f"POST /posts/{post_id}/like | liked | likes_count={post.likes_count}")
        return {"liked": True, "likes_count": post.likes_count}


# ──────────────────────── 收藏/取消收藏 ────────────────────────
@router.post("/posts/{post_id}/favorite")
async def toggle_favorite(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"POST /posts/{post_id}/favorite user_id={current_user.id}")

    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(404, "帖子不存在")

    if not post.style_id:
        raise HTTPException(400, "该帖子未关联款式，无法收藏")

    existing = (await db.execute(
        select(UserFavoriteStyle).where(
            UserFavoriteStyle.user_id == current_user.id,
            UserFavoriteStyle.style_id == post.style_id,
        )
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        style = await db.get(NailStyle, post.style_id)
        if style:
            style.favorite_count = max(0, style.favorite_count - 1)
        post.favorites_count = max(0, post.favorites_count - 1)
        await db.commit()
        logger.info(f"POST /posts/{post_id}/favorite | unfavorited")
        return {"favorited": False, "favorites_count": post.favorites_count}
    else:
        new_fav = UserFavoriteStyle(user_id=current_user.id, style_id=post.style_id)
        db.add(new_fav)
        style = await db.get(NailStyle, post.style_id)
        if style:
            style.favorite_count += 1
        post.favorites_count += 1
        await db.commit()
        logger.info(f"POST /posts/{post_id}/favorite | favorited | favorites_count={post.favorites_count}")
        return {"favorited": True, "favorites_count": post.favorites_count}


# ──────────────────────── 图片上传 ────────────────────────
@router.post("/posts/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"POST /posts/upload-image filename={file.filename} user_id={current_user.id}")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "仅支持图片文件")

    from app.services.local_image_service import save_image

    content = await file.read()
    image_path = save_image(content, "posts", file.filename)

    logger.info(f"POST /posts/upload-image done | path={image_path}")
    return {"image_url": image_path, "full_url": get_image_url(image_path), "message": "上传成功"}
