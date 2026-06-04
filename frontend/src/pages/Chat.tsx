import { useEffect, useState, useRef } from 'react';
import { Card, Input, Button, Typography, Spin, message, List, Avatar } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import { chatAPI } from '../services/api';

const { Title, Text } = Typography;

export default function ChatPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatAPI.getSessions().then(r => {
      setSessions(r.data || []);
      if (r.data?.length > 0) setActiveKey(r.data[0].session_key);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeKey) {
      chatAPI.getMessages(activeKey).then(r => setMessages(r.data.messages || [])).catch(() => {});
    }
  }, [activeKey]);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [messages]);

  const onSend = async () => {
    if (!input.trim()) return;
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); return; }

    const msg = input;
    setInput('');
    setMessages([...messages, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await chatAPI.send({ message: msg, session_key: activeKey || undefined });
      const reply = res.data.message;
      setMessages(prev => [...prev, { role: 'assistant', content: reply.content, thinking: reply.thinking }]);
      if (!activeKey) {
        setActiveKey(res.data.session_key);
        chatAPI.getSessions().then(r => setSessions(r.data || [])).catch(() => {});
      }
    } catch (e: any) { message.error('对话失败'); }
    finally { setLoading(false); }
  };

  const newChat = () => { setActiveKey(null); setMessages([]); setInput(''); };

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#8b5e6b' }}>💬 小美对话</Title>
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Sessions sidebar */}
        <Card size="small" style={{ width: 200 }} title="历史对话" extra={<Button size="small" type="primary" onClick={newChat}>新对话</Button>}>
          <List size="small" dataSource={sessions} renderItem={(s: any) => (
            <List.Item style={{ cursor: 'pointer', background: s.session_key === activeKey ? '#fdf2f4' : 'transparent' }}
              onClick={() => setActiveKey(s.session_key)}>
              <Text ellipsis>{s.title}</Text>
            </List.Item>
          )} />
        </Card>

        {/* Chat area */}
        <Card style={{ flex: 1 }} bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
          <div ref={chatRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 16, display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <Avatar icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{ backgroundColor: m.role === 'user' ? '#c77986' : '#8b5e6b' }} />
                <div style={{
                  background: m.role === 'user' ? '#c77986' : '#f5f5f5',
                  color: m.role === 'user' ? '#fff' : '#333',
                  padding: '8px 16px', borderRadius: 12, maxWidth: '70%', whiteSpace: 'pre-wrap',
                }}>
                  {m.thinking && <div style={{ fontSize: 11, color: '#999', borderBottom: '1px dashed #ddd', marginBottom: 4 }}>💭 {m.thinking}</div>}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <Spin size="small" style={{ marginLeft: 48 }} />}
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0d6dc', display: 'flex', gap: 8 }}>
            <Input.TextArea value={input} onChange={e => setInput(e.target.value)} onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="告诉我你想要的美甲风格..." rows={2} autoSize />
            <Button type="primary" icon={<SendOutlined />} onClick={onSend} loading={loading}>发送</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
