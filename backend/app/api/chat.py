"""Chat API with SSE streaming, session management, and task scheduling"""
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core.database import get_db
from app.core.config import get_settings
from app.models.chat import ChatSession, ChatMessage, ScheduledTask
from app.services.skill_router import detect_skill, execute_skill, format_skill_context

router = APIRouter()
settings = get_settings()

# OpenClaw Gateway config (from .env)
OPENCLAW_BASE = settings.OPENCLAW_BASE_URL.rstrip("/")
OPENCLAW_TOKEN = settings.OPENCLAW_GATEWAY_TOKEN


class ChatRequest(BaseModel):
    session_key: Optional[str] = Field(default=None, description="前端会话标识，为空则创建新会话")
    message: str = Field(..., min_length=1, max_length=4000)
    image_url: Optional[str] = Field(default=None, description="可选的图片 URL（用于多模态评价）")


class ChatResponse(BaseModel):
    session_key: str
    reply: str
    tool_calls: list = []
    thinking: Optional[str] = None


class TaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    task_type: str = Field(..., pattern="^(daily_report|trend_analysis|hot_ranking)$")
    cron_expr: str = Field(..., min_length=1, max_length=64)


class TaskResponse(BaseModel):
    id: int
    name: str
    task_type: str
    cron_expr: str
    is_active: bool
    last_run_at: Optional[datetime] = None
    created_at: datetime


# ──────────────────────── Helpers ────────────────────────

def _map_agent(agent_type: str) -> tuple[str, str]:
    """Map frontend agent_type to OpenClaw model ID"""
    if agent_type == "user":
        return "nailvista-xiaomei", "openclaw/nailvista-xiaomei"
    return "nailvista-ops", "openclaw/nailvista-ops"


async def _get_or_create_session(
    db: AsyncSession, session_key: Optional[str], agent_type: str
) -> ChatSession:
    if session_key:
        result = await db.execute(
            select(ChatSession).where(ChatSession.session_key == session_key)
        )
        session = result.scalar_one_or_none()
        if session:
            session.updated_at = datetime.utcnow()
            await db.commit()
            return session

    new_key = uuid.uuid4().hex[:16]
    session = ChatSession(
        session_key=new_key,
        agent_type=agent_type,
        title="新对话",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _get_history(db: AsyncSession, session_id: int) -> list[dict]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    history = []
    for m in messages:
        history.append({"role": m.role, "content": m.content})
    return history


async def _save_message(
    db: AsyncSession,
    session_id: int,
    role: str,
    content: str,
    tool_calls: list = None,
    thinking: str = None,
) -> ChatMessage:
    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        tool_calls=tool_calls,
        thinking=thinking,
    )
    db.add(msg)
    await db.commit()
    return msg


# ──────────────────────── SSE Streaming ────────────────────────

