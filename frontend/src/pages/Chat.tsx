/**
 * 小美对话 — 小红书AI对话模式
 * 左侧历史对话侧栏（可收起）+ 右侧主区域
 * 新会话时居中大输入框 + 欢迎语 + 变换球 + 预设提问
 * 支持 Markdown 渲染 + 图表提取 + 工具调用展示
 */
import { useEffect, useState, useRef } from 'react';
import { Input, Button, Typography, Spin, message, List, Avatar, Tag, Collapse } from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, ToolOutlined,
  LoadingOutlined, PlusOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, DeleteOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { chatAPI } from '../services/api';
import useChatWS from '../hooks/useChatWS';
import ChartRenderer, { extractCharts, type ChartConfig } from '../components/ChartRenderer';

const { Title, Text } = Typography;

interface ToolCallEntry {
  call_id?: string;
  name: string;
  arguments?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  round?: number;
}

interface ThinkingStep {
  type: 'thinking';
  content: string;
  round: number;
}

const SUGGESTIONS = [
  '推荐适合通勤的美甲款式',
  '我想了解今年流行的美甲风格',
  '如何根据肤色选择美甲颜色',
  '帮我找红色猫眼款式',
];

/* ── 工具名称映射 ── */
const TOOL_LABELS: Record<string, string> = {
  search_nail_styles: '搜索美甲款式',
  get_style_detail: '获取款式详情',
  get_tryon_trends: '试戴趋势',
  get_recommendations: '智能推荐',
};

