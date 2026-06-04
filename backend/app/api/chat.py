"""
小美对话 API — React范式工具调用（思考→工具调用→结果→再思考→最终回答）
"""
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import httpx

from app.core.database import get_db, async_session_factory
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, ChatSession, ChatMessage
from app.schemas.schemas import ChatRequest, ChatSessionOut, ChatMessageOut
from app.api.auth import get_current_user
from app.services.skill_router import SKILLS, execute_skill_dynamic

router = APIRouter()
logger = get_logger("chat")

MAX_REACT_ROUNDS = 5  # 最大工具调用轮数


# ── 工具定义（OpenAI function-calling 格式） ──

CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_nail_styles",
            "description": "搜索美甲款式，按分类、颜色、关键词筛选。用户说'找红色猫眼'、'搜索渐变'时调用",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {"type": "string", "description": "搜索关键词，如'猫眼'、'法式'、'红色'"},
                    "category": {"type": "string", "description": "分类，如'猫眼'、'渐变'、'纯色'、'法式'"},
                    "sort": {"type": "string", "enum": ["popular", "newest", "name"], "description": "排序方式"},
                    "limit": {"type": "integer", "description": "返回数量，默认8"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_nail_styles",
            "description": "根据用户偏好（场合、肤色、风格）智能推荐美甲款式。用户说'推荐适合约会的美甲'、'我皮肤偏黄适合什么颜色'时调用",
            "parameters": {
                "type": "object",
                "properties": {
                    "occasion": {"type": "string", "description": "场合：约会/通勤/派对/日常/婚礼"},
                    "skin_tone": {"type": "string", "description": "肤色：白皙/偏黄/偏黑"},
                    "style": {"type": "string", "description": "风格偏好：温柔甜美/简约高级/闪亮抢眼/个性"},
                    "limit": {"type": "integer", "description": "返回数量，默认6"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_nail_categories",
            "description": "获取美甲款式分类列表。用户问'有哪些种类'、'分类'时调用",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "evaluate_tryon_image",
            "description": "评价美甲试戴效果图（多模态）。当用户发送试戴图片要求评价时调用",
            "parameters": {
                "type": "object",
                "properties": {
                    "image_url": {"type": "string", "description": "试戴效果图片的URL"},
                    "aspects": {"type": "array", "items": {"type": "string"}, "description": "评价维度：color/style/beauty/detail"}
                },
                "required": ["image_url"]
            }
        }
    },
]

OPERATIONS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_ops_overview",
            "description": "获取今日运营概览数据（试戴量、营收、订单、评分、流量等）",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_revenue_data",
            "description": "获取营收趋势数据。可按天数过滤",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7，可选7/14/30"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_hot_styles",
            "description": "获取热门款式排行TOP榜",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "返回数量，默认10"},
                    "days": {"type": "integer", "description": "统计天数，默认7"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_trend_data",
            "description": "获取趋势数据（试戴量、浏览量、收藏量、订单量变化）",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7，可选7/14/30"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_refund_analysis",
            "description": "获取退款分析数据（退款率、退款原因分布）",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_review_analysis",
            "description": "获取评价分析数据（评分分布、热门标签）",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_traffic_analysis",
            "description": "获取流量分析数据（曝光、点击、转化漏斗）",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_analysis",
            "description": "获取顾客分析数据（新老客占比）",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "description": "查询天数，默认7"}
                },
                "required": []
            }
        }
    },
]


