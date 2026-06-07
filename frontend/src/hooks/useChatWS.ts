/**
 * useChatWS — WebSocket 流式对话 Hook
 *
 * 用法:
 *   const { messages, send, loading, sessionKey, toolCalls, connect, disconnect, clearMessages } = useChatWS("user");
 *   await connect();
 *   await send("帮我找红色猫眼");
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';

const WS_BASE = `ws://${window.location.host}`;

// ═══════════════════════════════════════════════════
// 模块级单例状态（按 agentType 隔离，页面切换不丢失）
// ═══════════════════════════════════════════════════
interface GlobalState {
  messages: ChatMessage[];
  loading: boolean;
  sessionKey: string | null;
  error: string | null;
  toolCalls: ToolCallEntry[];
  listeners: Set<() => void>;
  ws: WebSocket | null;
  stream: StreamState;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  minLoadingTimer: ReturnType<typeof setTimeout> | null;
}

const globalStates = new Map<string, GlobalState>();

function getGlobal(agentType: string): GlobalState {
  if (!globalStates.has(agentType)) {
    globalStates.set(agentType, {
      messages: [],
      loading: false,
      sessionKey: null,
      error: null,
      toolCalls: [],
      listeners: new Set(),
      ws: null,
      stream: {
        loading: false,
        streamingContent: '',
        toolCalls: [],
        done: false,
        hasAssistantMsg: false,
      },
      reconnectTimer: null,
      minLoadingTimer: null,
    });
  }
  return globalStates.get(agentType)!;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: any[];
  tool_calls?: any[];
}

interface ToolCallEntry {
  call_id?: string;
  name: string;
  arguments?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  round?: number;
}

interface StreamState {
  loading: boolean;
  streamingContent: string;
  toolCalls: ToolCallEntry[];
  done: boolean;
  /** 是否已经创建了当前流式输出的 assistant 消息 */
  hasAssistantMsg: boolean;
}

function notify(state: GlobalState) {
  state.listeners.forEach(fn => fn());
}

