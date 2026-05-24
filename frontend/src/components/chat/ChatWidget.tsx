import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { SendOutlined, RobotOutlined, UserOutlined, ToolOutlined, BulbOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import ChartRenderer from './ChartRenderer';

interface ChartConfig {
  id: string;
  config: string; // JSON string parsed from ```chart block
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

interface ChatWidgetProps {
  agentType: 'user' | 'dashboard';
  placeholder?: string;
  welcomeMessage?: string;
  title?: string;
  quickActions?: { label: string; message: string }[];
  contextImage?: string | null;   // for 小美 evaluating tryon results
}

// ── Extract chart blocks from markdown content ──
function extractCharts(content: string): { cleanContent: string; charts: ChartConfig[] } {
  const charts: ChartConfig[] = [];
  const regex = /```chart\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(content)) !== null) {
    try {
      const config = match[1].trim();
      JSON.parse(config); // validate JSON
      charts.push({ id: `chart-${Date.now()}-${idx++}`, config });
    } catch { /* skip invalid */ }
  }

  const cleanContent = content.replace(regex, '').trim();
  return { cleanContent, charts };
}

export default function ChatWidget({
  agentType,
  placeholder = '输入消息...',
  welcomeMessage,
  title,
  quickActions = [],
  contextImage = null,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (welcomeMessage) {
      return [{ role: 'assistant', content: welcomeMessage }];
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

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

      // Add placeholder assistant message
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
              case 'session':
                setSessionKey(event.session_key);
                break;
              case 'text':
                assistantContent += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content = assistantContent;
                  }
                  return [...updated];
                });
                break;
              case 'skill_start': {
                const ss: SkillStep = {
                  name: event.name,
                  description: event.description || `正在执行 ${event.name}`,
                  status: 'running',
                };
                steps.push(ss);
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.steps = [...steps];
                  }
                  return [...updated];
                });
                break;
              }
              case 'skill_end': {
                const idx = steps.findIndex(s => s.name === event.name);
                if (idx >= 0) {
                  steps[idx].status = 'done';
                  steps[idx].result = event.result;
                }
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.steps = [...steps];
                  }
                  return [...updated];
                });
                break;
              }
              case 'tool_start': {
                const tc: ToolCallRecord = {
                  id: event.id,
                  name: event.name,
                  description: event.description || `调用 ${event.name}`,
                  status: 'running',
                };
                toolCalls.push(tc);
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.toolCalls = [...toolCalls];
                  }
                  return [...updated];
                });
                break;
              }
              case 'tool_end': {
                const idx = toolCalls.findIndex(t => t.id === event.id);
                if (idx >= 0) {
                  toolCalls[idx].status = 'done';
                  toolCalls[idx].result = event.result;
                }
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.toolCalls = [...toolCalls];
                  }
                  return [...updated];
                });
                break;
              }
              case 'thinking':
                thinking += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.thinking = thinking;
                  }
                  return [...updated];
                });
                break;
              case 'error':
                setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${event.message}` }]);
                break;
              case 'done':
                break;
            }
          } catch { /* skip malformed events */ }
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleThinking = (idx: number) => {
    setExpandedThinking(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="chat-container">
      {/* Header */}
      {title && (
        <div className="chat-header">
          <RobotOutlined style={{ color: 'var(--primary)' }} />
          {title}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            {/* Thinking (collapsible) */}
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

            {/* Skill steps (reasoning process) */}
            {msg.steps && msg.steps.map((step, si) => (
              <div key={`${step.name}-${si}`} className="skill-step-box">
                <div className="skill-step-header">
                  {step.status === 'running' ? (
                    <span className="skill-step-icon running">⏳</span>
                  ) : (
                    <span className="skill-step-icon done">✅</span>
                  )}
                  <span>{step.description}</span>
                </div>
                {step.result && (
                  <div className="skill-step-result">{step.result}</div>
                )}
              </div>
            ))}

            {/* Tool calls (collapsible) */}
            {msg.toolCalls && msg.toolCalls.map(tc => (
              <div key={tc.id} className="tool-call-box" onClick={() => toggleTool(tc.id)} style={{ marginBottom: 4 }}>
                <div className="tool-call-header">
                  <ToolOutlined style={{ fontSize: 11 }} />
                  {tc.status === 'running' ? '🔧 ' : '✅ '}
                  {tc.description}
                  {expandedTools.has(tc.id) ? <DownOutlined style={{ fontSize: 10, marginLeft: 'auto' }} /> : <RightOutlined style={{ fontSize: 10, marginLeft: 'auto' }} />}
                </div>
                {expandedTools.has(tc.id) && tc.result && (
                  <div className="tool-call-body">{tc.result}</div>
                )}
              </div>
            ))}

            {/* Message bubble */}
            {msg.content && (() => {
              const { cleanContent, charts } = msg.role === 'assistant' ? extractCharts(msg.content) : { cleanContent: msg.content, charts: [] };
              return (
                <>
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          table: ({ children }) => (
                            <div className="chat-table-wrap">
                              <table>{children}</table>
                            </div>
                          ),
                        }}
                      >
                        {cleanContent}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {/* ECharts */}
                  {charts.map((chart) => (
                    <ChartRenderer key={chart.id} config={chart.config} id={chart.id} />
                  ))}
                </>
              );
            })()}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="chat-message assistant">
            <div className="chat-bubble assistant">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div className="quick-actions">
          {quickActions.map((qa, i) => (
            <button
              key={i}
              className="quick-action-btn"
              onClick={() => handleQuickAction(qa.message)}
              disabled={loading}
            >
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
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          <SendOutlined style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  );
}