@router.post("/chat/user")
async def chat_user(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用户端AI对话 — React范式"""
    logger.info(f"[chat] 用户对话 | user={user.id} session={body.session_key} msg={body.message[:50]}")

    session = await _get_or_create_session(db, user.id, body.session_key)
    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    if not session.title or session.title == "新对话":
        session.title = body.message[:30]
        logger.info(f"[chat] 自动标题 | title={session.title}")

    history = await _get_history(db, session.id, 20)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    # React循环：多轮工具调用
    result = await _react_loop(messages, "user", db)

    # 保存助手消息
    assistant_msg = ChatMessage(
        session_id=session.id, role="assistant",
        content=result["content"],
        thinking=json.dumps(result.get("thinking_steps", []), ensure_ascii=False),
        tool_calls=json.dumps(result.get("tool_call_trace", []), ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.flush()

    logger.info(f"[chat] 对话完成 | session={session.session_key} rounds={result.get('rounds',0)} reply_len={len(result['content'])}")

    return {
        "session_key": session.session_key,
        "message": {
            "role": "assistant",
            "content": assistant_msg.content,
            "thinking": assistant_msg.thinking,
            "tool_calls": result.get("tool_call_trace", []),
        },
    }


@router.post("/chat/ops")
async def chat_ops(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """运营端AI对话 — React范式"""
    logger.info(f"[chat-ops] 运营对话 | user={user.id} msg={body.message[:50]}")

    if user.role != "merchant":
        raise HTTPException(status_code=403, detail="仅商家可访问运营助手")

    session = await _get_or_create_session(db, user.id, body.session_key, agent_type="ops")
    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    if not session.title or session.title == "新对话":
        session.title = body.message[:30]

    history = await _get_history(db, session.id, 20)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    result = await _react_loop(messages, "ops", db)

    assistant_msg = ChatMessage(
        session_id=session.id, role="assistant",
        content=result["content"],
        thinking=json.dumps(result.get("thinking_steps", []), ensure_ascii=False),
        tool_calls=json.dumps(result.get("tool_call_trace", []), ensure_ascii=False),
    )
    db.add(assistant_msg)
    await db.flush()

    return {
        "session_key": session.session_key,
        "message": {
            "role": "assistant",
            "content": assistant_msg.content,
            "thinking": assistant_msg.thinking,
            "tool_calls": result.get("tool_call_trace", []),
        },
    }


@router.post("/chat/user/stream")
async def chat_user_stream(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """用户端AI对话 — SSE流式"""
    logger.info(f"[chat-stream] 流式对话 | user={user.id} session={body.session_key}")

    session = await _get_or_create_session(db, user.id, body.session_key)
    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    if not session.title or session.title == "新对话":
        session.title = body.message[:30]

    history = await _get_history(db, session.id, 20)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    tools = CHAT_TOOLS

    async def event_stream():
        full_content = ""
        thinking_steps = []
        tool_trace = []

        try:
            yield f"data: {json.dumps({'type': 'session', 'session_key': session.session_key})}\n\n"

            # React循环（流式版本）
            current_messages = [
                {"role": "system", "content": _get_system_prompt("user")},
                *messages,
            ]

            for round_num in range(1, MAX_REACT_ROUNDS + 1):
                # 发请求（非流式获取完整响应，因为需要tool_calls）
                resp_data = await _call_model(current_messages, tools)

                if "error" in resp_data:
                    full_content = resp_data["error"]
                    yield f"data: {json.dumps({'type': 'text', 'content': full_content})}\n\n"
                    break

                choice = resp_data.get("choices", [{}])[0]
                msg = choice.get("message", {})
                content = msg.get("content", "")
                tool_calls = msg.get("tool_calls", [])

                # 检查thinking/reasoning
                if msg.get("reasoning_content"):
                    step = {"type": "thinking", "content": msg["reasoning_content"], "round": round_num}
                    thinking_steps.append(step)
                    yield f"data: {json.dumps({'type': 'thinking', 'content': msg['reasoning_content'], 'round': round_num})}\n\n"

                if tool_calls:
                    # 有工具调用
                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        fn_name = fn.get("name", "unknown")
                        fn_args = json.loads(fn.get("arguments", "{}"))
                        logger.info(f"[chat-react] tool_call round={round_num} fn={fn_name} args={json.dumps(fn_args, ensure_ascii=False)}")

                        # 通知前端工具调用
                        call_event = {"type": "tool_call", "name": fn_name, "arguments": fn_args, "round": round_num}
                        tool_trace.append(call_event)
                        yield f"data: {json.dumps(call_event)}\n\n"

                        # 执行工具
                        tool_result = await _execute_tool(fn_name, fn_args, db, "user")
                        result_event = {"type": "tool_result", "name": fn_name, "result": tool_result, "round": round_num}
                        tool_trace.append(result_event)
                        yield f"data: {json.dumps(result_event)}\n\n"

                        # 添加助手消息和工具结果到对话
                        current_messages.append({
                            "role": "assistant",
                            "content": content or "",
                            "tool_calls": [tc],
                        })
                        current_messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", f"call_{round_num}"),
                            "content": json.dumps(tool_result, ensure_ascii=False),
                        })

                    continue  # 继续下一轮

                # 没有工具调用，流式输出最终内容
                if content:
                    # 逐字流式输出
                    for i, ch in enumerate(content):
                        full_content += ch
                        yield f"data: {json.dumps({'type': 'text', 'content': ch})}\n\n"
                break

            # 保存到DB
            if full_content:
                async with async_session_factory() as save_db:
                    save_msg = ChatMessage(
                        session_id=session.id, role="assistant",
                        content=full_content,
                        thinking=json.dumps(thinking_steps, ensure_ascii=False),
                        tool_calls=json.dumps(tool_trace, ensure_ascii=False),
                    )
                    save_db.add(save_msg)
                    await save_db.commit()

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"[chat-stream] SSE异常 | {e}")
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/chat/sessions")
async def list_sessions(
    agent_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[chat] 会话列表 | user={user.id} agent={agent_type}")
    stmt = select(ChatSession).where(
        ChatSession.user_id == user.id,
        ChatSession.is_active == True,
    )
    if agent_type:
        stmt = stmt.where(ChatSession.agent_type == agent_type)
    stmt = stmt.order_by(desc(ChatSession.updated_at)).limit(50)
    r = await db.execute(stmt)
    sessions = r.scalars().all()

    items = []
    for s in sessions:
        cnt_r = await db.execute(select(ChatMessage).where(ChatMessage.session_id == s.id))
        msg_count = len(cnt_r.scalars().all())
        items.append(ChatSessionOut(
            session_key=s.session_key, title=s.title, agent_type=s.agent_type,
            message_count=msg_count, created_at=s.created_at, updated_at=s.updated_at,
        ))
    return items


@router.get("/chat/sessions/{session_key}")
async def get_session_messages(
    session_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[chat] 会话消息 | key={session_key}")
    r = await db.execute(select(ChatSession).where(ChatSession.session_key == session_key))
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    msgs_r = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
    )
    messages = msgs_r.scalars().all()
    return {
        "session": {"session_key": session.session_key, "title": session.title},
        "messages": [ChatMessageOut.model_validate(m) for m in messages],
    }


@router.delete("/chat/sessions/{session_key}")
async def delete_session(
    session_key: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"[chat] 删除会话 | key={session_key}")
    r = await db.execute(select(ChatSession).where(ChatSession.session_key == session_key))
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    session.is_active = False
    return {"ok": True}


# ═══════════════════════════════════════════════════
# React Loop 核心
# ═══════════════════════════════════════════════════

async def _react_loop(messages: list, agent_type: str, db: AsyncSession) -> dict:
    """
    React范式循环：发送消息→检查tool_calls→执行→送回结果→重复
    返回 {"content": "...", "thinking_steps": [...], "tool_call_trace": [...], "rounds": N}
    """
    tools = CHAT_TOOLS if agent_type == "user" else OPERATIONS_TOOLS
    system_prompt = _get_system_prompt(agent_type)

    current_messages = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]

    thinking_steps = []
    tool_trace = []
    final_content = ""

    for round_num in range(1, MAX_REACT_ROUNDS + 1):
        logger.info(f"[chat-react] round={round_num} agent={agent_type}")

        resp_data = await _call_model(current_messages, tools)

        if "error" in resp_data:
            final_content = resp_data["error"]
            break

        choice = resp_data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        content = msg.get("content", "")
        tool_calls = msg.get("tool_calls", [])

        # 记录thinking
        if msg.get("reasoning_content"):
            thinking_steps.append({
                "type": "thinking", "content": msg["reasoning_content"], "round": round_num,
            })

        if tool_calls:
            # 有工具调用
            assistant_msg_entry = {
                "role": "assistant",
                "content": content or "",
                "tool_calls": tool_calls,
            }
            current_messages.append(assistant_msg_entry)

            for tc in tool_calls:
                fn = tc.get("function", {})
                fn_name = fn.get("name", "unknown")
                fn_args = json.loads(fn.get("arguments", "{}"))

                logger.info(f"[chat-react] tool_call round={round_num} fn={fn_name} args={json.dumps(fn_args, ensure_ascii=False)}")

                call_entry = {"type": "tool_call", "name": fn_name, "arguments": fn_args, "round": round_num}
                tool_trace.append(call_entry)

                tool_result = await _execute_tool(fn_name, fn_args, db, agent_type)

                result_entry = {"type": "tool_result", "name": fn_name, "result": tool_result, "round": round_num}
                tool_trace.append(result_entry)

                current_messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", f"call_{round_num}"),
                    "content": json.dumps(tool_result, ensure_ascii=False),
                })

            continue  # 继续下一轮

        # 没有工具调用，最终回复
        final_content = content or "抱歉，我暂时无法回答这个问题，请稍后再试。"
        break

    if not final_content:
        final_content = "AI服务暂不可用，请稍后重试"

    return {
        "content": final_content,
        "thinking_steps": thinking_steps,
        "tool_call_trace": tool_trace,
        "rounds": round_num,
    }


async def _call_model(messages: list, tools: list) -> dict:
    """调用OpenClaw Gateway模型（支持工具调用）"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "model": "xiaomi-coding/mimo-v2.5-pro",
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": 0.7,
                "max_tokens": 4096,
            }
            resp = await client.post(
                f"{settings.OPENCLAW_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"[chat-model] response | finish_reason={data['choices'][0].get('finish_reason','?')} "
                           f"has_tool_calls={bool(data['choices'][0].get('message',{}).get('tool_calls'))} "
                           f"content_len={len(data['choices'][0].get('message',{}).get('content','') or '')}")
                return data
            else:
                logger.error(f"[chat-model] 请求失败 | status={resp.status_code} body={resp.text[:300]}")
                return {"error": "AI服务暂不可用，请稍后重试"}
    except httpx.ConnectError as e:
        logger.error(f"[chat-model] 连接失败 | {e}")
        return {"error": "AI服务连接失败，请检查OpenClaw Gateway是否运行"}
    except Exception as e:
        logger.error(f"[chat-model] 异常 | {type(e).__name__}: {e}")
        return {"error": f"AI服务异常: {str(e)}"}


