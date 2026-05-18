"""
趋势分析引擎 — 热度计算、排行榜、趋势检测
"""
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict


class TrendAnalyzer:
    """运营趋势分析器"""

    # 热度分权重
    WEIGHTS = {
        "tryon": 0.40,    # 试戴权重最高
        "favorite": 0.25,  # 收藏
        "view": 0.20,      # 浏览
        "share": 0.10,     # 分享
        "duration": 0.05,  # 浏览时长
    }

    def calc_hot_score(self, metrics: dict) -> float:
        """计算热度分"""
        score = (
            metrics.get("tryons", 0) * self.WEIGHTS["tryon"]
            + metrics.get("favorites", 0) * self.WEIGHTS["favorite"]
            + metrics.get("views", 0) * self.WEIGHTS["view"]
            + metrics.get("shares", 0) * self.WEIGHTS["share"]
            + min(metrics.get("avg_duration", 0) / 300, 1.0) * 100 * self.WEIGHTS["duration"]
        )
        return round(score, 2)

    def rank_styles(self, style_metrics: list[dict], limit: int = 10) -> list[dict]:
        """款式热度排行"""
        for sm in style_metrics:
            sm["hot_score"] = self.calc_hot_score(sm)
        ranked = sorted(style_metrics, key=lambda x: x["hot_score"], reverse=True)
        return ranked[:limit]

    def detect_rising_styles(self, current: list[dict], previous: list[dict], top_n: int = 5) -> list[dict]:
        """检测上升最快的款式"""
        prev_map = {s["style_id"]: s["hot_score"] for s in previous}
        changes = []
        for s in current:
            sid = s["style_id"]
            prev_score = prev_map.get(sid, 0)
            if prev_score > 0:
                change_pct = (s["hot_score"] - prev_score) / prev_score * 100
            else:
                change_pct = 100
            changes.append({**s, "change_pct": round(change_pct, 1)})
        return sorted(changes, key=lambda x: x["change_pct"], reverse=True)[:top_n]

    def compute_trend_data(self, time_series: list[dict], period_days: int = 7) -> dict:
        """计算趋势数据用于图表展示"""
        if not time_series:
            return {"labels": [], "tryons": [], "views": [], "favorites": []}

        result = {"labels": [], "tryons": [], "views": [], "favorites": [], "hot_scores": []}
        for item in time_series[-period_days:]:
            label = item.get("date", item.get("hour", ""))
            if isinstance(label, datetime):
                label = label.strftime("%m-%d")
            result["labels"].append(str(label))
            result["tryons"].append(item.get("tryons", 0))
            result["views"].append(item.get("views", 0))
            result["favorites"].append(item.get("favorites", 0))
            result["hot_scores"].append(item.get("hot_score", 0))
        return result


trend_analyzer = TrendAnalyzer()
