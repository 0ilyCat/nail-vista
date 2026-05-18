import { Card, Row, Col, Statistic, Table, Input, Button, List, Tag, Spin, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SendOutlined, RobotOutlined, ReloadOutlined } from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getOverview, getTrends, getHotStylesData, chatWithAI, generateReport,
} from '../services/api';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [hotStyles, setHotStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: '你好！我是AI运营助手，可以帮你分析美甲趋势、生成运营策略。试试问我"最近什么款式最火？"' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, tr, hs] = await Promise.all([
        getOverview(), getTrends(7), getHotStylesData(10, 7),
      ]);
      setOverview(ov);
      setTrends(tr);
      setHotStyles(hs);
    } catch (e) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSend = async () => {
    if (!inputValue.trim() || chatLoading) return;
    const userMsg = inputValue;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInputValue('');
    setChatLoading(true);
    try {
      const res = await chatWithAI(userMsg);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'AI助手暂时不可用，请稍后重试。' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      message.loading({ content: '正在生成报告...', key: 'gen' });
      const report = await generateReport('daily');
      message.success({ content: '报告已生成', key: 'gen' });
      setChatMessages(prev => [...prev, { role: 'assistant', content: report.content }]);
    } catch {
      message.error({ content: '生成失败', key: 'gen' });
    }
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="款式总数" value={overview?.total_styles ?? '-'} suffix="款" /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="今日试戴" value={overview?.today_tryons ?? '-'} suffix="次"
              prefix={overview?.tryon_change_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: overview?.tryon_change_pct > 0 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="今日浏览" value={overview?.today_views ?? '-'} suffix="次" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="总计试戴" value={overview?.total_tryons ?? '-'} suffix="次" /></Card>
        </Col>
      </Row>

      <Card
        title="7日趋势"
        extra={<Button icon={<ReloadOutlined />} onClick={loadData} size="small">刷新</Button>}
        style={{ marginBottom: 24 }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览" />
            <Line type="monotone" dataKey="tryons" stroke="#ff69b4" name="试戴" />
            <Line type="monotone" dataKey="favorites" stroke="#82ca9d" name="收藏" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="热门款式排行 (7天)">
            <Table
              dataSource={hotStyles}
              rowKey="style_id"
              columns={[
                { title: '排名', dataIndex: 'rank', width: 60, render: (r: number) => <Tag color={r <= 3 ? 'pink' : 'default'}>{r}</Tag> },
                { title: '款式', dataIndex: 'name' },
                { title: '分类', dataIndex: 'category' },
                { title: '试戴', dataIndex: 'tryons' },
                { title: '热度分', dataIndex: 'hot_score' },
                {
                  title: '趋势', dataIndex: 'change_pct',
                  render: (v: number) => v > 0
                    ? <span style={{ color: 'green' }}>↑{v}%</span>
                    : <span style={{ color: 'red' }}>↓{Math.abs(v)}%</span>,
                },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={<span><RobotOutlined /> AI运营助手</span>}
            extra={<Button size="small" onClick={handleGenerateReport}>生成日报</Button>}
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ height: 350, overflow: 'auto', padding: 16 }}>
              <List
                dataSource={chatMessages}
                renderItem={(msg) => (
                  <div style={{ marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '85%', padding: '8px 14px', borderRadius: 12,
                      background: msg.role === 'user' ? '#ff69b4' : '#f0f0f0',
                      color: msg.role === 'user' ? '#fff' : '#333',
                      fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )}
              />
            </div>
            <div style={{ display: 'flex', padding: 12, borderTop: '1px solid #f0f0f0' }}>
              <Input
                placeholder="问AI运营助手..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onPressEnter={handleSend}
                disabled={chatLoading}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleSend} loading={chatLoading} style={{ marginLeft: 8, background: '#ff69b4' }} />
            </div>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