export default function ChatPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatRef = useRef<HTMLDivElement>(null);

  // WebSocket 流式对话 hook
  const { messages: wsMessages, send, loading, sessionKey, toolCalls, connect, disconnect, clearMessages, setCurrentSessionKey } = useChatWS('user');

  // 合并消息：历史消息 + WS 实时消息
  const allMessages = [...historyMessages, ...wsMessages];

  useEffect(() => {
    loadSessions();
    connect().catch(() => message.warning('AI对话连接失败，请刷新重试'));
    return () => disconnect();
  }, []);

  const loadSessions = () => {
    chatAPI.getSessions('user').then(r => {
      const list = r.data || [];
      setSessions(list);
      if (!activeKey && list.length > 0) setActiveKey(list[0].session_key);
    }).catch(() => {});
  };

  // 加载历史消息
  useEffect(() => {
    if (activeKey) {
      clearMessages();
      setHistoryMessages([]); // 先清空，避免显示旧消息或混杂
      setCurrentSessionKey(activeKey); // 通知 WS 使用该 session_key
      chatAPI.getMessages(activeKey).then(r => {
        const msgs = r.data.messages || [];
        setHistoryMessages(msgs.map((m: any) => ({
          ...m,
          tool_calls: typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls || '[]') : (m.tool_calls || []),
          thinking: typeof m.thinking === 'string' ? JSON.parse(m.thinking || '[]') : (m.thinking || []),
        })));
      }).catch(() => {
        setHistoryMessages([]);
      });
    } else {
      setCurrentSessionKey(null);
      setHistoryMessages([]);
    }
  }, [activeKey]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [allMessages]);

  // 当 sessionKey 变化时（新会话创建），更新 activeKey 并刷新会话列表
  useEffect(() => {
    if (sessionKey) {
      setActiveKey(sessionKey);
      loadSessions();
    }
  }, [sessionKey]);

  const onSend = async () => {
    if (!input.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); return; }

    const msg = input;
    setInput('');
    await send(msg);
  };

  const newChat = () => {
    setActiveKey(null);
    setHistoryMessages([]);
    setInput('');
    clearMessages();
    setCurrentSessionKey(null);
  };

  const deleteSession = async (key: string) => {
    try {
      await chatAPI.deleteSession(key);
      if (activeKey === key) {
        setActiveKey(null);
        setHistoryMessages([]);
      }
      loadSessions();
    } catch { /* ignore */ }
  };

  /* ── 工具调用展示 ── */
  const renderToolCallTrace = (toolCalls: ToolCallEntry[]) => {
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
      <div style={{ marginBottom: 8 }}>
        {toolCalls.map((entry, idx) => {
          const hasResult = entry.result !== undefined;
          const isSuccess = !entry.error && entry.result?.success !== false;
          const label = TOOL_LABELS[entry.name] || entry.name;
          const resultData = entry.result?.data;
          const summary = entry.error ? '异常'
            : resultData ? `${Array.isArray(resultData) ? resultData.length : Object.keys(resultData).length} 条数据`
            : hasResult ? '完成' : '执行中...';

          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', marginBottom: 4,
              background: hasResult ? (isSuccess ? '#f6ffed' : '#fff2f0') : '#f8f8f8',
              borderRadius: 8,
              fontSize: 12,
            }}>
              {hasResult ? (
                <Tag color={isSuccess ? 'success' : 'error'} style={{ margin: 0, fontSize: 11 }}>
                  {isSuccess ? '完成' : '异常'}
                </Tag>
              ) : (
                <LoadingOutlined style={{ color: '#E8708D', fontSize: 12 }} />
              )}
              <ToolOutlined style={{ color: '#E8708D', fontSize: 12 }} />
              <span style={{ color: '#333', fontWeight: 500 }}>{label}</span>
              <span style={{ color: '#999' }}>({summary})</span>
              {hasResult && isSuccess && resultData && (
                <Collapse
                  size="small"
                  ghost
                  style={{ flex: 1 }}
                  items={[{
                    key: 'detail',
                    label: <span style={{ fontSize: 11, color: '#1677ff' }}>详情</span>,
                    children: (
                      <div style={{ fontSize: 11, color: '#666', maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {entry.arguments && <div><strong>参数:</strong> {JSON.stringify(entry.arguments, null, 1)}</div>}
                        <div style={{ marginTop: 4 }}><strong>结果:</strong> {JSON.stringify(entry.result, null, 2)}</div>
                      </div>
                    ),
                  }]}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── 消息内容渲染（Markdown + 图表） ── */
  const renderMessageContent = (content: string) => {
    if (!content) return null;
    const { cleanContent, charts } = extractCharts(content);

    return (
      <>
        <div className="chat-markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {cleanContent}
          </ReactMarkdown>
        </div>
        {charts.map(chart => (
          <ChartRenderer key={chart.id} config={chart.config} id={chart.id} />
        ))}
      </>
    );
  };

  const hasMessages = allMessages.length > 0 || loading;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 128px)', margin: '0 auto', maxWidth: 1200 }}>
      {/* ── 左侧历史对话栏 ── */}
      {sidebarOpen && (
        <div style={{
          width: 240,
          borderRight: '1px solid #F0F0F0',
          background: '#FAFAFA',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width .25s ease',
        }}>
          {/* 新建会话按钮 */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #F0F0F0' }}>
            <Button
              icon={<PlusOutlined />}
              onClick={newChat}
              block
              type="primary"
              style={{ borderRadius: 8 }}
            >
              新建会话
            </Button>
          </div>

          {/* 历史列表 */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            <List
              size="small"
              dataSource={sessions}
              locale={{ emptyText: '' }}
              renderItem={(s: any) => (
                <div
                  onClick={() => setActiveKey(s.session_key)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: 8,
                    padding: '10px 12px',
                    marginBottom: 4,
                    background: s.session_key === activeKey ? '#FDF5F7' : 'transparent',
                    color: s.session_key === activeKey ? '#E8708D' : '#666',
                    fontWeight: s.session_key === activeKey ? 500 : 400,
                    fontSize: 13,
                    transition: 'all .15s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    group: 'session-item',
                  }}
                  onMouseEnter={e => {
                    if (s.session_key !== activeKey) e.currentTarget.style.background = '#f8f8f8';
                  }}
                  onMouseLeave={e => {
                    if (s.session_key !== activeKey) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Text ellipsis style={{ width: '100%', flex: 1 }}>{s.title || '新对话'}</Text>
                  <DeleteOutlined
                    style={{ fontSize: 12, color: '#ccc', marginLeft: 8, flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.session_key); }}
                  />
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* ── 右侧主区域 ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        position: 'relative',
      }}>
        {/* 顶部工具栏 */}
        <div style={{
          height: 52,
          borderBottom: '1px solid #F0F0F0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          flexShrink: 0,
        }}>
          <Button
            type="text"
            icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ color: '#666' }}
          />
          <span style={{ color: '#999', fontSize: 13 }}>
            {!hasMessages ? '' : sessions.find(s => s.session_key === activeKey)?.title || '对话中'}
          </span>
        </div>

        {/* 消息区域 或 居中欢迎区 */}
        <div ref={chatRef} style={{
          flex: 1,
          overflow: 'auto',
          padding: hasMessages ? '20px 32px' : 0,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {!hasMessages ? (
            /* ── 空状态：变换球 + 居中大输入框 + 欢迎 + 光晕背景 ── */
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 24px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* 渐变光晕背景 */}
              <div className="chat-welcome-glow" />

              {/* 变换球 */}
              <div className="chat-page-blob" style={{ marginBottom: 20, position: 'relative', zIndex: 1 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: '#222', marginBottom: 4, position: 'relative', zIndex: 1 }}>小美</div>
              <div style={{ fontSize: 13, color: '#999', marginBottom: 32, textAlign: 'center', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
                AI 时尚顾问<br />帮你发现最适合的美甲
              </div>

              {/* 大输入框 */}
              <div style={{ width: '100%', maxWidth: 680, position: 'relative', zIndex: 1 }}>
                <Input.TextArea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); onSend(); } }}
                  placeholder="搜索或输入任何问题"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  style={{
                    borderRadius: 16,
                    fontSize: 15,
                    resize: 'none',
                    padding: '14px 50px 14px 18px',
                    border: '1.5px solid #eee',
                    transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
                    background: 'rgba(255,255,255,0.85)',
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#E8708D';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,112,141,0.10), 0 0 16px rgba(232,112,141,0.06)';
                    e.currentTarget.style.background = '#fff';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#eee';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.85)';
                  }}
                />
                <Button
                  type="primary"
                  shape="circle"
                  icon={<SendOutlined />}
                  onClick={onSend}
                  disabled={!input.trim() || loading}
                  style={{
                    position: 'absolute',
                    right: 10,
                    bottom: 14,
                    zIndex: 1,
                    width: 36,
                    height: 36,
                  }}
                />
              </div>

              {/* 预设提问 */}
              <div style={{
                display: 'flex',
                gap: 10,
                marginTop: 28,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(''); send(s); }}
                    className="suggestion-pill"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: '1px solid #e8e8e8',
                      background: 'rgba(255,255,255,0.9)',
                      color: '#555',
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all .25s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#FDF5F7';
                      e.currentTarget.style.borderColor = '#E8708D';
                      e.currentTarget.style.color = '#E8708D';
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(232,112,141,0.12)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.9)';
                      e.currentTarget.style.borderColor = '#e8e8e8';
                      e.currentTarget.style.color = '#555';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* 消息列表 */}
              {allMessages.map((m, i) => (
                <div key={i} style={{ marginBottom: 20, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <Avatar
                    icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{
                      backgroundColor: m.role === 'user' ? '#e0e0e0' : '#f0f0f0',
                      flexShrink: 0,
                      color: m.role === 'user' ? '#666' : '#999',
                    }}
                    size={36}
                  />
                  <div style={{ maxWidth: '75%' }}>
                    {/* Thinking steps */}
                    {m.thinking && Array.isArray(m.thinking) && m.thinking.length > 0 && (
                      <Collapse
                        size="small"
                        ghost
                        items={[{
                          key: 'thinking',
                          label: <span style={{ fontSize: 11, color: '#999' }}>💭 思考过程 ({m.thinking.length}步)</span>,
                          children: (
                            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                              {m.thinking.map((step: ThinkingStep, si: number) => (
                                <div key={si} style={{ marginBottom: 4 }}>{step.content}</div>
                              ))}
                            </div>
                          ),
                        }]}
                        style={{ marginBottom: 6, background: '#fafafa', borderRadius: 6 }}
                      />
                    )}

                    {/* Tool call trace */}
                    {m.tool_calls && Array.isArray(m.tool_calls) && renderToolCallTrace(m.tool_calls)}

                    {/* Message content */}
                    <div style={{
                      background: m.role === 'user' ? '#e8e8e8' : '#fff',
                      color: m.role === 'user' ? '#222' : '#333',
                      padding: '10px 16px',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      border: m.role === 'assistant' ? '1px solid #eee' : 'none',
                      fontSize: 14,
                      lineHeight: 1.7,
                      transition: 'box-shadow .2s',
                    }}>
                      {m.role === 'user' ? m.content : renderMessageContent(m.content)}
                    </div>
                  </div>
                </div>
              ))}

              {/* 加载状态 — 思考中动画 */}
              {loading && (
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#f0f0f0', color: '#999' }} size={36} />
                  <div style={{
                    background: '#fff',
                    border: '1px solid #eee',
                    borderRadius: '16px 16px 16px 4px',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: '#E8708D' }} spin />} />
                    <Text style={{ fontSize: 13, color: '#999' }}>小美正在思考中...</Text>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部输入框 + 预设提问（消息模式） */}
        {hasMessages && (
          <div style={{ borderTop: '1px solid #F0F0F0', flexShrink: 0 }}>
            {/* 预设提问 */}
            {!loading && allMessages.length <= 2 && (
              <div style={{
                display: 'flex', gap: 8, padding: '10px 24px 0',
                flexWrap: 'wrap',
              }}>
                {SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(''); send(s); }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 16,
                      border: '1px solid #eee',
                      background: '#fff',
                      color: '#666',
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all .2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FDF5F7'; e.currentTarget.style.borderColor = '#E8708D'; e.currentTarget.style.color = '#E8708D'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#eee'; e.currentTarget.style.color = '#666'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div style={{
              padding: '12px 24px 16px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-end',
            }}>
              <Input.TextArea
                value={input}
                onChange={e => setInput(e.target.value)}
                onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); onSend(); } }}
                placeholder="搜索或输入任何问题"
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ borderRadius: 12, fontSize: 14, resize: 'none', borderColor: '#eee' }}
                disabled={loading}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={onSend}
                loading={loading}
                style={{ borderRadius: 10, height: 40, paddingInline: 18 }}
              >
                发送
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
