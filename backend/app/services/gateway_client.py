"""
OpenClaw Gateway WebSocket 客户端 — 官方协议 v4

三层架构中的第二层：Python Relay → OpenClaw Gateway
前端只连后端 WebSocket，后端负责鉴权/会话持久化/事件转发，
Gateway 负责 agent 执行、tool 调用、流式输出。
"""
import asyncio
import json
import logging
import uuid
from typing import Optional, Dict, Callable, Awaitable

import websockets
from websockets.exceptions import ConnectionClosed

from app.core.config import settings

logger = logging.getLogger("nailvista.gateway")

# ═══════════════════════════════════════════════════
# Gateway WS 连接（单例 + 自动重连）
# ═══════════════════════════════════════════════════


class GatewayConnection:
    """到 OpenClaw Gateway 的长期 WS 连接"""

    def __init__(self):
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._lock = asyncio.Lock()
        self._connected = False
        self._running = True
        self._pending: Dict[str, asyncio.Future] = {}  # req_id → Future
        self._event_handlers: Dict[str, list[Callable]] = {}  # event_type → [callback]
        self._recv_task: Optional[asyncio.Task] = None

    @property
    def ws_url(self) -> str:
        # Gateway 单端口：WS 和 HTTP 共用 18789
        base = settings.OPENCLAW_BASE_URL.replace("http://", "ws://").replace("https://", "wss://")
        return base

    async def connect(self, max_retries: int = None) -> None:
        """建立 WS 连接并完成协议握手。
        
        Args:
            max_retries: 最大重试次数，默认使用配置值。设为 0 表示无限重试。
        """
        async with self._lock:
            if self._ws and self._connected:
                return

            url = self.ws_url
            logger.info(f"[GATEWAY] 连接 | url={url}")

            retries = max_retries if max_retries is not None else settings.OPENCLAW_WS_RECONNECT_MAX_RETRIES
            attempt = 0
            while retries == 0 or attempt < retries:
                attempt += 1
                try:
                    self._ws = await websockets.connect(
                        url,
                        ping_interval=30,
                        ping_timeout=10,
                        close_timeout=5,
                        max_size=2 ** 23,
                    )
                    break
                except Exception as e:
                    delay = settings.OPENCLAW_WS_RECONNECT_DELAY
                    logger.warning(f"[GATEWAY] 连接失败 attempt={attempt} | {type(e).__name__}: {e} | {delay}s后重试")
                    await asyncio.sleep(delay)
            else:
                raise ConnectionError(f"Gateway 连接失败，已重试 {attempt} 次")

            # 等待 connect.challenge（Gateway 握手前置质询）
            raw = await asyncio.wait_for(self._ws.recv(), timeout=10.0)
            challenge = json.loads(raw)
            challenge_nonce = None
            if challenge.get("type") == "event" and challenge.get("event") == "connect.challenge":
                challenge_nonce = challenge.get("payload", {}).get("nonce", "")
                logger.debug(f"[GATEWAY] 收到 connect.challenge | nonce={challenge_nonce[:8]}...")
            else:
                logger.warning(f"[GATEWAY] 未收到 connect.challenge，收到: {challenge.get('type')} {challenge.get('event','')}")

            # 协议握手 — connect 是第一帧
            # 使用受信任后端路径: gateway-client + backend，跳过 device 认证
            req_id = str(uuid.uuid4())
            connect_params = {
                "minProtocol": 4,
                "maxProtocol": 4,
                "client": {
                    "id": "gateway-client",
                    "version": "1.0.0",
                    "platform": "linux",
                    "mode": "backend",
                },
                "role": "operator",
                "scopes": ["operator.read", "operator.write"],
                "auth": {"token": settings.OPENCLAW_GATEWAY_TOKEN},
            }
            logger.debug(f"[GATEWAY] connect params | {json.dumps(connect_params, ensure_ascii=False)}")
            connect_frame = json.dumps({
                "type": "req",
                "id": req_id,
                "method": "connect",
                "params": connect_params,
            })
            await self._ws.send(connect_frame)

            # 等待 hello-ok
            raw = await asyncio.wait_for(self._ws.recv(), timeout=15.0)
            msg = json.loads(raw)

            if msg.get("type") == "res" and msg.get("ok"):
                payload = msg.get("payload", {})
                protocol = payload.get("protocol", 0)
                logger.info(f"[GATEWAY] 握手成功 | protocol=v{protocol} | server={payload.get('server',{}).get('version','?')}")
                self._connected = True
            else:
                error = msg.get("error", {})
                logger.error(f"[GATEWAY] 握手失败 | code={error.get('code','?')} "
                           f"message={error.get('message','')} "
                           f"details={json.dumps(error.get('details',{}))}")
                logger.error(f"[GATEWAY] 完整响应 | raw={raw}")
                raise ConnectionError(f"Gateway 握手失败: {error.get('code', 'UNKNOWN')} - {error.get('message', '')}")

    async def disconnect(self) -> None:
        """关闭连接"""
        async with self._lock:
            self._running = False
            if self._recv_task:
                self._recv_task.cancel()
                self._recv_task = None
            if self._ws:
                try:
                    await self._ws.close()
                except Exception:
                    pass
                self._ws = None
            self._connected = False
            # 清理所有未完成的请求
            for fut in self._pending.values():
                if not fut.done():
                    fut.set_exception(ConnectionError("Gateway 连接已断开"))
            self._pending.clear()
            logger.info("[GATEWAY] 已断开")

    async def _ensure_connected(self):
        """确保连接可用，断线时自动重连"""
        if not self._connected or not self._ws:
            await self.connect()
        # 启动接收循环（如果尚未启动）
        if not self._recv_task or self._recv_task.done():
            self._recv_task = asyncio.create_task(self._recv_loop())

    # ═══════════════════════════════════════
    # RPC 调用
    # ═══════════════════════════════════════

    async def _call(self, method: str, params: dict = None, timeout: float = 60.0) -> dict:
        """发送 RPC 请求并等待响应，连接断开时自动重连重试"""
        max_call_retries = 2
        for call_attempt in range(max_call_retries):
            try:
                await self._ensure_connected()
                req_id = str(uuid.uuid4())
                frame = json.dumps({
                    "type": "req",
                    "id": req_id,
                    "method": method,
                    "params": params or {},
                })
                fut = asyncio.get_event_loop().create_future()
                self._pending[req_id] = fut
                await self._ws.send(frame)
                logger.debug(f"[GATEWAY-RPC] {method} | id={req_id}")

                result = await asyncio.wait_for(fut, timeout=timeout)
                return result
            except (ConnectionError, ConnectionClosed, OSError) as e:
                logger.warning(f"[GATEWAY-RPC] 连接异常 attempt={call_attempt+1}/{max_call_retries} | {type(e).__name__}: {e}")
                self._connected = False
                if call_attempt < max_call_retries - 1:
                    await asyncio.sleep(2)
                else:
                    raise
            except asyncio.TimeoutError:
                self._pending.pop(req_id, None)
                raise
            except Exception:
                self._pending.pop(req_id, None)
                raise

    async def sessions_create(self) -> dict:
        """创建新会话，返回 sessionKey"""
        res = await self._call("sessions.create")
        payload = res.get("payload", {})
        return payload

    async def sessions_subscribe(self) -> dict:
        """订阅会话变更"""
        return await self._call("sessions.subscribe")

    async def sessions_messages_subscribe(self, session_key: str) -> dict:
        """订阅会话消息流"""
        return await self._call("sessions.messages.subscribe", {
            "sessionKey": session_key,
        })

    async def chat_send(self, session_key: str, text: str, agent_id: str = None) -> dict:
        """发送聊天消息"""
        params = {"sessionKey": session_key, "text": text}
        if agent_id:
            params["agentId"] = agent_id
        return await self._call("chat.send", params, timeout=300.0)

    async def chat_history(self, session_key: str, limit: int = 50) -> dict:
        """获取聊天历史（UI 标准化视图）"""
        return await self._call("chat.history", {
            "sessionKey": session_key,
            "limit": limit,
        })

    async def chat_message_get(self, session_key: str, message_id: str) -> dict:
        """获取单条消息详情"""
        return await self._call("chat.message.get", {
            "sessionKey": session_key,
            "messageId": message_id,
        })

    async def sessions_abort(self, session_key: str) -> dict:
        """中止会话"""
        return await self._call("sessions.abort", {"key": session_key})

    async def sessions_steer(self, session_key: str, text: str) -> dict:
        """中断并转向"""
        return await self._call("sessions.steer", {
            "key": session_key,
            "text": text,
        })

    # ═══════════════════════════════════════
    # 事件订阅
    # ═══════════════════════════════════════

    def on_event(self, event_type: str, handler: Callable[[dict], Awaitable[None]]):
        """注册事件处理器"""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)

    def off_event(self, event_type: str, handler: Callable):
        """移除事件处理器"""
        handlers = self._event_handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)

    async def _dispatch_event(self, msg: dict):
        """分发 Gateway 事件到已注册的处理器"""
        event_type = msg.get("event", "")
        handlers = self._event_handlers.get(event_type, [])
        if not handlers:
            return
        for handler in handlers:
            try:
                await handler(msg)
            except Exception as e:
                logger.error(f"[GATEWAY-EVENT] 处理器异常 | event={event_type} | {type(e).__name__}: {e}")

    # ═══════════════════════════════════════
    # 接收循环
    # ═══════════════════════════════════════

    async def _recv_loop(self):
        """后台持续接收 Gateway 消息，分发给 pending futures 和事件处理器"""
        logger.info("[GATEWAY-RECV] 接收循环启动")
        while self._running and self._ws:
            try:
                raw = await self._ws.recv()
                msg = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "res":
                    # 响应 — 分发给等待的 Future
                    req_id = msg.get("id")
                    if req_id and req_id in self._pending:
                        fut = self._pending.pop(req_id)
                        if not fut.done():
                            if msg.get("ok"):
                                fut.set_result(msg)
                            else:
                                error = msg.get("error", {})
                                fut.set_exception(RuntimeError(
                                    f"Gateway RPC 失败: {error.get('code', 'UNKNOWN')} - {error.get('message', '')}"
                                ))

                elif msg_type == "event":
                    # 广播事件 — 分发给事件处理器
                    await self._dispatch_event(msg)

            except ConnectionClosed as e:
                logger.warning(f"[GATEWAY-RECV] 连接断开 | code={e.code}，自动重连...")
                self._connected = False
                # 持续重连直到恢复
                while self._running:
                    try:
                        await self.connect()
                        logger.info("[GATEWAY-RECV] 重连成功")
                        break
                    except Exception as reconnect_err:
                        logger.warning(f"[GATEWAY-RECV] 重连失败 | {reconnect_err} | 5s后重试")
                        await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"[GATEWAY-RECV] 接收异常 | {type(e).__name__}: {e}")
                await asyncio.sleep(0.1)


# 全局单例
gateway = GatewayConnection()


# ═══════════════════════════════════════════════════
# 生命周期
# ═══════════════════════════════════════════════════

async def gateway_startup():
    """应用启动时在后台持续重连直到 OpenClaw 就绪（不阻塞服务启动）"""
    logger.info("[GATEWAY-LIFECYCLE] 初始化（后台重连模式）")
    asyncio.create_task(_gateway_reconnect_loop())


async def _gateway_reconnect_loop():
    """后台无限重连，直到 Gateway 连接成功"""
    while True:
        try:
            # max_retries=0 → 无限重试
            await gateway.connect(max_retries=0)
            logger.info("[GATEWAY-LIFECYCLE] 连接就绪")
            # 启动接收循环
            if not gateway._recv_task or gateway._recv_task.done():
                gateway._recv_task = asyncio.create_task(gateway._recv_loop())
            return
        except Exception as e:
            logger.warning(f"[GATEWAY-LIFECYCLE] 连接失败: {e} | 5s后重试")
            gateway._connected = False
            await asyncio.sleep(5)


async def gateway_shutdown():
    """应用关闭时清理"""
    logger.info("[GATEWAY-LIFECYCLE] 关闭")
    await gateway.disconnect()