export default function useChatWS(agentType: 'user' | 'ops' = 'user') {
  const [, forceUpdate] = useState(0);
  const state = getGlobal(agentType);

  // 订阅模块级状态变化，驱动 React 重渲染
  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1);
    state.listeners.add(listener);
    return () => { state.listeners.delete(listener); };
  }, [state]);

  const sessionKeyRef = useRef<string | null>(state.sessionKey);

  const getToken = useCallback(() => localStorage.getItem('token') || '', []);

  const connect = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const token = getToken();
      if (!token) { reject(new Error('未登录')); return; }

      if (state.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const url = `${WS_BASE}/ws/chat/${agentType}?token=${encodeURIComponent(token)}`;
      console.log(`[useChatWS] 连接 ${url}`);
      const ws = new WebSocket(url);

      let settled = false;

      ws.onopen = () => {
        console.log('[useChatWS] 已连接');
        state.ws = ws;
        state.error = null;
        notify(state);
        if (!settled) { settled = true; resolve(); }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent(data);
        } catch (e) {
          console.error('[useChatWS] 消息解析失败', e);
        }
      };

      ws.onerror = (e) => {
        console.error('[useChatWS] 连接错误', e);
        state.error = 'WebSocket连接错误';
        notify(state);
        if (!settled) { settled = true; reject(new Error('WebSocket连接错误')); }
      };

      ws.onclose = () => {
        console.log('[useChatWS] 连接关闭');
        state.ws = null;
        if (!settled) { settled = true; reject(new Error('WebSocket连接已关闭')); }
        if (!state.stream.done) {
          state.reconnectTimer = setTimeout(() => {
            console.log('[useChatWS] 尝试重连...');
            connect().catch(() => {});
          }, 3000);
        }
      };
    });
  }, [agentType, getToken]);

  const disconnect = useCallback(() => {
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    if (state.ws) {
      state.ws.close();
      state.ws = null;
    }
  }, []);

  // 不自动 disconnect — 由消费者决定何时断开（页面切换时保持连接）

  /** 确保 loading 至少显示 minMs 毫秒，避免一闪而过 */
  const stopLoadingMin = useCallback((minMs: number = 600) => {
    if (state.minLoadingTimer) clearTimeout(state.minLoadingTimer);
    state.minLoadingTimer = setTimeout(() => {
      state.loading = false;
      state.stream.loading = false;
      state.minLoadingTimer = null;
      notify(state);
    }, minMs);
  }, []);

  const handleEvent = useCallback((data: any) => {
    const type = data.type;
    const stream = state.stream;

    switch (type) {
      case 'session':
        state.sessionKey = data.session_key;
        sessionKeyRef.current = data.session_key;
        notify(state);
        break;

      case 'thinking': {
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          state.messages = [...state.messages, {
            role: 'assistant',
            content: '',
            tool_calls: [],
            thinking: [{ type: 'thinking', content: data.content, round: data.round }],
          }];
        } else {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant') {
            const existing = Array.isArray(last.thinking) ? last.thinking : [];
            state.messages = [...state.messages.slice(0, -1), {
              ...last,
              thinking: [...existing, { type: 'thinking', content: data.content, round: data.round }],
            }];
          }
        }
        notify(state);
        break;
      }

      case 'text': {
        stream.streamingContent += data.content;
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          state.messages = [...state.messages, {
            role: 'assistant',
            content: stream.streamingContent,
            tool_calls: [...stream.toolCalls],
          }];
        } else {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant') {
            state.messages = [...state.messages.slice(0, -1), {
              ...last,
              content: stream.streamingContent,
              tool_calls: [...stream.toolCalls],
            }];
          }
        }
        notify(state);
        break;
      }

      case 'tool_call': {
        stream.toolCalls.push({
          call_id: data.call_id,
          name: data.name,
          arguments: data.arguments,
          round: data.round,
        });
        state.toolCalls = [...stream.toolCalls];
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          state.messages = [...state.messages, {
            role: 'assistant',
            content: stream.streamingContent,
            tool_calls: [...stream.toolCalls],
          }];
        } else {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === 'assistant') {
            state.messages = [...state.messages.slice(0, -1), { ...last, tool_calls: [...stream.toolCalls] }];
          }
        }
        notify(state);
        break;
      }

      case 'tool_result':
      case 'tool_result_local':
      case 'tool_output': {
        if (data.call_id) {
          const idx = stream.toolCalls.findIndex(t => t.call_id === data.call_id);
          if (idx >= 0) {
            stream.toolCalls[idx] = { ...stream.toolCalls[idx], result: data.output || data.result || {}, error: data.error };
          }
        } else if (data.name) {
          for (let i = stream.toolCalls.length - 1; i >= 0; i--) {
            if (stream.toolCalls[i].name === data.name && !stream.toolCalls[i].result) {
              stream.toolCalls[i] = { ...stream.toolCalls[i], result: data.output || data.result || {}, error: data.error };
              break;
            }
          }
        }
        state.toolCalls = [...stream.toolCalls];
        const last = state.messages[state.messages.length - 1];
        if (last?.role === 'assistant') {
          state.messages = [...state.messages.slice(0, -1), { ...last, tool_calls: [...stream.toolCalls] }];
        }
        notify(state);
        break;
      }

      case 'status':
        if (data.status === 'running') {
          state.loading = true;
          state.stream.loading = true;
        } else if (data.status === 'done') {
          state.stream.done = true;
          stopLoadingMin(500);
        } else if (data.status === 'error') {
          state.error = data.message || '执行异常';
          stopLoadingMin(500);
        }
        notify(state);
        break;

      case 'done':
        state.stream.done = true;
        stopLoadingMin(500);
        break;

      case 'error':
        console.error('[useChatWS] 服务端错误', data.message);
        state.error = data.message;
        stopLoadingMin(500);
        notify(state);
        message.error(data.message || '对话异常');
        break;

      default:
        console.log('[useChatWS] 未知事件', type, data);
    }
  }, []);

  const send = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;

    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      try {
        await connect();
      } catch (e) {
        message.error('连接失败，请重试');
        return;
      }
    }

    state.stream = {
      loading: true,
      streamingContent: '',
      toolCalls: [],
      done: false,
      hasAssistantMsg: false,
    };
    state.loading = true;
    state.error = null;
    state.messages = [...state.messages, { role: 'user', content: userMessage }];
    notify(state);

    state.ws!.send(JSON.stringify({
      type: 'user_message',
      text: userMessage,
      session_key: sessionKeyRef.current || undefined,
    }));
  }, [connect]);

  const toolCalls = state.stream.toolCalls;

  const clearMessages = useCallback(() => {
    if (state.minLoadingTimer) clearTimeout(state.minLoadingTimer);
    state.messages = [];
    state.toolCalls = [];
    sessionKeyRef.current = null;
    state.sessionKey = null;
    state.stream = {
      loading: false,
      streamingContent: '',
      toolCalls: [],
      done: false,
      hasAssistantMsg: false,
    };
    state.loading = false;
    notify(state);
  }, []);

  /** 手动设置当前会话 key（切换历史会话时调用） */
  const setCurrentSessionKey = useCallback((key: string | null) => {
    sessionKeyRef.current = key;
    state.sessionKey = key;
    notify(state);
  }, []);

  return {
    messages: state.messages,
    send,
    loading: state.loading,
    error: state.error,
    sessionKey: state.sessionKey,
    toolCalls: state.toolCalls,
    connect,
    disconnect,
    clearMessages,
    setCurrentSessionKey,
  };
}
