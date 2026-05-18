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
    avg_duration: Mapped[int] = mapped_column(Integer, default=0)
    hot_score: Mapped[float] = mapped_column(Float, default=0.0)


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
