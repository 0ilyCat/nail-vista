"""
LongCat AI 对话服务 — OpenAI 兼容 API
"""
import logging
from openai import OpenAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class LongCatAIService:
    """LongCat AI 服务 — 通过 OpenAI 兼容 API 调用"""

    def __init__(self):
        settings = get_settings()
        self.client = OpenAI(
            base_url=settings.LONGCAT_BASE_URL,
            api_key=settings.LONGCAT_API_KEY,
        )
        self.model = settings.LONGCAT_MODEL
        self.available = bool(settings.LONGCAT_API_KEY)

    async def chat(self, messages: list[dict], **kwargs) -> str:
        """调用 LongCat 模型对话"""
        if not self.available:
            return self._mock_reply(messages[-1]["content"] if messages else "")

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 2048),
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LongCat API 调用失败: {e}")
            return self._mock_reply(messages[-1]["content"] if messages else "")

    async def generate_daily_report(self, metrics: dict) -> str:
        prompt = f"""你是一位美甲行业的运营专家。请根据以下数据生成一份简洁的每日运营报告：

{metrics}

请包含：1.关键指标总结 2.热门款式TOP3 3.趋势变化分析 4.运营建议。用中文回答。"""
        return await self.chat([{"role": "user", "content": prompt}], temperature=0.5)

    async def analyze_trends(self, trend_data: list[dict]) -> str:
        prompt = f"""你是一位美甲趋势分析师。以下是近7天款式数据趋势：

{trend_data}

请分析：1.哪些风格/颜色正在上升？2.哪些趋势在下降？3.预测下周可能流行的方向 4.款式采购建议。用中文回答。"""
        return await self.chat([{"role": "user", "content": prompt}], temperature=0.6)

    async def generate_strategy(self, context: dict) -> str:
        prompt = f"""作为美甲平台运营专家，根据以下数据给出运营策略：

{context}

请给出：1.本周主推款式建议 2.活动策划方向 3.用户增长策略 4.资源分配建议。要求具体可执行。"""
        return await self.chat([{"role": "user", "content": prompt}], temperature=0.7)

    def _mock_reply(self, query: str) -> str:
        mock_replies = {
            "日报": "今日平台试戴量较昨日增长12%，「星空渐变」继续领跑热度榜，「法式简约」上升最快(+35%)。建议在首页Banner位推广这两款。",
            "趋势": "最近7天，莫兰迪色系(裸色、豆沙、雾霾蓝)明显上升，闪粉类下降。推测受春夏换季影响，清新自然的风格更受欢迎。建议增加莫兰迪系款式库存。",
            "策略": "本周策略建议：1)主推「莫兰迪」系列专题；2)配合周三会员日满减活动；3)新增「肤色匹配」筛选功能提升转化；4)投放小红书种草笔记。",
            "最火": "当前热度TOP3：「星空渐变」(热度分92)、「法式简约」(热度分87)、「樱花粉」(热度分83)。其中「法式简约」是本周上升最快的款式。",
        }
        for keyword, reply in mock_replies.items():
            if keyword in query:
                return reply
        return "根据当前数据，「星空渐变」和「法式简约」是最受欢迎的款式，建议增加这两款的曝光和库存。需要更详细的分析请告知我具体关注的指标。"


longcat_service = LongCatAIService()