async def _stream_chat(
    agent_type: str,
    session_key: str,
    message: str,
    image_url: Optional[str],
    db: AsyncSession,
):
    """Core SSE streaming logic — proxies OpenClaw and formats events"""
    agent_id, model_name = _map_agent(agent_type)

    # Save user message
    session = await _get_or_create_session(db, session_key, agent_type)
    await _save_message(db, session.id, "user", message)

    # ── Skill detection & execution ──
    skill = await detect_skill(message, agent_type)
    skill_context = ""
    if skill:
        skill_desc = skill["description"]
        skill_name_val = skill["name"]
        yield f"data: {json.dumps({'type': 'skill_start', 'name': skill_name_val, 'description': f'🔍 正在使用 {skill_desc}...'}, ensure_ascii=False)}\n\n"
        skill_result = await execute_skill(skill, message, db)
        if skill_result.get("success"):
            skill_context = format_skill_context(skill_result, skill_name_val)
            yield f"data: {json.dumps({'type': 'skill_end', 'name': skill_name_val, 'result': '✅ 数据查询完成'}, ensure_ascii=False)}\n\n"
        else:
            err_msg = skill_result.get("error", "未知错误")
            yield f"data: {json.dumps({'type': 'skill_end', 'name': skill_name_val, 'result': f'⚠️ {err_msg}'}, ensure_ascii=False)}\n\n"

    # Build messages array with history
    history = await _get_history(db, session.id)
    if len(history) > 20:
        history = history[-20:]

    # Construct request to OpenClaw
    openclaw_messages = history.copy()

    # Inject skill context as system message
    if skill_context:
        openclaw_messages.insert(0, {"role": "system", "content": skill_context})

    if image_url:
        openclaw_messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": message},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        })
    else:
        openclaw_messages.append({"role": "user", "content": message})

    headers = {"Content-Type": "application/json"}
    if OPENCLAW_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_TOKEN}"
    headers["x-openclaw-agent"] = agent_id

    payload = {
        "model": model_name,
        "messages": openclaw_messages,
        "stream": True,
    }

    # Yield session_key first so frontend can bind
    yield f"data: {json.dumps({'type': 'session', 'session_key': session.session_key}, ensure_ascii=False)}\n\n"

    full_reply = ""
    tool_calls = []
    thinking = ""
    current_tool = None
    is_thinking = False

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{OPENCLAW_BASE}/v1/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: {json.dumps({'type': 'error', 'message': f'OpenClaw error: {response.status_code}'}, ensure_ascii=False)}\n\n"
                    return

                buffer = ""
                async for chunk in response.aiter_bytes():
                    buffer += chunk.decode("utf-8", errors="replace")
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue

                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break

                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        choices = data.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})

                        # Text content
                        content = delta.get("content", "")
                        if content:
                            full_reply += content
                            yield f"data: {json.dumps({'type': 'text', 'content': content}, ensure_ascii=False)}\n\n"

                        # Tool calls (if OpenClaw uses native tool calling)
                        tc_delta = delta.get("tool_calls")
                        if tc_delta:
                            for tc in tc_delta:
                                tc_id = tc.get("id", "")
                                func = tc.get("function", {})
                                name = func.get("name", "")
                                args = func.get("arguments", "")

                                if tc_id and not current_tool:
                                    current_tool = {"id": tc_id, "name": name, "input": args, "output": ""}
                                    yield f"data: {json.dumps({'type': 'tool_start', 'id': tc_id, 'name': name, 'description': f'正在调用 {name} ...'}, ensure_ascii=False)}\n\n"
                                elif current_tool and args:
                                    current_tool["input"] += args

    except httpx.ConnectError:
        yield f"data: {json.dumps({'type': 'error', 'message': '无法连接到 AI 服务，请确认 OpenClaw Gateway 已启动'}, ensure_ascii=False)}\n\n"
        return
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'AI 服务异常: {str(e)}'}, ensure_ascii=False)}\n\n"
        return

    # Close current tool if any
    if current_tool:
        tool_calls.append(current_tool)
        yield f"data: {json.dumps({'type': 'tool_end', 'id': current_tool['id'], 'result': current_tool.get('output', '') or '完成'}, ensure_ascii=False)}\n\n"

    # Save assistant message
    if full_reply:
        await _save_message(db, session.id, "assistant", full_reply, tool_calls, thinking)

    # Done
    yield f"data: {json.dumps({'type': 'done', 'session_key': session.session_key}, ensure_ascii=False)}\n\n"


# ──────────────────────── Endpoints ────────────────────────

@router.post("/user")
async def chat_user(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """用户侧聊天（非流式，返回完整回复）"""
    session = await _get_or_create_session(db, req.session_key, "user")
    await _save_message(db, session.id, "user", req.message)

    agent_id, model_name = _map_agent("user")
    history = await _get_history(db, session.id)
    if len(history) > 20:
        history = history[-20:]

    messages = history.copy()

    # Skill detection
    skill = await detect_skill(req.message, "user")
    if skill:
        skill_result = await execute_skill(skill, req.message, db)
        if skill_result.get("success"):
            skill_context = format_skill_context(skill_result, skill["name"])
            messages.insert(0, {"role": "system", "content": skill_context})

    if req.image_url:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": req.message},
                {"type": "image_url", "image_url": {"url": req.image_url}},
            ],
        })
    else:
        messages.append({"role": "user", "content": req.message})

    headers = {"Content-Type": "application/json"}
    if OPENCLAW_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_TOKEN}"
    headers["x-openclaw-agent"] = agent_id

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{OPENCLAW_BASE}/v1/chat/completions",
                json={"model": model_name, "messages": messages, "stream": False},
                headers=headers,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"OpenClaw error: {resp.status_code}")

            data = resp.json()
            reply = data["choices"][0]["message"]["content"]

            await _save_message(db, session.id, "assistant", reply)
            return ChatResponse(session_key=session.session_key, reply=reply)

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="AI 服务不可用，请确认 OpenClaw Gateway 已启动")


