"""
OpenClaw Gateway WebSocket 客户端 — 流式对话 + 全量工具调用事件采集

协议:
  1. WS 连接 → 发送 connect 鉴权帧
  2. 发送 chat.create 请求帧
  3. 接收异步推送事件帧
  4. chat.finish → 汇总全量数据返回

事件类型:
  chat.content_chunk  → 模型输出文字分片
  tool.pre_invoke     → 工具即将执行（call_id, tool_name, arguments）
  tool.stream_output  → 工具实时输出分片
  tool.post_finish    → 工具执行完毕（result, error）
  chat.finish         → 本轮对话结束
"""
import asyncio
import json
import logging
import uuid
from typing import Optional, Dict, Any, Callable

import httpx
import websockets
from websockets.exceptions import ConnectionClosed

from app.core.config import settings

logger = logging.getLogger("nailvista.ws")

# ═══════════════════════════════════════════════════
# 会话缓存结构（按 req_id 隔离）
# ═══════════════════════════════════════════════════
# cache[req_id] = {
#     "full_text": str,           # 模型完整回复文本
#     "tools": {
#         call_id: {
#             "tool_name": str,
#             "arguments": dict,  # 调用参数
#             "stream_out": str,  # 工具实时分片输出
#             "final_result": str,
#             "error": str,
#         }
#     },
#     "done": asyncio.Event,      # 完成信号
#     "thinking_steps": list,     # 思考过程
# }


class WSCacheManager:
    """WS 会话缓存管理，30min 过期自动清理"""

    def __init__(self, ttl_seconds: int = 1800):
        self._cache: Dict[str, dict] = {}
        self._ttl = ttl_seconds
        self._cleanup_task: Optional[asyncio.Task] = None

    def create(self, req_id: str) -> dict:
        entry = {
            "full_text": "",
            "tools": {},
            "done": asyncio.Event(),
            "thinking_steps": [],
        }
        self._cache[req_id] = entry
        logger.info(f"[WS-CACHE] 创建会话缓存 | req_id={req_id}")
        return entry

    def get(self, req_id: str) -> Optional[dict]:
        return self._cache.get(req_id)

    def remove(self, req_id: str) -> Optional[dict]:
        return self._cache.pop(req_id, None)

    def start_cleanup(self):
        """启动定时清理任务"""
        async def _cleanup_loop():
            while True:
                await asyncio.sleep(600)  # 每10分钟检查
                expired = []
                for rid, entry in self._cache.items():
                    if entry["done"].is_set():
                        expired.append(rid)
                for rid in expired:
                    self._cache.pop(rid, None)
                    logger.info(f"[WS-CACHE] 清理过期会话 | req_id={rid}")
        self._cleanup_task = asyncio.create_task(_cleanup_loop())

    def stop_cleanup(self):
        if self._cleanup_task:
            self._cleanup_task.cancel()


# 全局缓存实例
cache_manager = WSCacheManager()


# ═══════════════════════════════════════════════════
# WS 连接管理
# ═══════════════════════════════════════════════════

class WSConnectionPool:
    """WebSocket 连接池 — 单例长连接 + 自动重连"""

    def __init__(self):
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._lock = asyncio.Lock()
        self._connected = False
        self._running = True

    async def connect(self) -> None:
        """建立 WS 连接并完成鉴权握手"""
        async with self._lock:
            if self._ws and self._connected:
                return

            ws_url = settings.OPENCLAW_WS_URL
            token = settings.OPENCLAW_GATEWAY_TOKEN

            logger.info(f"[WS] 连接网关 | url={ws_url}")
            try:
                self._ws = await websockets.connect(
                    ws_url,
                    ping_interval=30,
                    ping_timeout=10,
                    close_timeout=5,
                    max_size=2 ** 23,  # 8MB
                )
            except Exception as e:
                logger.error(f"[WS] 连接失败 | url={ws_url} | {type(e).__name__}: {e}")
                raise

            # 发送鉴权握手帧
            connect_frame = json.dumps({
                "type": "connect",
                "payload": {
                    "token": token,
                    "role": "backend",
                    "scopes": ["chat", "tool"],
                },
            })
            await self._ws.send(connect_frame)
            logger.info(f"[WS] 握手成功 | url={ws_url}")
            self._connected = True

    async def disconnect(self) -> None:
        """关闭 WS 连接"""
        async with self._lock:
            if self._ws:
                try:
                    await self._ws.close()
                except Exception:
                    pass
                self._ws = None
            self._connected = False
            logger.info("[WS] 已断开连接")

    @property
    def is_connected(self) -> bool:
        return self._connected and self._ws is not None

    async def _ensure_connected(self) -> None:
        """确保连接可用，断线自动重连"""
        if not self.is_connected:
            await self.connect()

    async def send_chat_request(self, req_id: str, messages: list, tools: Optional[list] = None) -> None:
        """发送对话请求帧"""
        await self._ensure_connected()

        payload = {
            "model": "openclaw/default-agent",
            "messages": messages,
            "stream": True,
            "tool_choice": "auto" if tools else "none",
        }
        if tools:
            payload["tools"] = tools

        chat_req = json.dumps({
            "req_id": req_id,
            "type": "chat.create",
            "payload": payload,
        })
        await self._ws.send(chat_req)
        logger.info(f"[WS] 发送对话请求 | req_id={req_id} | msgs={len(messages)} | tools={len(tools) if tools else 0}")

    async def recv(self) -> dict:
        """接收一帧并解析为 dict"""
        raw = await self._ws.recv()
        return json.loads(raw)

    async def close_connection(self) -> None:
        await self.disconnect()


