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

export default function useChatWS(agentType: 'user' | 'ops' = 'user') {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<StreamState>({
    loading: false,
    streamingContent: '',
    toolCalls: [],
    done: false,
    hasAssistantMsg: false,
  });
  const [, forceUpdate] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionKeyRef = useRef<string | null>(null);
  const minLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = useCallback(() => localStorage.getItem('token') || '', []);

  const connect = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const token = getToken();
      if (!token) { reject(new Error('未登录')); return; }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const url = `${WS_BASE}/ws/chat/${agentType}?token=${encodeURIComponent(token)}`;
      console.log(`[useChatWS] 连接 ${url}`);
      const ws = new WebSocket(url);

      let settled = false;

      ws.onopen = () => {
        console.log('[useChatWS] 已连接');
        wsRef.current = ws;
        setError(null);
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
        setError('WebSocket连接错误');
        if (!settled) { settled = true; reject(new Error('WebSocket连接错误')); }
      };

      ws.onclose = () => {
        console.log('[useChatWS] 连接关闭');
        wsRef.current = null;
        if (!settled) { settled = true; reject(new Error('WebSocket连接已关闭')); }
        if (!streamRef.current.done) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log('[useChatWS] 尝试重连...');
            connect().catch(() => {});
          }, 3000);
        }
      };
    });
  }, [agentType, getToken]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  /** 确保 loading 至少显示 minMs 毫秒，避免一闪而过 */
  const stopLoadingMin = useCallback((minMs: number = 600) => {
    if (minLoadingTimerRef.current) clearTimeout(minLoadingTimerRef.current);
    minLoadingTimerRef.current = setTimeout(() => {
      setLoading(false);
      streamRef.current.loading = false;
      minLoadingTimerRef.current = null;
    }, minMs);
  }, []);

  const handleEvent = useCallback((data: any) => {
    const type = data.type;
    const stream = streamRef.current;

    switch (type) {
      case 'session':
        setSessionKey(data.session_key);
        sessionKeyRef.current = data.session_key;
        break;

      case 'thinking': {
        // 思考过程：确保有 assistant 消息后再追加 thinking
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            tool_calls: [],
            thinking: [{ type: 'thinking', content: data.content, round: data.round }],
          }]);
        } else {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              const existing = Array.isArray(last.thinking) ? last.thinking : [];
              return [...prev.slice(0, -1), {
                ...last,
                thinking: [...existing, { type: 'thinking', content: data.content, round: data.round }],
              }];
            }
            return prev;
          });
        }
        break;
      }

      case 'text': {
        // 流式文本增量：确保只有一个 assistant 消息被更新
        stream.streamingContent += data.content;
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: stream.streamingContent,
            tool_calls: [...stream.toolCalls],
          }]);
        } else {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), {
                ...last,
                content: stream.streamingContent,
                tool_calls: [...stream.toolCalls],
              }];
            }
            return prev;
          });
        }
        forceUpdate(n => n + 1);
        break;
      }

      case 'tool_call': {
        stream.toolCalls.push({
          call_id: data.call_id,
          name: data.name,
          arguments: data.arguments,
          round: data.round,
        });
        if (!stream.hasAssistantMsg) {
          stream.hasAssistantMsg = true;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: stream.streamingContent,
            tool_calls: [...stream.toolCalls],
          }]);
        } else {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, tool_calls: [...stream.toolCalls] }];
            }
            return prev;
          });
        }
        forceUpdate(n => n + 1);
        break;
      }

      case 'tool_result':
      case 'tool_result_local':
      case 'tool_output': {
        if (data.call_id) {
          const idx = stream.toolCalls.findIndex(t => t.call_id === data.call_id);
          if (idx >= 0) {
            stream.toolCalls[idx] = {
              ...stream.toolCalls[idx],
              result: data.output || data.result || {},
              error: data.error,
            };
          }
        } else if (data.name) {
          for (let i = stream.toolCalls.length - 1; i >= 0; i--) {
            if (stream.toolCalls[i].name === data.name && !stream.toolCalls[i].result) {
              stream.toolCalls[i] = {
                ...stream.toolCalls[i],
                result: data.output || data.result || {},
                error: data.error,
              };
              break;
            }
          }
        }
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { ...last, tool_calls: [...stream.toolCalls] }];
          }
          return prev;
        });
        forceUpdate(n => n + 1);
        break;
      }

      case 'status':
        if (data.status === 'running') {
          setLoading(true);
          streamRef.current.loading = true;
        } else if (data.status === 'done') {
          streamRef.current.done = true;
          stopLoadingMin(500);
        } else if (data.status === 'error') {
          setError(data.message || '执行异常');
          stopLoadingMin(500);
        }
        break;

      case 'done':
        streamRef.current.done = true;
        stopLoadingMin(500);
        break;

      case 'error':
        console.error('[useChatWS] 服务端错误', data.message);
        setError(data.message);
        stopLoadingMin(500);
        message.error(data.message || '对话异常');
        break;

      default:
        console.log('[useChatWS] 未知事件', type, data);
    }
  }, []);

  const send = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      try {
        await connect();
      } catch (e) {
        message.error('连接失败，请重试');
        return;
      }
    }

    streamRef.current = {
      loading: true,
      streamingContent: '',
      toolCalls: [],
      done: false,
      hasAssistantMsg: false,
    };
    setLoading(true);
    setError(null);

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    wsRef.current!.send(JSON.stringify({
      type: 'user_message',
      text: userMessage,
      session_key: sessionKeyRef.current || undefined,
    }));
  }, [connect]);

  const toolCalls = streamRef.current.toolCalls;

  const clearMessages = useCallback(() => {
    if (minLoadingTimerRef.current) clearTimeout(minLoadingTimerRef.current);
    setMessages([]);
    sessionKeyRef.current = null;
    streamRef.current = {
      loading: false,
      streamingContent: '',
      toolCalls: [],
      done: false,
      hasAssistantMsg: false,
    };
    setLoading(false);
  }, []);

  /** 手动设置当前会话 key（切换历史会话时调用） */
  const setCurrentSessionKey = useCallback((key: string | null) => {
    sessionKeyRef.current = key;
    setSessionKey(key);
  }, []);

  return {
    messages,
    send,
    loading,
    error,
    sessionKey,
    toolCalls,
    connect,
    disconnect,
    clearMessages,
    setCurrentSessionKey,
  };
}
