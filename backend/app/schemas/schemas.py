"""
Pydantic 请求/响应 Schema 定义
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============================================================
# 认证
# ============================================================
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    nickname: Optional[str] = ""
    role: Optional[str] = "user"  # user / merchant

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class UserOut(BaseModel):
    id: int
    username: str
    nickname: str
    avatar_url: str
    role: str
    bio: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


# ============================================================
# 商家
# ============================================================
class MerchantOut(BaseModel):
    id: int
    name: str
    description: str
    logo_url: str
    images: List[str] = []
    city: str
    district: str
    address: str
    business_hours: str
    phone: str
    rating: float
    review_count: int
    tags: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class MerchantDetail(MerchantOut):
    styles: List["NailStyleOut"] = []


# ============================================================
# 美甲款式
# ============================================================
class NailStyleOut(BaseModel):
    id: int
    name: str
    description: str
    image_url: str
    category: str
    color_tone: str
    scene: str
    nail_shape: str
    difficulty: str
    price: float
    original_price: float
    popularity: float
    tryon_count: int
    favorite_count: int
    merchant_id: int
    merchant_name: Optional[str] = ""
    tags: List[str] = []
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class NailStyleDetail(NailStyleOut):
    merchant: Optional[MerchantOut] = None


# ============================================================
# 帖子
# ============================================================
class PostCreate(BaseModel):
    title: str = Field(..., max_length=256)
    content: Optional[str] = ""
    image_url: Optional[str] = ""
    images: Optional[List[str]] = []  # 多图：最多3张
    style_id: Optional[int] = None

class PostOut(BaseModel):
    id: int
    title: str
    content: str
    image_url: str
    images: List[str] = []
    user_id: int
    author_name: Optional[str] = ""
    author_avatar: Optional[str] = ""
    style_id: Optional[int] = None
    style_name: Optional[str] = ""
    style_price: Optional[float] = 0.0
    likes_count: int
    favorites_count: int
    is_liked: bool = False
    is_favorited: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class PostDetail(PostOut):
    style: Optional[NailStyleOut] = None
    related_posts: List[PostOut] = []


# ============================================================
# 预约
# ============================================================
class AppointmentCreate(BaseModel):
    merchant_id: int
    style_id: Optional[int] = None
    service_item: Optional[str] = ""
    appointment_time: Optional[datetime] = None
    notes: Optional[str] = ""
    price: Optional[float] = 0.0

class AppointmentOut(BaseModel):
    id: int
    user_id: int
    merchant_id: int
    merchant_name: Optional[str] = ""
    style_id: Optional[int] = None
    style_name: Optional[str] = ""
    style_image: Optional[str] = ""
    service_item: str
    appointment_time: Optional[datetime] = None
    status: str
    notes: str
    price: float
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# AI聊天
# ============================================================
class ChatRequest(BaseModel):
    message: str
    session_key: Optional[str] = None
    image_url: Optional[str] = None

class ChatSessionOut(BaseModel):
    session_key: str
    title: str
    agent_type: str
    message_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    tool_calls: Optional[dict] = None
    thinking: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# 试戴
# ============================================================
class TryonRequest(BaseModel):
    hand_image_id: int
    style_id: int

class TryonEffectOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    hand_image_id: Optional[int] = None
    style_id: int
    style_name: Optional[str] = ""
    result_url: str
    created_at: datetime

    class Config:
        from_attributes = True

class HandImageOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    image_url: str
    skin_tone: str
    hand_type: str
    is_preset: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# 商家仪表盘
# ============================================================
class DashboardOverview(BaseModel):
    total_appointments: int = 0
    completed_appointments: int = 0
    pending_appointments: int = 0
    total_revenue: float = 0.0
    avg_order_value: float = 0.0
    top_styles: List[dict] = []
    monthly_trend: List[dict] = []


# ============================================================
# 搜索
# ============================================================
class SearchResult(BaseModel):
    styles: List[NailStyleOut] = []
    posts: List[PostOut] = []
    merchants: List[MerchantOut] = []


# ============================================================
# 分页
# ============================================================
class PaginatedResponse(BaseModel):
    items: List
    total: int
    page: int
    page_size: int
    total_pages: int