# 全局连接池
pool = WSConnectionPool()


# 全局回调注册表 — 按 req_id 注册流式事件回调
_event_callbacks: Dict[str, Callable] = {}


def register_callback(req_id: str, callback: Callable) -> None:
    """注册流式事件回调"""
    _event_callbacks[req_id] = callback
    logger.debug(f"[WS-CALLBACK] 注册回调 | req_id={req_id}")


def unregister_callback(req_id: str) -> None:
    """注销流式事件回调"""
    _event_callbacks.pop(req_id, None)
    logger.debug(f"[WS-CALLBACK] 注销回调 | req_id={req_id}")


# ═══════════════════════════════════════════════════
# 事件分发器 — 将 WS 事件映射到缓存更新 + 流式回调
# ═══════════════════════════════════════════════════

async def _dispatch_event(msg: dict) -> Optional[str]:
    """
    处理单条 WS 事件，更新对应 req_id 的缓存，并触发已注册的流式回调。
    返回 "finish" 表示本轮对话结束，否则返回 None。
    """
    req_id = msg.get("req_id")
    event = msg.get("event")
    payload = msg.get("payload", {})

    if not req_id:
        logger.warning(f"[WS-EVENT] 消息缺少 req_id | event={event}")
        return None

    session = cache_manager.get(req_id)

    # 流式回调 — 无论 session 是否存在都触发（前端可能只注册回调未建缓存）
    cb = _event_callbacks.get(req_id)
    if cb:
        try:
            await cb(msg)
        except Exception as e:
            logger.error(f"[WS-CALLBACK] 回调异常 | req_id={req_id} | {type(e).__name__}: {e}")

    if not session:
        return None

    if event == "chat.content_chunk":
        chunk = payload.get("content", "")
        session["full_text"] += chunk

    elif event == "tool.pre_invoke":
        cid = payload.get("call_id", "unknown")
        t_name = payload.get("tool_name", "unknown")
        t_args = payload.get("arguments", {})
        session["tools"][cid] = {
            "tool_name": t_name,
            "arguments": t_args,
            "stream_out": "",
            "final_result": "",
            "error": "",
        }
        logger.info(f"[WS-EVENT] 工具调用指令生成 | req_id={req_id} call_id={cid} tool={t_name} args={json.dumps(t_args, ensure_ascii=False)[:200]}")

    elif event == "tool.stream_output":
        cid = payload.get("call_id", "")
        out_chunk = payload.get("chunk", "")
        if cid in session["tools"]:
            session["tools"][cid]["stream_out"] += out_chunk

    elif event == "tool.post_finish":
        cid = payload.get("call_id", "")
        res = payload.get("result", "")
        err = payload.get("error", "")
        if cid in session["tools"]:
            session["tools"][cid]["final_result"] = res
            session["tools"][cid]["error"] = err
            logger.info(f"[WS-EVENT] 工具执行完成 | req_id={req_id} call_id={cid} "
                       f"result_len={len(str(res))} error={err[:100] if err else 'none'}")

    elif event == "chat.finish":
        logger.info(f"[WS-EVENT] 对话结束 | req_id={req_id} "
                    f"text_len={len(session['full_text']) if session else 0} "
                    f"tools_count={len(session['tools']) if session else 0}")
        if session:
            session["done"].set()
        return "finish"

    # 未知事件类型，仅记录
    elif event:
        logger.debug(f"[WS-EVENT] 未知事件类型 | req_id={req_id} event={event}")

    return None


# ═══════════════════════════════════════════════════
# 消息接收循环 — 后台持续消费 WS 消息
# ═══════════════════════════════════════════════════

