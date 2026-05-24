from datetime import datetime
from sqlalchemy import String, Integer, Float, Text, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class NailStyle(Base):
    __tablename__ = "nail_styles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    original_url: Mapped[str] = mapped_column(Text, default="")
    enhanced_url: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(50), default="")
    color_tone: Mapped[str] = mapped_column(String(50), default="")
    tags: Mapped[dict] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    popularity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class HandImage(Base):
    __tablename__ = "hand_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    image_url: Mapped[str] = mapped_column(Text, default="")
    local_path: Mapped[str] = mapped_column(String(500), default="")
    skin_tone: Mapped[str] = mapped_column(String(20), default="")
    hand_type: Mapped[str] = mapped_column(String(20), default="")
    landmarks: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TryonRecord(Base):
    __tablename__ = "tryon_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hand_image_id: Mapped[int] = mapped_column(Integer, ForeignKey("hand_images.id"), nullable=True)
    nail_style_id: Mapped[int] = mapped_column(Integer, ForeignKey("nail_styles.id"), nullable=True)
    result_url: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StyleMetrics(Base):
    __tablename__ = "style_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_id: Mapped[int] = mapped_column(Integer, ForeignKey("nail_styles.id"))
    date: Mapped[datetime] = mapped_column(DateTime)
    views: Mapped[int] = mapped_column(Integer, default=0)
    tryons: Mapped[int] = mapped_column(Integer, default=0)
    favorites: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    orders: Mapped[int] = mapped_column(Integer, default=0)
    refunds: Mapped[int] = mapped_column(Integer, default=0)
    avg_duration: Mapped[int] = mapped_column(Integer, default=0)
    hot_score: Mapped[float] = mapped_column(Float, default=0.0)


# ── Operations tables (Meituan-style dashboard) ──────────────

class Order(Base):
    """订单表 — 模拟美团美甲店铺真实订单"""
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, default="")
    style_id: Mapped[int] = mapped_column(Integer, ForeignKey("nail_styles.id"), nullable=True)
    user_id: Mapped[str] = mapped_column(String(32), default="")
    amount: Mapped[float] = mapped_column(Float, default=0.0)       # 实付金额
    original_amount: Mapped[float] = mapped_column(Float, default=0.0)  # 原价
    coupon_discount: Mapped[float] = mapped_column(Float, default=0.0)  # 优惠券抵扣
    status: Mapped[str] = mapped_column(String(20), default="paid")  # paid/refunded/partial_refund
    payment_method: Mapped[str] = mapped_column(String(20), default="wechat")
    is_new_customer: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Refund(Base):
    """退款表"""
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    reason: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(20), default="completed")  # pending/approved/completed/rejected
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Review(Base):
    """用户评价表"""
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("orders.id"), nullable=True)
    style_id: Mapped[int] = mapped_column(Integer, ForeignKey("nail_styles.id"), nullable=True)
    user_id: Mapped[str] = mapped_column(String(32), default="")
    rating: Mapped[int] = mapped_column(Integer, default=5)             # 1-5 星
    tags: Mapped[str] = mapped_column(String(200), default="")          # 效果好评/服务好/性价比高
    comment: Mapped[str] = mapped_column(Text, default="")
    has_photo: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class DailyRevenue(Base):
    """每日营收汇总"""
    __tablename__ = "daily_revenue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime] = mapped_column(DateTime, unique=True)
    gross_revenue: Mapped[float] = mapped_column(Float, default=0.0)    # 总营收
    net_revenue: Mapped[float] = mapped_column(Float, default=0.0)      # 净营收(扣退款)
    order_count: Mapped[int] = mapped_column(Integer, default=0)        # 订单数
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0)    # 退款金额
    refund_count: Mapped[int] = mapped_column(Integer, default=0)       # 退款单数
    new_customer_orders: Mapped[int] = mapped_column(Integer, default=0)  # 新客订单
    repeat_customer_orders: Mapped[int] = mapped_column(Integer, default=0)  # 老客订单
    coupon_discount_total: Mapped[float] = mapped_column(Float, default=0.0)  # 优惠券总抵扣
    avg_order_value: Mapped[float] = mapped_column(Float, default=0.0)  # 客单价


class TrafficMetrics(Base):
    """流量数据"""
    __tablename__ = "traffic_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime] = mapped_column(DateTime)
    exposure: Mapped[int] = mapped_column(Integer, default=0)           # 曝光量
    click: Mapped[int] = mapped_column(Integer, default=0)              # 点击/进店
    visit: Mapped[int] = mapped_column(Integer, default=0)              # 浏览UV
    order_conversion: Mapped[int] = mapped_column(Integer, default=0)   # 下单转化数
    ctr: Mapped[float] = mapped_column(Float, default=0.0)              # 点击率(%)
    cvr: Mapped[float] = mapped_column(Float, default=0.0)              # 转化率(%)
    source: Mapped[str] = mapped_column(String(30), default="organic")  # organic/ad/search/recommend


class CouponUsage(Base):
    """优惠券使用"""
    __tablename__ = "coupon_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[datetime] = mapped_column(DateTime)
    issued: Mapped[int] = mapped_column(Integer, default=0)             # 发放数
    used: Mapped[int] = mapped_column(Integer, default=0)               # 核销数
    discount_total: Mapped[float] = mapped_column(Float, default=0.0)   # 总优惠金额
    usage_rate: Mapped[float] = mapped_column(Float, default=0.0)       # 核销率(%)
    campaign: Mapped[str] = mapped_column(String(50), default="新人券")  # 活动名称


class OperationsReport(Base):
    __tablename__ = "operations_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_type: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text, default="")
    metrics: Mapped[dict] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class UserFeedback(Base):
    __tablename__ = "user_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tryon_id: Mapped[int] = mapped_column(Integer, ForeignKey("tryon_records.id"), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
