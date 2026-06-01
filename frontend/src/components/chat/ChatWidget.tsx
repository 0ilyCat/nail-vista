import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { SendOutlined, RobotOutlined, ToolOutlined, BulbOutlined, DownOutlined, RightOutlined, HistoryOutlined, PlusOutlined, CloseOutlined, MessageOutlined } from '@ant-design/icons';
import ChartRenderer from './ChartRenderer';

interface ChartConfig {
  id: string;
  config: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[];
  thinking?: string;
  steps?: SkillStep[];
  charts?: ChartConfig[];
}

interface ToolCallRecord {
  id: string;
  name: string;
  description: string;
  result?: string;
  status: 'running' | 'done';
}

interface SkillStep {
  name: string;
  description: string;
  result?: string;
  status: 'running' | 'done';
}

interface SessionInfo {
  session_key: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatWidgetProps {
  agentType: 'user' | 'dashboard';
  placeholder?: string;
  welcomeMessage?: string;
  title?: string;
  quickActions?: { label: string; message: string }[];
  contextImage?: string | null;
}

// ── Extract chart blocks ──
function extractCharts(content: string): { cleanContent: string; charts: ChartConfig[] } {
  const charts: ChartConfig[] = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = regex.exec(content)) !== null) {
    try {
      const config = match[1].trim();
      JSON.parse(config);
      charts.push({ id: `chart-${Date.now()}-${idx++}`, config });
    } catch { /* skip */ }
  }
  return { cleanContent: content.replace(regex, '').trim(), charts };
}

// ── Format session title from first message ──
function formatSessionTitle(msg: string): string {
  const cleaned = msg.replace(/[\n\r]+/g, ' ').trim();
  return cleaned.length > 20 ? cleaned.slice(0, 20) + '...' : cleaned;
}