async def _execute_tool(fn_name: str, args: dict, db: AsyncSession, agent_type: str) -> dict:
    """执行工具调用 — 查询后端数据库"""
    try:
        logger.info(f"[chat-tool] 执行 | fn={fn_name} args={json.dumps(args, ensure_ascii=False)}")
        result = await execute_skill_dynamic(fn_name, args, db)
        logger.info(f"[chat-tool] 完成 | fn={fn_name} success={result.get('success')} "
                    f"data_keys={list(result.get('data',{}).keys()) if result.get('data') else 'none'}")
        return result
    except Exception as e:
        logger.error(f"[chat-tool] 执行失败 | fn={fn_name} | {type(e).__name__}: {e}")
        return {"success": False, "error": str(e)}


def _get_system_prompt(agent_type: str) -> str:
    if agent_type == "user":
        return """你是NailVista美甲平台的AI时尚顾问"小美"。性格温暖专业，回复简洁2-3句。

你可以使用工具函数查询美甲款式、分类、推荐等数据。当用户提出以下需求时，你必须调用对应的工具函数获取真实数据：
- 搜索款式 → 调用 search_nail_styles
- 推荐款式 → 调用 recommend_nail_styles
- 查看分类 → 调用 get_nail_categories
- 评价试戴图 → 调用 evaluate_tryon_image

重要规则：
1. 收到工具返回的数据后，基于真实数据进行分析和推荐
2. 用表格展示款式信息（名称、分类、价格、热度）
3. 推荐时说明理由
4. 引导用户去试戴页面体验
5. 全程中文回复"""
    else:
        return """你是NailVista美甲平台的AI运营分析师"运营助手"。专业、数据驱动、逻辑清晰。

你可以使用工具函数查询运营数据。当用户提出以下需求时，必须调用对应的工具函数：
- 运营概览 → 调用 get_ops_overview
- 营收分析 → 调用 get_revenue_data
- 热门款式 → 调用 get_hot_styles
- 趋势数据 → 调用 get_trend_data
- 退款分析 → 调用 get_refund_analysis
- 评价分析 → 调用 get_review_analysis
- 流量分析 → 调用 get_traffic_analysis
- 顾客分析 → 调用 get_customer_analysis

重要规则：
1. 收到数据后先确认完整性
2. 用表格展示核心数据
3. 分析对比变化趋势
4. 用```chart代码块生成图表
5. 给出2-3条运营建议（标注优先级：⚠️紧急/📌重要/💡建议）"""


# ═══════════════════════════════════════════════════
# 内部辅助函数
# ═══════════════════════════════════════════════════

async def _get_or_create_session(db: AsyncSession, user_id: int, session_key: Optional[str], agent_type: str = "user") -> ChatSession:
    if session_key:
        r = await db.execute(select(ChatSession).where(ChatSession.session_key == session_key))
        session = r.scalar_one_or_none()
        if session and session.user_id == user_id:
            return session
    session = ChatSession(user_id=user_id, session_key=uuid.uuid4().hex[:16], agent_type=agent_type)
    db.add(session)
    await db.flush()
    logger.info(f"[chat] 创建新会话 | key={session.session_key} agent={agent_type}")
    return session


async def _get_history(db: AsyncSession, session_id: int, limit: int = 20) -> list:
    r = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at).limit(limit)
    )
    msgs = r.scalars().all()
    return [{"role": m.role, "content": m.content} for m in msgs]
