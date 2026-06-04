import { useEffect, useState, useRef } from 'react';
import { Card, Input, Button, Typography, Spin, message, List, Avatar, Tag, Collapse } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ToolOutlined, LoadingOutlined } from '@ant-design/icons';
import { chatAPI } from '../services/api';

const { Title, Text, Paragraph } = Typography;

interface ToolCallEntry {
  type: 'tool_call' | 'tool_result';
  name: string;
  arguments?: Record<string, any>;
  result?: Record<string, any>;
  round: number;
}

interface ThinkingStep {
  type: 'thinking';
  content: string;
  round: number;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    chatAPI.getSessions().then(r => {
      setSessions(r.data || []);
      if (!activeKey && r.data?.length > 0) setActiveKey(r.data[0].session_key);
    }).catch(() => {});
  };

  useEffect(() => {
    if (activeKey) {
      chatAPI.getMessages(activeKey).then(r => {
        const msgs = r.data.messages || [];
        setMessages(msgs.map((m: any) => ({
          ...m,
          tool_calls: typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls || '[]') : (m.tool_calls || []),
          thinking: typeof m.thinking === 'string' ? JSON.parse(m.thinking || '[]') : (m.thinking || []),
        })));
      }).catch(() => {});
    }
  }, [activeKey]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const onSend = async () => {
    if (!input.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); return; }

    const msg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await chatAPI.send({ message: msg, session_key: activeKey || undefined });
      const reply = res.data.message;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: reply.content,
        thinking: reply.thinking || [],
        tool_calls: reply.tool_calls || [],
      }]);
      if (!activeKey) setActiveKey(res.data.session_key);
      loadSessions();
    } catch (e: any) { message.error('对话失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const newChat = () => { setActiveKey(null); setMessages([]); setInput(''); };

  const renderToolCallTrace = (toolCalls: ToolCallEntry[]) => {
    if (!toolCalls || toolCalls.length === 0) return null;

    // Group by round
    const rounds: Record<number, ToolCallEntry[]> = {};
    toolCalls.forEach(tc => {
      if (!rounds[tc.round]) rounds[tc.round] = [];
      rounds[tc.round].push(tc);
    });

    return (
      <div style={{ marginBottom: 8 }}>
        {Object.entries(rounds).map(([round, entries]) => (
          <div key={round} style={{ marginBottom: 6 }}>
            <Tag color="processing" style={{ marginBottom: 4, fontSize: 11 }}>
              <ToolOutlined /> 第{round}轮思考
            </Tag>
            {entries.map((entry, idx) => {
              if (entry.type === 'tool_call') {
                return (
                  <Collapse
                    key={idx}
                    size="small"
                    ghost
                    items={[{
                      key: 'call',
                      label: (
                        <span style={{ fontSize: 12, color: '#1677ff' }}>
                          🔧 调用: {entry.name}
                        </span>
                      ),
                      children: (
                        <div style={{ fontSize: 11, color: '#666', maxHeight: 200, overflow: 'auto' }}>
                          <div><strong>参数:</strong> {JSON.stringify(entry.arguments, null, 1)}</div>
                        </div>
                      ),
                    }]}
                    style={{ marginBottom: 2, background: '#f6f8fa', borderRadius: 4 }}
                  />
                );
              } else if (entry.type === 'tool_result') {
                const isSuccess = entry.result?.success !== false;
                const summary = entry.result?.data
                  ? `${Object.keys(entry.result.data).length} 条数据`
                  : '无数据';
                return (
                  <Collapse
                    key={idx}
                    size="small"
                    ghost
                    items={[{
                      key: 'result',
                      label: (
                        <span style={{ fontSize: 12, color: isSuccess ? '#52c41a' : '#ff4d4f' }}>
                          {isSuccess ? '✅' : '❌'} 结果: {entry.name} ({summary})
                        </span>
                      ),
                      children: (
                        <div style={{ fontSize: 11, color: '#666', maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(entry.result, null, 2)}
                        </div>
                      ),
                    }]}
                    style={{ marginBottom: 2, background: isSuccess ? '#f6ffed' : '#fff2f0', borderRadius: 4 }}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#7d9d7a' }}>💬 小美对话</Title>
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Sessions sidebar */}
        <Card
          size="small"
          style={{ width: 200, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          title={<span style={{ fontSize: 14, fontWeight: 600 }}>历史对话</span>}
          extra={<Button size="small" type="primary" onClick={newChat} style={{ borderRadius: 6 }}>新对话</Button>}
        >
          <List
            size="small"
            dataSource={sessions}
            locale={{ emptyText: '暂无对话' }}
            renderItem={(s: any) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  background: s.session_key === activeKey ? '#eef5eb' : 'transparent',
                  borderRadius: 6,
                  padding: '6px 8px',
                  transition: 'background .15s',
                }}
                onClick={() => setActiveKey(s.session_key)}
              >
                <Text ellipsis style={{ fontSize: 13 }}>{s.title}</Text>
              </List.Item>
            )}
          />
        </Card>

        {/* Chat area */}
        <Card
          style={{ flex: 1, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}
          styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%', padding: 0 } }}
        >
          <div ref={chatRef} style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', marginTop: 80, color: '#bbb' }}>
                <RobotOutlined style={{ fontSize: 48, marginBottom: 12 }} />
                <div>你好，我是小美！告诉我你想要的美甲风格吧～</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 20, display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <Avatar
                  icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{
                    backgroundColor: m.role === 'user' ? '#7d9d7a' : '#5a7a5a',
                    flexShrink: 0,
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
                        label: <span style={{ fontSize: 11, color: '#999' }}>💭 思考过程</span>,
                        children: (
                          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5 }}>
                            {m.thinking.map((step: ThinkingStep, si: number) => (
                              <div key={si} style={{ marginBottom: 4 }}>
                                {step.content}
                              </div>
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
                    background: m.role === 'user' ? '#7d9d7a' : '#f5f5f5',
                    color: m.role === 'user' ? '#fff' : '#333',
                    padding: '10px 16px',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#5a7a5a' }} size={36} />
                <Spin indicator={<LoadingOutlined style={{ fontSize: 18 }} spin />} />
                <Text style={{ fontSize: 12, color: '#999' }}>小美正在思考...</Text>
              </div>
            )}
          </div>

          {/* Input area */}
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
          }}>
            <Input.TextArea
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="告诉我你想要的美甲风格，或者描述你的需求..."
              autoSize={{ minRows: 2, maxRows: 5 }}
              style={{ borderRadius: 12, fontSize: 14, resize: 'none' }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={onSend}
              loading={loading}
              style={{ borderRadius: 10, height: 44, paddingInline: 20 }}
            >
              发送
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