export default function ChatWidget({
  agentType,
  placeholder = '输入消息...',
  welcomeMessage,
  title,
  quickActions = [],
  contextImage = null,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // ── Session history state ──
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Fetch sessions ──
  const fetchSessions = useCallback(async () => {
    try {
      const resp = await fetch(`/api/chat/sessions?agent_type=${agentType}`);
      const data = await resp.json();
      setSessions(data.sessions || []);
    } catch { /* ignore */ }
  }, [agentType]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // ── Load session messages ──
  const loadSession = async (sk: string) => {
    try {
      const resp = await fetch(`/api/chat/sessions/${sk}`);
      const data = await resp.json();
      const msgs: Message[] = (data.messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(msgs.length > 0 ? msgs : [{ role: 'assistant', content: welcomeMessage || '会话为空' }]);
      setSessionKey(sk);
      setShowHistory(false);
    } catch {
      // fallback
    }
  };

  // ── New chat ──
  const newChat = () => {
    setMessages(welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : []);
    setSessionKey(null);
    setShowHistory(false);
  };

  // ── Stream chat ──
  const streamChat = async (message: string) => {
    setLoading(true);
    const endpoint = agentType === 'user'
      ? '/api/chat/user/stream'
      : '/api/chat/dashboard/stream';

    const body: any = { message };
    if (sessionKey) body.session_key = sessionKey;
    if (contextImage) body.image_url = contextImage;

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${err.detail || '服务暂不可用'}` }]);
        setLoading(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setLoading(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      const toolCalls: ToolCallRecord[] = [];
      const steps: SkillStep[] = [];
      let thinking = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', toolCalls: [], thinking: '', steps: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          if (!dataStr) continue;
          try {
            const event = JSON.parse(dataStr);
            switch (event.type) {
              case 'session': {
                setSessionKey(event.session_key);
                // Update session title in sidebar
                if (!sessionKey) {
                  fetchSessions();
                }
                break;
              }
              case 'text':
                assistantContent += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.content = assistantContent;
                  return [...updated];
                });
                break;
              case 'skill_start': {
                const ss: SkillStep = { name: event.name, description: event.description || event.name, status: 'running' };
                steps.push(ss);
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.steps = [...steps];
                  return [...updated];
                });
                break;
              }
              case 'skill_end': {
                const idx = steps.findIndex(s => s.name === event.name);
                if (idx >= 0) { steps[idx].status = 'done'; steps[idx].result = event.result; }
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.steps = [...steps];
                  return [...updated];
                });
                break;
              }
              case 'tool_start': {
                const tc: ToolCallRecord = { id: event.id, name: event.name, description: event.description || event.name, status: 'running' };
                (tc as any).input = event.input || '';
                toolCalls.push(tc);
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.toolCalls = [...toolCalls];
                  return [...updated];
                });
                break;
              }
              case 'tool_end': {
                const idx = toolCalls.findIndex(t => t.id === event.id);
                if (idx >= 0) { toolCalls[idx].status = 'done'; toolCalls[idx].result = event.result; }
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.toolCalls = [...toolCalls];
                  return [...updated];
                });
                break;
              }
              case 'thinking':
                thinking += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') last.thinking = thinking;
                  return [...updated];
                });
                break;
              case 'error':
                setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${event.message}` }]);
                break;
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 网络错误，请重试' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setInput('');
    streamChat(msg);
  };

  const handleQuickAction = (msg: string) => {
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    streamChat(msg);
  };

  const toggleTool = (id: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // ── Derive session title from first user message ──
  const currentTitle = (() => {
    const firstUser = messages.find(m => m.role === 'user');
    return firstUser ? formatSessionTitle(firstUser.content) : '新对话';
  })();

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <button
          className="history-toggle-btn"
          onClick={() => setShowHistory(!showHistory)}
          title="历史对话"
        >
          <HistoryOutlined style={{ fontSize: 16 }} />
        </button>
        <RobotOutlined style={{ color: 'var(--primary)' }} />
        <span style={{ flex: 1 }}>{title || currentTitle}</span>
        <button
          className="new-chat-btn"
          onClick={newChat}
          title="新建对话"
        >
          <PlusOutlined style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Session sidebar */}
      {showHistory && (
        <div className="session-sidebar">
          <div className="session-sidebar-header">
            <span>历史对话</span>
            <button onClick={() => setShowHistory(false)} className="session-close-btn">
              <CloseOutlined style={{ fontSize: 12 }} />
            </button>
          </div>
          <div className="session-list">
            {sessions.length === 0 && (
              <div className="session-empty">暂无历史对话</div>
            )}
            {sessions.map(s => (
              <div
                key={s.session_key}
                className={`session-item ${s.session_key === sessionKey ? 'active' : ''}`}
                onClick={() => loadSession(s.session_key)}
              >
                <MessageOutlined style={{ fontSize: 12, color: '#999', flexShrink: 0 }} />
                <span className="session-title">{s.title === '新对话' ? '新对话' : s.title}</span>
                <span className="session-time">
                  {new Date(s.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages" style={{ height: showHistory ? 'calc(100% - 210px)' : undefined }}>
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            {msg.thinking && msg.thinking.trim() && (
              <div className="thinking-box" onClick={() => toggleThinking(idx)} style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BulbOutlined style={{ fontSize: 11 }} />
                  <span>思考中...</span>
                  {expandedThinking.has(idx) ? <DownOutlined style={{ fontSize: 10, marginLeft: 'auto' }} /> : <RightOutlined style={{ fontSize: 10, marginLeft: 'auto' }} />}
                </div>
                {expandedThinking.has(idx) && (
                  <div className="tool-call-body" style={{ marginTop: 6 }}>{msg.thinking}</div>
                )}
              </div>
            )}

            {msg.steps && msg.steps.map((step, si) => (
              <div key={`${step.name}-${si}`} className="skill-step-box">
                <div className="skill-step-header">
                  {step.status === 'running' ? <span className="skill-step-icon running">⏳</span> : <span className="skill-step-icon done">✅</span>}
                  <span>{step.description}</span>
                </div>
                {step.result && <div className="skill-step-result">{step.result}</div>}
              </div>
            ))}

            {msg.toolCalls && msg.toolCalls.map(tc => (
              <div key={tc.id} className="tool-call-box" onClick={() => toggleTool(tc.id)} style={{ marginBottom: 4 }}>
                <div className="tool-call-header">
                  <ToolOutlined style={{ fontSize: 11 }} />
                  {tc.status === 'running' ? '🔧 ' : '✅ '}
                  {tc.description}
                  {expandedTools.has(tc.id) ? <DownOutlined style={{ fontSize: 10, marginLeft: 'auto' }} /> : <RightOutlined style={{ fontSize: 10, marginLeft: 'auto' }} />}
                </div>
                {expandedTools.has(tc.id) && (
                  <div className="tool-call-body">
                    {(tc as any).input && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>输入参数：</div>
                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: '#f5f5f5', padding: 6, borderRadius: 4 }}>{(tc as any).input}</pre>
                      </div>
                    )}
                    {tc.result && (
                      <div>
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>返回结果：</div>
                        <div>{tc.result}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {msg.content && (() => {
              const { cleanContent, charts } = msg.role === 'assistant' ? extractCharts(msg.content) : { cleanContent: msg.content, charts: [] as ChartConfig[] };
              return (
                <>
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          table: ({ children }) => (
                            <div className="chat-table-wrap"><table>{children}</table></div>
                          ),
                        }}
                      >
                        {cleanContent}
                      </ReactMarkdown>
                    ) : msg.content}
                  </div>
                  {charts.map(chart => (
                    <ChartRenderer key={chart.id} config={chart.config} id={chart.id} />
                  ))}
                </>
              );
            })()}
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-bubble assistant">
              <div className="typing-indicator"><span /><span /><span /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {quickActions.length > 0 && !sessionKey && (
        <div className="quick-actions">
          {quickActions.map((qa, i) => (
            <button key={i} className="quick-action-btn" onClick={() => handleQuickAction(qa.message)} disabled={loading}>
              {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={placeholder}
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          <SendOutlined style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  );
}