async def _ws_recv_loop():
    """后台持续接收 WS 消息并分发到对应缓存"""
    logger.info("[WS-RECV] 消息接收循环启动")
    while pool._running:
        try:
            msg = await pool.recv()
            await _dispatch_event(msg)
        except ConnectionClosed as e:
            logger.warning(f"[WS-RECV] 连接断开 | code={e.code}")
            pool._connected = False
            # 等待重连后继续
            await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"[WS-RECV] 接收异常 | {type(e).__name__}: {e}")
            await asyncio.sleep(0.1)


# ═══════════════════════════════════════════════════
# HTTP 兜底 — 工具日志查询
# ═══════════════════════════════════════════════════

async def fetch_tool_logs_http(req_id: str) -> Optional[dict]:
    """
    通过 HTTP 接口补全 WS 丢失的工具日志。
    GET /v1/log/tools?req_id={req_id}
    """
    try:
        url = f"{settings.OPENCLAW_TOOL_LOG_URL}?req_id={req_id}"
        headers = {"Authorization": f"Bearer {settings.OPENCLAW_GATEWAY_TOKEN}"}
        logger.info(f"[WS-FALLBACK] 拉取工具日志 | req_id={req_id} | url={url}")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                logger.info(f"[WS-FALLBACK] 工具日志拉取成功 | req_id={req_id} | keys={list(data.keys())}")
                return data
            else:
                logger.warning(f"[WS-FALLBACK] 工具日志拉取失败 | req_id={req_id} | status={resp.status_code}")
                return None
    except Exception as e:
        logger.error(f"[WS-FALLBACK] 工具日志拉取异常 | req_id={req_id} | {type(e).__name__}: {e}")
        return None


# ═══════════════════════════════════════════════════
# 主入口 — 单次对话（发送请求 + 等待完成 + 返回汇总）
# ═══════════════════════════════════════════════════

