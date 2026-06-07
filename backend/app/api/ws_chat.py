"""
前端 WebSocket 流式中继 — 全流式模式：OpenClaw SSE + WS 前端推送

前端协议:
  ws://host:8190/ws/chat/user?token=xxx
  发送: {"type":"user_message","text":"..."}
  接收: text / tool_call / tool_output / thinking / status / done / session / error

架构:
  前端 WS ↔ 后端 Relay(FastAPI) ↔ OpenClaw Gateway SSE(/v1/chat/completions stream=true)
  - 所有模型调用都使用 SSE 流式，实现真正的实时推送
  - 检测到 tool_calls 时，在流中累积完整的 tool_calls 后执行工具
  - 无 tool_calls 时，每个 token 到达即推送前端
"""
import json
import logging
import uuid as _uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import httpx

from app.core.database import async_session_factory
from app.core.config import settings
from app.models.models import User, ChatSession, ChatMessage
from app.api.chat import (
    _get_system_prompt, _get_or_create_session, _get_history,
    _execute_tool, CHAT_TOOLS, OPERATIONS_TOOLS, MAX_REACT_ROUNDS,
)

router = APIRouter()
logger = logging.getLogger("nailvista.relay")


# ═══════════════════════════════════════════════════
# 鉴权
# ═══════════════════════════════════════════════════

async def _authenticate(token: str) -> Optional[User]:
    from app.core.security import decode_access_token
    from sqlalchemy import select
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    async with async_session_factory() as db:
        r = await db.execute(select(User).where(User.id == int(user_id)))
        return r.scalar_one_or_none()


# ═══════════════════════════════════════════════════
# 模型调用 — 统一流式接口
# ═══════════════════════════════════════════════════

def _model_name(agent_type: str) -> str:
    return "openclaw/nailvista-xiaomei" if agent_type == "user" else "openclaw/nailvista-ops"


def _common_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}",
        "Content-Type": "application/json",
    }


async def _call_model_streaming(
    messages: list,
    tools: list,
    agent_type: str,
    websocket: WebSocket,
) -> dict:
    """
    统一流式模型调用：
    - 无 tool_calls → 每个 token 实时推送前端 → 返回 {"content": "...", "tool_calls": []}
    - 有 tool_calls → 累积完整 tool_calls，推送 tool_call/tool_output 事件 → 返回 {"content": "...", "tool_calls": [...]}
    - 异常 → 返回 {"error": "..."}

    对于有 tool_calls 的轮次，token 不推送前端（只推送 tool_call/tool_output）。
    对于最终回复轮次（无 tool_calls），每个 token 实时推送。
    """
    has_tool_calls = False
    full_content = ""
    accumulated_tool_calls = []  # [{id, type, function: {name, arguments}}]
    thinking_content = ""
    finish_reason = None

    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            payload = {
                "model": _model_name(agent_type),
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": 0.7,
                "max_tokens": 4096,
                "stream": True,
            }
            async with client.stream(
                "POST",
                f"{settings.OPENCLAW_BASE_URL}/v1/chat/completions",
                headers=_common_headers(),
                json=payload,
            ) as resp:
                if resp.status_code != 200:
                    error_body = await resp.aread()
                    logger.error(f"[RELAY] 流式请求失败 | status={resp.status_code} body={error_body[:300]}")
                    return {"error": "AI服务暂不可用"}

                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    choices = chunk.get("choices", [])
                    if not choices:
                        continue

                    choice = choices[0]
                    delta = choice.get("delta", {})
                    finish_reason = choice.get("finish_reason") or finish_reason

                    # 处理 reasoning_content（思考过程）
                    if delta.get("reasoning_content"):
                        thinking_content += delta["reasoning_content"]

                    # 处理 content（文本内容）
                    content_delta = delta.get("content")
                    if content_delta:
                        full_content += content_delta
                        # 只有在没有 tool_calls 时才实时推送文本
                        # （有 tool_calls 时不推送，等工具执行完再推送文本）
                        if not has_tool_calls and not delta.get("tool_calls"):
                            try:
                                await websocket.send_json({"type": "text", "content": content_delta})
                            except Exception:
                                pass

                    # 处理 tool_calls（流式累积）
                    if delta.get("tool_calls"):
                        has_tool_calls = True
                        for tc_delta in delta["tool_calls"]:
                            idx = tc_delta.get("index", 0)
                            # 扩展列表
                            while len(accumulated_tool_calls) <= idx:
                                accumulated_tool_calls.append({
                                    "id": "", "type": "function",
                                    "function": {"name": "", "arguments": ""}
                                })
                            entry = accumulated_tool_calls[idx]
                            if tc_delta.get("id"):
                                entry["id"] = tc_delta["id"]
                            if tc_delta.get("type"):
                                entry["type"] = tc_delta["type"]
                            fn_delta = tc_delta.get("function", {})
                            if fn_delta.get("name"):
                                entry["function"]["name"] += fn_delta["name"]
                            if fn_delta.get("arguments"):
                                entry["function"]["arguments"] += fn_delta["arguments"]

    except httpx.ConnectError as e:
        logger.error(f"[RELAY] 流式连接失败 | {e}")
        return {"error": "AI服务连接失败，请检查OpenClaw Gateway是否运行"}
    except Exception as e:
        logger.error(f"[RELAY] 流式异常 | {type(e).__name__}: {e}")
        if not full_content and not accumulated_tool_calls:
            return {"error": f"AI服务异常: {str(e)}"}

    result = {
        "content": full_content,
        "tool_calls": accumulated_tool_calls if has_tool_calls else [],
        "finish_reason": finish_reason,
    }
    if thinking_content:
        result["reasoning_content"] = thinking_content
    return result


