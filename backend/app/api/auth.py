"""
用户认证 API
"""
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.logger import get_logger
from app.models.models import User, Appointment, Post, UserFavoriteMerchant, UserFavoriteStyle
from app.schemas.schemas import UserRegister, UserLogin, TokenResponse, UserOut, UserUpdate

router = APIRouter()
logger = get_logger("auth")


class PasswordChange(BaseModel):
    """密码修改请求体"""
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=128)


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="未提供认证令牌")
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="令牌无效或已过期")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="令牌格式错误")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


@router.post("/auth/register", response_model=TokenResponse)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    logger.info(f"用户注册 | username={body.username} role={body.role}")
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        nickname=body.nickname or body.username,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    token = create_access_token({"sub": str(user.id)})
    logger.info(f"注册成功 | user_id={user.id}")
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    logger.info(f"用户登录 | username={body.username}")
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        logger.warning(f"登录失败 | username={body.username} 密码错误或用户不存在")
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token({"sub": str(user.id)})
    logger.info(f"登录成功 | user_id={user.id} role={user.role}")
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/auth/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.put("/auth/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"更新个人信息 | user={user.id}")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    return UserOut.model_validate(user)


@router.post("/auth/upload-avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传用户头像到本地存储"""
    logger.info(f"上传头像 | user={user.id} file={file.filename}")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片文件")

    from app.services.local_image_service import save_image

    content = await file.read()
    image_path = save_image(content, "avatars", file.filename)

    user.avatar_url = image_path
    await db.flush()

    logger.info(f"头像上传完成 | user={user.id} path={image_path}")
    return {"avatar_url": image_path, "message": "上传成功"}


@router.get("/auth/stats")
async def get_user_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """返回当前用户的聚合统计数据"""
    logger.info(f"获取用户统计 | user={user.id}")

    appointment_count = (await db.execute(
        select(func.count()).select_from(Appointment).where(Appointment.user_id == user.id)
    )).scalar() or 0

    post_count = (await db.execute(
        select(func.count()).select_from(Post).where(Post.user_id == user.id)
    )).scalar() or 0

    favorite_style_count = (await db.execute(
        select(func.count()).select_from(UserFavoriteStyle).where(UserFavoriteStyle.user_id == user.id)
    )).scalar() or 0

    favorite_merchant_count = (await db.execute(
        select(func.count()).select_from(UserFavoriteMerchant).where(UserFavoriteMerchant.user_id == user.id)
    )).scalar() or 0

    logger.info(
        f"用户统计完成 | user={user.id} "
        f"appointments={appointment_count} posts={post_count} "
        f"fav_styles={favorite_style_count} fav_merchants={favorite_merchant_count}"
    )
    return {
        "appointment_count": appointment_count,
        "post_count": post_count,
        "favorite_style_count": favorite_style_count,
        "favorite_merchant_count": favorite_merchant_count,
    }


@router.post("/auth/change-password")
async def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改当前用户密码"""
    logger.info(f"修改密码 | user={user.id}")

    if not verify_password(body.old_password, user.password_hash):
        logger.warning(f"密码修改失败 | user={user.id} 原密码错误")
        raise HTTPException(status_code=400, detail="原密码错误")

    user.password_hash = hash_password(body.new_password)
    await db.flush()

    logger.info(f"密码修改成功 | user={user.id}")
    return {"message": "密码修改成功"}
