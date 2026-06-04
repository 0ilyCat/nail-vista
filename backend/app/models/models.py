"""
NailVista 数据库模型 — MySQL 企业级库表设计

核心实体表:
  users, merchants, nail_styles, nail_tags, style_tags,
  posts, post_likes, appointments,
  chat_sessions, chat_messages,
  tryon_effects, hand_images

关系表:
  user_favorite_merchants, user_favorite_styles
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime,
    ForeignKey, JSON, Enum as SAEnum, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def gen_uuid():
    return uuid.uuid4().hex


# ============================================================
# 用户表
# ============================================================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(128), default="")
    avatar_url = Column(String(512), default="")
    phone = Column(String(20), default="")
    email = Column(String(128), default="")
    role = Column(String(16), default="user")  # user / merchant / admin
    bio = Column(Text, default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # 关系
    posts = relationship("Post", back_populates="author")
    hand_images = relationship("HandImage", back_populates="user")
    appointments = relationship("Appointment", back_populates="user", foreign_keys="Appointment.user_id")
    tryon_effects = relationship("TryonEffect", back_populates="user")
    favorite_merchants = relationship("UserFavoriteMerchant", back_populates="user")
    favorite_styles = relationship("UserFavoriteStyle", back_populates="user")


# ============================================================
# 商家表
# ============================================================
class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, index=True)
    description = Column(Text, default="")
    logo_url = Column(String(512), default="")
    images = Column(JSON, default=list)  # ["/static/merchants/xxx/1.jpg", ...]
    city = Column(String(64), default="")
    district = Column(String(64), default="")
    address = Column(String(256), default="")
    business_hours = Column(String(128), default="")
    phone = Column(String(20), default="")
    rating = Column(Float, default=5.0)
    review_count = Column(Integer, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    tags = Column(JSON, default=list)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 关联的运营账号
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # 关系
    styles = relationship("NailStyle", back_populates="merchant")
    appointments = relationship("Appointment", back_populates="merchant", foreign_keys="Appointment.merchant_id")
    favorites = relationship("UserFavoriteMerchant", back_populates="merchant")


# ============================================================
# 美甲款式表
# ============================================================
class NailStyle(Base):
    __tablename__ = "nail_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, index=True)
    description = Column(Text, default="")
    image_url = Column(String(512), default="")
    category = Column(String(64), default="")       # 风格：猫眼/通勤/裸色/极简/手绘/彩绘...
    color_tone = Column(String(64), default="")     # 色系：粉/红/蓝/绿/黑/白...
    scene = Column(String(64), default="")          # 场景：约会/通勤/派对/婚礼...
    nail_shape = Column(String(32), default="")     # 甲型：短甲/长甲/方甲/圆甲/杏仁甲
    difficulty = Column(String(16), default="medium")  # easy/medium/hard
    price = Column(Float, default=0.0)
    original_price = Column(Float, default=0.0)
    popularity = Column(Float, default=0.0)
    tryon_count = Column(Integer, default=0)
    favorite_count = Column(Integer, default=0)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # 关系
    merchant = relationship("Merchant", back_populates="styles")
    tags = relationship("StyleTag", back_populates="style")
    posts = relationship("Post", back_populates="style")
    appointments = relationship("Appointment", back_populates="style")
    tryon_effects = relationship("TryonEffect", back_populates="style")
    favorites = relationship("UserFavoriteStyle", back_populates="style")


# ============================================================
# 美甲标签表
# ============================================================
class NailTag(Base):
    __tablename__ = "nail_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), unique=True, nullable=False)
    tag_type = Column(String(32), default="style")  # style/element/scene/shape
    created_at = Column(DateTime, default=utcnow)

    styles = relationship("StyleTag", back_populates="tag")


class StyleTag(Base):
    __tablename__ = "style_tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    style_id = Column(Integer, ForeignKey("nail_styles.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("nail_tags.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    style = relationship("NailStyle", back_populates="tags")
    tag = relationship("NailTag", back_populates="styles")

    __table_args__ = (
        UniqueConstraint("style_id", "tag_id", name="uq_style_tag"),
    )


# ============================================================
# 帖子表
# ============================================================
class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(256), nullable=False)
    content = Column(Text, default="")
    image_url = Column(String(512), default="")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    style_id = Column(Integer, ForeignKey("nail_styles.id"), nullable=True)
    likes_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    is_official = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # 关系
    author = relationship("User", back_populates="posts")
    style = relationship("NailStyle", back_populates="posts")
    likes = relationship("PostLike", back_populates="post")

    __table_args__ = (
        Index("idx_posts_created", "created_at"),
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    post = relationship("Post", back_populates="likes")

    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_user_like"),
    )


# ============================================================
# 预约记录表
# ============================================================
class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False, index=True)
    style_id = Column(Integer, ForeignKey("nail_styles.id"), nullable=True)
    service_item = Column(String(256), default="")
    appointment_time = Column(DateTime, nullable=True)
    status = Column(String(32), default="pending")  # pending/confirmed/completed/cancelled
    notes = Column(Text, default="")
    price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="appointments", foreign_keys=[user_id])
    merchant = relationship("Merchant", back_populates="appointments", foreign_keys=[merchant_id])
    style = relationship("NailStyle", back_populates="appointments")


# ============================================================
# AI对话 Session 表
# ============================================================
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    session_key = Column(String(64), unique=True, default=gen_uuid, index=True)
    title = Column(String(256), default="新对话")
    agent_type = Column(String(32), default="user")  # user/dashboard/merchant
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    messages = relationship("ChatMessage", back_populates="session", order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(16), nullable=False)  # user / assistant / system
    content = Column(Text, default="")
    tool_calls = Column(JSON, nullable=True)
    thinking = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    session = relationship("ChatSession", back_populates="messages")


# ============================================================
# 试戴效果图表
# ============================================================
class TryonEffect(Base):
    __tablename__ = "tryon_effects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    hand_image_id = Column(Integer, ForeignKey("hand_images.id"), nullable=True)
    style_id = Column(Integer, ForeignKey("nail_styles.id"), nullable=False)
    result_url = Column(String(512), default="")
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="tryon_effects")
    hand_image = relationship("HandImage", back_populates="tryon_effects")
    style = relationship("NailStyle", back_populates="tryon_effects")


# ============================================================
# 用户上传手图表
# ============================================================
class HandImage(Base):
    __tablename__ = "hand_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    image_url = Column(String(512), nullable=False)
    skin_tone = Column(String(32), default="")
    hand_type = Column(String(32), default="")  # left/right
    is_preset = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="hand_images")
    tryon_effects = relationship("TryonEffect", back_populates="hand_image")


# ============================================================
# 用户收藏 — 商家 (逻辑外键)
# ============================================================
class UserFavoriteMerchant(Base):
    __tablename__ = "user_favorite_merchants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    merchant_id = Column(Integer, ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="favorite_merchants")
    merchant = relationship("Merchant", back_populates="favorites")

    __table_args__ = (
        UniqueConstraint("user_id", "merchant_id", name="uq_user_merchant_fav"),
    )


# ============================================================
# 用户收藏 — 美甲款式 (逻辑外键)
# ============================================================
class UserFavoriteStyle(Base):
    __tablename__ = "user_favorite_styles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    style_id = Column(Integer, ForeignKey("nail_styles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="favorite_styles")
    style = relationship("NailStyle", back_populates="favorites")

    __table_args__ = (
        UniqueConstraint("user_id", "style_id", name="uq_user_style_fav"),
    )