async def ws_chat(
    messages: list,
    tools: Optional[list] = None,
    req_id: Optional[str] = None,
    timeout: float = 120.0,
) -> dict:
    """
    通过 WebSocket 发起一次对话，等待 chat.finish 后返回汇总结果。

    Args:
        messages: 对话消息列表 [{"role": "user", "content": "..."}, ...]
        tools: OpenAI function-calling 格式工具定义列表
        req_id: 客户端自定义请求 ID，不传则自动生成 UUID
        timeout: 超时秒数

    Returns:
        {
            "req_id": str,
            "content": str,              # 模型完整回复文本
            "tool_call_trace": [         # 工具调用全量追踪
                {
                    "call_id": str,
                    "tool_name": str,
                    "arguments": dict,   # 调用参数
                    "stream_out": str,   # 实时输出
                    "final_result": str, # 最终结果
                    "error": str,        # 错误信息
                }
            ],
            "thinking_steps": list,
            "error": Optional[str],     # 异常信息
        }
    """
    rid = req_id or str(uuid.uuid4())
    logger.info(f"[WS-CHAT] 开始对话 | req_id={rid} | msgs={len(messages)} | tools={len(tools) if tools else 0}")

    # 创建缓存
    cache_manager.create(rid)

    try:
        # 发送对话请求
        await pool.send_chat_request(rid, messages, tools)

        # 等待完成事件（超时则返回部分结果）
        session = cache_manager.get(rid)
        try:
            await asyncio.wait_for(session["done"].wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(f"[WS-CHAT] 对话超时 | req_id={rid} | timeout={timeout}s")
            # 尝试 HTTP 兜底
            fallback_logs = await fetch_tool_logs_http(rid)
            if fallback_logs:
                logger.info(f"[WS-CHAT] 已通过 HTTP 补全工具日志 | req_id={rid}")

        # 提取结果
        session = cache_manager.remove(rid)
        if not session:
            # 异常情况：缓存已被清理
            logger.error(f"[WS-CHAT] 缓存丢失 | req_id={rid}")
            return {
                "req_id": rid,
                "content": "AI服务通信异常，请重试",
                "tool_call_trace": [],
                "thinking_steps": [],
                "error": "缓存丢失",
            }

        # 构建工具调用追踪
        tool_trace = []
        for cid, td in session["tools"].items():
            tool_trace.append({
                "call_id": cid,
                "tool_name": td["tool_name"],
                "arguments": td["arguments"],
                "stream_out": td["stream_out"],
                "final_result": td["final_result"],
                "error": td["error"],
            })

        logger.info(f"[WS-CHAT] 对话完成 | req_id={rid} "
                    f"text_len={len(session['full_text'])} tools={len(tool_trace)}")

        return {
            "req_id": rid,
            "content": session["full_text"] or "AI 服务返回为空，请稍后重试",
            "tool_call_trace": tool_trace,
            "thinking_steps": session.get("thinking_steps", []),
            "error": None,
        }

    except Exception as e:
        logger.error(f"[WS-CHAT] 异常 | req_id={rid} | {type(e).__name__}: {e}")
        cache_manager.remove(rid)
        return {
            "req_id": rid,
            "content": f"AI服务通信异常: {str(e)}",
            "tool_call_trace": [],
            "thinking_steps": [],
            "error": str(e),
        }


# ═══════════════════════════════════════════════════
# 流式入口 — ws_chat_stream（前端 WebSocket 透传）
# ═══════════════════════════════════════════════════

async def ws_chat_stream(
    messages: list,
    on_event: Callable,
    tools: Optional[list] = None,
    req_id: Optional[str] = None,
    timeout: float = 120.0,
) -> dict:
    """
    通过 WebSocket 发起一次流式对话，每个网关事件实时回调 on_event(msg)。

    on_event 签名: async def on_event(msg: dict) -> None
      msg 为网关原始事件帧，格式:
        {
          "req_id": str,
          "event": "chat.content_chunk" | "tool.pre_invoke" | "tool.stream_output" | "tool.post_finish" | "chat.finish",
          "payload": { ... }
        }

    返回汇总结果（与 ws_chat 格式相同），用于落库保存。
    """
    rid = req_id or str(uuid.uuid4())
    logger.info(f"[WS-STREAM] 开始流式对话 | req_id={rid} | msgs={len(messages)} | tools={len(tools) if tools else 0}")

    # 创建缓存（用于最终汇总）
    cache_manager.create(rid)
    # 注册流式回调
    register_callback(rid, on_event)

    try:
        await pool.send_chat_request(rid, messages, tools)

        session = cache_manager.get(rid)
        try:
            await asyncio.wait_for(session["done"].wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(f"[WS-STREAM] 对话超时 | req_id={rid} | timeout={timeout}s")
            fallback_logs = await fetch_tool_logs_http(rid)
            if fallback_logs:
                logger.info(f"[WS-STREAM] 已通过 HTTP 补全工具日志 | req_id={rid}")

        session = cache_manager.remove(rid)
        if not session:
            return {
                "req_id": rid, "content": "AI服务通信异常，请重试",
                "tool_call_trace": [], "thinking_steps": [], "error": "缓存丢失",
            }

        tool_trace = []
        for cid, td in session.get("tools", {}).items():
            tool_trace.append({
                "call_id": cid, "tool_name": td["tool_name"],
                "arguments": td["arguments"], "stream_out": td["stream_out"],
                "final_result": td["final_result"], "error": td["error"],
            })

        logger.info(f"[WS-STREAM] 流式完成 | req_id={rid} text_len={len(session['full_text'])} tools={len(tool_trace)}")

        return {
            "req_id": rid,
            "content": session["full_text"] or "AI 服务返回为空，请稍后重试",
            "tool_call_trace": tool_trace,
            "thinking_steps": session.get("thinking_steps", []),
            "error": None,
        }

    except Exception as e:
        logger.error(f"[WS-STREAM] 异常 | req_id={rid} | {type(e).__name__}: {e}")
        cache_manager.remove(rid)
        return {
            "req_id": rid, "content": f"AI服务通信异常: {str(e)}",
            "tool_call_trace": [], "thinking_steps": [], "error": str(e),
        }
    finally:
        unregister_callback(rid)


# ═══════════════════════════════════════════════════
# 生命周期管理
# ═══════════════════════════════════════════════════

async def ws_startup():
    """应用启动时初始化 WS 连接和接收循环"""
    logger.info("[WS-LIFECYCLE] 初始化 WebSocket 客户端")
    cache_manager.start_cleanup()

    # 后台启动接收循环
    asyncio.create_task(_ws_recv_loop())

    # 初始连接（带重试）
    for attempt in range(settings.OPENCLAW_WS_RECONNECT_MAX_RETRIES):
        try:
            await pool.connect()
            logger.info("[WS-LIFECYCLE] WebSocket 连接就绪")
            return
        except Exception as e:
            delay = settings.OPENCLAW_WS_RECONNECT_DELAY
            logger.warning(f"[WS-LIFECYCLE] 连接失败(attempt={attempt + 1}) | {type(e).__name__}: {e} | {delay}s后重试")
            await asyncio.sleep(delay)

    logger.error("[WS-LIFECYCLE] 所有重连尝试失败，WS 服务不可用")


async def ws_shutdown():
    """应用关闭时清理 WS 连接"""
    logger.info("[WS-LIFECYCLE] 关闭 WebSocket 客户端")
    pool._running = False
    cache_manager.stop_cleanup()
    await pool.disconnect()
