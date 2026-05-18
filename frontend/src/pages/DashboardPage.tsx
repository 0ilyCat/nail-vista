import { Card, Row, Col, Statistic, Table, Input, Button, Tag, Spin, message, Typography } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, SendOutlined, RobotOutlined,
  ReloadOutlined, FileTextOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getOverview, getTrends, getHotStylesData, chatWithAI, generateReport, getReports,
} from '../services/api';

const { Paragraph } = Typography;

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [hotStyles, setHotStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; time?: string }[]>([
    { role: 'assistant', content: '你好！我是AI运营助手 🤖\n\n可以帮你：\n• 查看热度排行\n• 分析款式趋势\n• 生成运营日报\n• 制定推广策略\n\n试试问我"最近什么款式最火？"', time: '' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tr, hs] = await Promise.all([
        getOverview(), getTrends(7), getHotStylesData(10, 7),
      ]);
      setOverview(ov);
      setTrends(tr);
      setHotStyles(hs);
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSend = async () => {
    if (!inputValue.trim() || chatLoading) return;
    const userMsg = inputValue.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg, time: new Date().toLocaleTimeString() }]);
    setInputValue('');
    setChatLoading(true);
    try {
      const res = await chatWithAI(userMsg);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.reply, time: new Date().toLocaleTimeString() }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '抱歉，AI助手暂时不可用，请稍后重试。', time: new Date().toLocaleTimeString() }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateReport = async (type: 'daily' | 'trend' | 'strategy') => {
    const labels: Record<string, string> = { daily: '日报', trend: '趋势分析', strategy: '运营策略' };
    const key = `gen-${type}`;
    message.loading({ content: `正在生成${labels[type]}...`, key });
    try {
      const report = await generateReport(type);
      message.success({ content: `${labels[type]}已生成`, key });
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `📊 **${labels[type]}**\n\n${report.content}`,
        time: new Date().toLocaleTimeString(),
      }]);
    } catch {
      message.error({ content: '生成失败', key });
    }
  };

  return (
    <Spin spinning={loading}>
      {/* Stats row */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title="款式总数" value={overview?.total_styles ?? '-'} suffix="款" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bodyStyle={{ padding: '16px 20px' }}>
            <Statistic
              title="今日试戴" value={overview?.today_tryons ?? '-'} suffix="次"
              prefix={overview?.tryon_change_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: (overview?.tryon_change_pct ?? 0) >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title="今日浏览" value={overview?.today_views ?? '-'} suffix="次" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card" bodyStyle={{ padding: '16px 20px' }}>
            <Statistic title="累计试戴" value={overview?.total_tryons ?? '-'} suffix="次" />
          </Card>
        </Col>
      </Row>

      {/* Trend Chart */}
      <Card
        title="📈 7日趋势"
        extra={<Button icon={<ReloadOutlined />} onClick={loadData} size="small">刷新</Button>}
        style={{ marginBottom: 20 }}
      >
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              />
              <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tryons" stroke="#ff69b4" name="试戴" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="favorites" stroke="#82ca9d" name="收藏" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div>
              <div className="skeleton" style={{ width: 400, height: 200 }} />
            </div>
          </div>
        )}
      </Card>

      <Row gutter={16}>
        {/* Hot Ranking Table */}
        <Col xs={24} lg={14}>
          <Card
            title="🔥 热门款式排行 (7天)"
            style={{ marginBottom: 16 }}
          >
            <Table
              dataSource={hotStyles}
              rowKey="style_id"
              columns={[
                {
                  title: '#', dataIndex: 'rank', width: 50,
                  render: (r: number) => (
                    <Tag color={r <= 3 ? 'pink' : 'default'} style={{ borderRadius: 10, minWidth: 28, textAlign: 'center' }}>
                      {r}
                    </Tag>
                  ),
                },
                { title: '款式', dataIndex: 'name', render: (n: string) => <strong>{n}</strong> },
                { title: '分类', dataIndex: 'category', render: (c: string) => <Tag>{c}</Tag> },
                { title: '试戴', dataIndex: 'tryons', sorter: (a: any, b: any) => a.tryons - b.tryons },
                {
                  title: '热度分', dataIndex: 'hot_score',
                  render: (v: number) => <span style={{ fontWeight: 600, color: '#ff69b4' }}>{v}</span>,
                  sorter: (a: any, b: any) => a.hot_score - b.hot_score,
                },
                {
                  title: '变化', dataIndex: 'change_pct', width: 80,
                  render: (v: number) => v > 0
                    ? <Tag color="success">↑{v}%</Tag>
                    : <Tag color="error">↓{Math.abs(v)}%</Tag>,
                },
              ]}
              pagination={false}
              size="middle"
              locale={{ emptyText: '暂无排行数据' }}
            />
          </Card>
        </Col>

        {/* AI Assistant Panel */}
        <Col xs={24} lg={10}>
          <Card
            title={<span><RobotOutlined style={{ marginRight: 8, color: '#ff69b4' }} />AI 运营助手</span>}
            extra={
              <div style={{ display: 'flex', gap: 4 }}>
                <Button size="small" onClick={() => handleGenerateReport('daily')} icon={<FileTextOutlined />}>日报</Button>
                <Button size="small" onClick={() => handleGenerateReport('trend')} icon={<ThunderboltOutlined />}>趋势</Button>
              </div>
            }
            bodyStyle={{ padding: 0 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ flex: 1, height: 380, overflow: 'auto', padding: '12px 16px', background: '#fafafa' }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{
                  marginBottom: 12, display: 'flex', flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '90%', padding: '10px 14px', borderRadius: 12,
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #ff69b4, #ff1493)' : '#fff',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    wordBreak: 'break-word',
                  }}>
                    {msg.content}
                  </div>
                  {msg.time && (
                    <span style={{ fontSize: 10, color: '#ccc', marginTop: 2, padding: '0 4px' }}>{msg.time}</span>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div style={{ padding: 8 }}>
                  <span className="skeleton" style={{ display: 'inline-block', width: 120, height: 14 }} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', padding: 10, borderTop: '1px solid #f0f0f0', background: '#fff' }}>
              <Input
                placeholder="输入问题，如「什么款式最火？」"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={handleSend}
                disabled={chatLoading}
                style={{ borderRadius: 20 }}
              />
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={chatLoading}
                style={{ marginLeft: 8, flexShrink: 0 }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