@router.post("/user/stream")
async def chat_user_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """用户侧聊天（SSE 流式）"""
    return StreamingResponse(
        _stream_chat("user", req.session_key, req.message, req.image_url, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/dashboard")
async def chat_dashboard(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """运营侧聊天（非流式）"""
    session = await _get_or_create_session(db, req.session_key, "dashboard")
    await _save_message(db, session.id, "user", req.message)

    agent_id, model_name = _map_agent("dashboard")
    history = await _get_history(db, session.id)
    if len(history) > 20:
        history = history[-20:]

    messages = history.copy()

    # Skill detection
    skill = await detect_skill(req.message, "dashboard")
    if skill:
        skill_result = await execute_skill(skill, req.message, db)
        if skill_result.get("success"):
            skill_context = format_skill_context(skill_result, skill["name"])
            messages.insert(0, {"role": "system", "content": skill_context})

    messages.append({"role": "user", "content": req.message})

    headers = {"Content-Type": "application/json"}
    if OPENCLAW_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_TOKEN}"
    headers["x-openclaw-agent"] = agent_id

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{OPENCLAW_BASE}/v1/chat/completions",
                json={"model": model_name, "messages": messages, "stream": False},
                headers=headers,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"OpenClaw error: {resp.status_code}")

            data = resp.json()
            reply = data["choices"][0]["message"]["content"]

            await _save_message(db, session.id, "assistant", reply)
            return ChatResponse(session_key=session.session_key, reply=reply)

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="AI 服务不可用，请确认 OpenClaw Gateway 已启动")


@router.post("/dashboard/stream")
async def chat_dashboard_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """运营侧聊天（SSE 流式）"""
    return StreamingResponse(
        _stream_chat("dashboard", req.session_key, req.message, req.image_url, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ──────────────────────── Session Management ────────────────────────

@router.get("/sessions")
async def list_sessions(agent_type: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """获取会话列表"""
    query = select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(50)
    if agent_type:
        query = query.where(ChatSession.agent_type == agent_type)
    result = await db.execute(query)
    sessions = result.scalars().all()
    return {
        "sessions": [
            {
                "id": s.id,
                "session_key": s.session_key,
                "agent_type": s.agent_type,
                "title": s.title,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
            }
            for s in sessions
        ]
    }


@router.get("/sessions/{session_key}")
async def get_session_messages(session_key: str, db: AsyncSession = Depends(get_db)):
    """获取指定会话的消息历史"""
    result = await db.execute(
        select(ChatSession).where(ChatSession.session_key == session_key)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    messages = await _get_history(db, session.id)
    return {"session_key": session_key, "messages": messages}


# ──────────────────────── Task Management ────────────────────────

@router.get("/tasks")
async def list_tasks(db: AsyncSession = Depends(get_db)):
    """获取定时任务列表"""
    result = await db.execute(
        select(ScheduledTask).order_by(ScheduledTask.created_at.desc())
    )
    tasks = result.scalars().all()
    return {
        "tasks": [
            TaskResponse(
                id=t.id,
                name=t.name,
                task_type=t.task_type,
                cron_expr=t.cron_expr,
                is_active=t.is_active,
                last_run_at=t.last_run_at,
                created_at=t.created_at,
            ).model_dump()
            for t in tasks
        ]
    }


@router.post("/tasks")
async def create_task(task: TaskCreate, db: AsyncSession = Depends(get_db)):
    """创建定时任务"""
    new_task = ScheduledTask(
        name=task.name,
        task_type=task.task_type,
        cron_expr=task.cron_expr,
        agent_type="dashboard",
    )
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)

    return TaskResponse(
        id=new_task.id,
        name=new_task.name,
        task_type=new_task.task_type,
        cron_expr=new_task.cron_expr,
        is_active=new_task.is_active,
        last_run_at=new_task.last_run_at,
        created_at=new_task.created_at,
    ).model_dump()


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    """删除定时任务"""
    result = await db.execute(
        select(ScheduledTask).where(ScheduledTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    await db.delete(task)
    await db.commit()
    return {"message": "已删除"}