# ═══════════════════════════════════════════════════
# WebSocket 端点
# ═══════════════════════════════════════════════════

@router.websocket("/ws/chat/user")
async def ws_chat_user(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user = await _authenticate(token)
    if not user:
        await websocket.send_json({"type": "error", "message": "鉴权失败"})
        await websocket.close()
        return
    logger.info(f"[RELAY] 用户连接 | user={user.id}")
    await _relay_session(websocket, user, "user")


@router.websocket("/ws/chat/ops")
async def ws_chat_ops(websocket: WebSocket, token: str = Query(...)):
    await websocket.accept()
    user = await _authenticate(token)
    if not user:
        await websocket.send_json({"type": "error", "message": "鉴权失败"})
        await websocket.close()
        return
    if user.role != "merchant":
        await websocket.send_json({"type": "error", "message": "仅商家可访问"})
        await websocket.close()
        return
    logger.info(f"[RELAY] 商家连接 | user={user.id}")
    await _relay_session(websocket, user, "ops")


async def _relay_session(websocket: WebSocket, user: User, agent_type: str):
    """
    核心中继循环：接收前端消息 → React 循环(SSE 全流式) → 实时推送前端
    支持会话复用：前端发送 session_key 时复用已有会话，否则创建新会话
    """
    tools = CHAT_TOOLS if agent_type == "user" else OPERATIONS_TOOLS
    system_prompt = _get_system_prompt(agent_type)

    # 当前活跃会话（在 WS 生命周期内持续复用）
    current_session_key: Optional[str] = None

    try:
        while True:
            raw = await websocket.receive_text()
            req = json.loads(raw)

            if req.get("type") != "user_message":
                continue

            text = req.get("text", "").strip()
            if not text:
                continue

            # 前端可能发送 session_key 来指定已有会话
            client_session_key = req.get("session_key")
            if client_session_key:
                current_session_key = client_session_key
            else:
                # 无 session_key → 创建新会话，不复用上一轮遗留的 current_session_key
                current_session_key = None

            logger.info(f"[RELAY] 用户消息 | user={user.id} session={current_session_key} text={text[:50]}")

            # --- 获取或创建会话 ---
            session_db_id = None
            history_messages = []  # 用于 AI 上下文

            try:
                async with async_session_factory() as db:
                    from sqlalchemy import select as sa_select

                    session = None
                    # 尝试复用已有会话
                    if current_session_key:
                        r = await db.execute(
                            sa_select(ChatSession).where(
                                ChatSession.session_key == current_session_key,
                                ChatSession.user_id == user.id,
                                ChatSession.is_active == True,
                            )
                        )
                        session = r.scalar_one_or_none()

                    if session:
                        # 复用已有会话
                        session_db_id = session.id
                        current_session_key = session.session_key
                        logger.info(f"[RELAY] 复用会话 | key={current_session_key} id={session_db_id}")
                    else:
                        # 创建新会话
                        current_session_key = _uuid.uuid4().hex[:16]
                        session = ChatSession(
                            user_id=user.id,
                            session_key=current_session_key,
                            agent_type=agent_type,
                            title=text[:30],
                        )
                        db.add(session)
                        await db.flush()
                        session_db_id = session.id
                        logger.info(f"[RELAY] 创建新会话 | key={current_session_key}")

                    # 保存用户消息
                    db.add(ChatMessage(session_id=session_db_id, role="user", content=text))

                    # 更新会话标题（如果仍是默认标题）
                    if not session.title or session.title == "新对话":
                        session.title = text[:30]

                    await db.commit()

                    # 加载历史消息用于 AI 上下文
                    history_r = await db.execute(
                        sa_select(ChatMessage)
                        .where(ChatMessage.session_id == session_db_id)
                        .order_by(ChatMessage.created_at)
                        .limit(20)
                    )
                    history_msgs = history_r.scalars().all()
                    history_messages = [{"role": m.role, "content": m.content} for m in history_msgs]

            except Exception as e:
                logger.error(f"[RELAY] 会话处理失败 | {e}")
                await websocket.send_json({"type": "error", "message": "会话处理失败"})
                continue

            await websocket.send_json({"type": "session", "session_key": current_session_key})

            # --- React 循环（使用历史消息作为上下文） ---
            current_messages = [
                {"role": "system", "content": system_prompt},
                *history_messages,
            ]

            full_content = ""
            tool_trace = []
            thinking_steps = []

            for round_num in range(1, MAX_REACT_ROUNDS + 1):
                logger.info(f"[RELAY] React round={round_num} agent={agent_type}")

                resp_data = await _call_model_streaming(current_messages, tools, agent_type, websocket)

                if "error" in resp_data:
                    full_content = resp_data["error"]
                    await websocket.send_json({"type": "text", "content": full_content})
                    break

                content = resp_data.get("content", "")
                tool_calls = resp_data.get("tool_calls", [])

                # 记录思考过程
                if resp_data.get("reasoning_content"):
                    thinking_step = {
                        "type": "thinking",
                        "content": resp_data["reasoning_content"],
                        "round": round_num,
                    }
                    thinking_steps.append(thinking_step)
                    await websocket.send_json({
                        "type": "thinking",
                        "content": resp_data["reasoning_content"],
                        "round": round_num,
                    })

                if tool_calls:
                    # 有工具调用 — 追加助手消息到上下文
                    assistant_entry = {
                        "role": "assistant",
                        "content": content or "",
                        "tool_calls": tool_calls,
                    }
                    if resp_data.get("reasoning_content"):
                        assistant_entry["reasoning_content"] = resp_data["reasoning_content"]
                    current_messages.append(assistant_entry)

                    for tc in tool_calls:
                        fn = tc.get("function", {})
                        fn_name = fn.get("name", "unknown")
                        try:
                            fn_args = json.loads(fn.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            fn_args = {}

                        logger.info(f"[RELAY] 工具调用 | round={round_num} fn={fn_name} args={json.dumps(fn_args, ensure_ascii=False)}")

                        # 推送 tool_call 事件
                        await websocket.send_json({
                            "type": "tool_call",
                            "call_id": tc.get("id", f"call_{round_num}"),
                            "name": fn_name,
                            "arguments": fn_args,
                            "round": round_num,
                        })

                        # 执行工具
                        try:
                            async with async_session_factory() as tool_db:
                                tool_result = await _execute_tool(fn_name, fn_args, tool_db, agent_type)
                        except Exception as e:
                            logger.error(f"[RELAY] 工具执行失败 | fn={fn_name} | {e}")
                            tool_result = {"success": False, "error": str(e)}

                        logger.info(f"[RELAY] 工具完成 | fn={fn_name} success={tool_result.get('success')}")

                        # 推送 tool_output 事件
                        await websocket.send_json({
                            "type": "tool_output",
                            "call_id": tc.get("id", f"call_{round_num}"),
                            "name": fn_name,
                            "output": json.dumps(tool_result, ensure_ascii=False),
                            "error": not tool_result.get("success", True),
                            "round": round_num,
                        })

                        tool_trace.append({
                            "type": "tool_call", "name": fn_name,
                            "arguments": fn_args, "round": round_num,
                        })
                        tool_trace.append({
                            "type": "tool_result", "name": fn_name,
                            "result": tool_result, "round": round_num,
                        })

                        # 追加到对话上下文
                        current_messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", f"call_{round_num}"),
                            "content": json.dumps(tool_result, ensure_ascii=False),
                        })

                    continue  # 继续下一轮

                # 无工具调用 — 文本已在流中实时推送，直接结束
                full_content = content
                break

            if not full_content:
                full_content = "AI服务暂不可用，请稍后重试"
                await websocket.send_json({"type": "text", "content": full_content})

            # 落库
            if session_db_id:
                try:
                    async with async_session_factory() as save_db:
                        save_msg = ChatMessage(
                            session_id=session_db_id,
                            role="assistant",
                            content=full_content,
                            thinking=json.dumps(thinking_steps, ensure_ascii=False),
                            tool_calls=json.dumps(tool_trace, ensure_ascii=False),
                        )
                        save_db.add(save_msg)
                        await save_db.commit()
                except Exception as e:
                    logger.error(f"[RELAY] 保存消息失败 | {e}")

            logger.info(f"[RELAY] 完成 | user={user.id} len={len(full_content)} tools={len(tool_trace)//2}")
            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        logger.info(f"[RELAY] 前端断开 | user={user.id}")
    except Exception as e:
        logger.error(f"[RELAY] 异常 | {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
