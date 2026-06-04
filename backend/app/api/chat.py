"""
小美对话 API — 基于 OpenClaw Gateway
"""
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
import httpx

from app.core.database import get_db, async_session_factory
from app.core.config import settings
from app.core.logger import get_logger
from app.models.models import User, ChatSession, ChatMessage
from app.schemas.schemas import ChatRequest, ChatSessionOut, ChatMessageOut
from app.api.auth import get_current_user

router = APIRouter()
logger = get_logger("chat")


@router.post("/chat/user")
async def chat_user(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"用户对话 | user={user.id} session={body.session_key} msg={body.message[:30]}")

    session = await _get_or_create_session(db, user.id, body.session_key)

    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    if not session.title or session.title == "新对话":
        session.title = body.message[:30]
        logger.info(f"自动标题 | session={session.session_key} title={session.title}")

    history = await _get_history(db, session.id, 20)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    if body.image_url:
        messages[-1] = {
            "role": "user",
            "content": [
                {"type": "text", "text": body.message},
                {"type": "image_url", "image_url": {"url": body.image_url}},
            ],
        }

    reply, thinking = await _call_openclaw(messages)

    assistant_msg = ChatMessage(
        session_id=session.id, role="assistant",
        content=reply or "AI服务暂不可用，请稍后重试",
        thinking=thinking,
    )
    db.add(assistant_msg)
    await db.flush()
    logger.info(f"对话完成 | session={session.session_key} reply_len={len(reply or '')}")

    return {
        "session_key": session.session_key,
        "message": {"role": "assistant", "content": assistant_msg.content, "thinking": thinking},
    }


@router.post("/chat/user/stream")
async def chat_user_stream(
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"流式对话 | user={user.id} session={body.session_key}")

    session = await _get_or_create_session(db, user.id, body.session_key)
    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    await db.flush()

    if not session.title or session.title == "新对话":
        session.title = body.message[:30]

    history = await _get_history(db, session.id, 20)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]

    async def event_stream():
        try:
            yield f"data: {json.dumps({'type': 'session', 'session_key': session.session_key})}\n\n"

            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST", f"{settings.OPENCLAW_BASE_URL}/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "openclaw/nailvista-xiaomei",
                        "messages": messages,
                        "stream": True,
                    },
                ) as resp:
                    full_content = ""
                    if resp.status_code == 200:
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    chunk = json.loads(data_str)
                                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        full_content += content
                                        yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"
                                except (json.JSONDecodeError, KeyError, IndexError):
                                    continue
                    else:
                        logger.error(f"OpenClaw流式请求失败 | status={resp.status_code}")
                        full_content = "AI服务暂不可用，请稍后重试"
                        yield f"data: {json.dumps({'type': 'text', 'content': full_content})}\n\n"

            async with async_session_factory() as save_db:
                save_msg = ChatMessage(session_id=session.id, role="assistant", content=full_content)
                save_db.add(save_msg)
                await save_db.commit()

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"SSE流式异常 | {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/chat/sessions")
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"会话列表 | user={user.id}")
    r = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id, ChatSession.is_active == True)
        .order_by(desc(ChatSession.updated_at))
        .limit(50)
    )
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
    logger.info(f"会话消息 | key={session_key}")
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
    logger.info(f"删除会话 | key={session_key}")
    r = await db.execute(select(ChatSession).where(ChatSession.session_key == session_key))
    session = r.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    session.is_active = False
    return {"ok": True}


# ========== 内部函数 ==========

async def _get_or_create_session(db: AsyncSession, user_id: int, session_key: Optional[str]) -> ChatSession:
    if session_key:
        r = await db.execute(select(ChatSession).where(ChatSession.session_key == session_key))
        session = r.scalar_one_or_none()
        if session and session.user_id == user_id:
            return session
    session = ChatSession(user_id=user_id, session_key=uuid.uuid4().hex[:16])
    db.add(session)
    await db.flush()
    logger.info(f"创建新会话 | key={session.session_key}")
    return session


async def _get_history(db: AsyncSession, session_id: int, limit: int = 20) -> list:
    r = await db.execute(
        select(ChatMessage).where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at).limit(limit)
    )
    msgs = r.scalars().all()
    return [{"role": m.role, "content": m.content} for m in msgs]


async def _call_openclaw(messages: list) -> tuple[Optional[str], Optional[str]]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OPENCLAW_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={"model": "openclaw/nailvista-xiaomei", "messages": messages},
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return content, None
            else:
                logger.error(f"OpenClaw请求失败 | status={resp.status_code} body={resp.text[:200]}")
                return "AI服务暂不可用，请稍后重试", None
    except Exception as e:
        logger.error(f"OpenClaw调用异常 | {e}")
        return "AI服务暂不可用，请稍后重试", None
