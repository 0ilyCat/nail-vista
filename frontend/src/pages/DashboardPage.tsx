import { Card, Row, Col, Statistic, Table, Input, Button, List, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, SendOutlined, RobotOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trendData = Array.from({ length: 7 }, (_, i) => ({
  day: `Day ${i + 1}`,
  tryons: Math.floor(Math.random() * 200 + 50),
  views: Math.floor(Math.random() * 500 + 200),
  favorites: Math.floor(Math.random() * 50 + 10),
}));

const topStyles = Array.from({ length: 10 }, (_, i) => ({
  key: i + 1,
  rank: i + 1,
  name: ['星空渐变', '法式简约', '樱花粉', '闪钻奢华', '裸色优雅', '经典红', '莫兰迪绿', '雾霾蓝', '焦糖棕', '玫瑰金'][i],
  hotScore: Math.floor(Math.random() * 100),
  trend: Math.random() > 0.5 ? 'up' : 'down',
  change: Math.floor(Math.random() * 20),
}));

export default function DashboardPage() {
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: '你好！我是AI运营助手，可以帮你分析美甲趋势、生成运营策略。试试问我"最近什么款式最火？"' },
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setChatMessages(prev => [...prev, { role: 'user', content: inputValue }]);
    // Mock AI reply
    setTimeout(() => {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `根据数据分析，"${['星空渐变', '法式简约', '樱花粉'][Math.floor(Math.random() * 3)]}" 是近期上升最快的款式，建议增加曝光位。`
      }]);
    }, 1000);
    setInputValue('');
  };

  return (
    <div>
      {/* 核心指标 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}><Card><Statistic title="款式总数" value={25} suffix="款" /></Card></Col>
        <Col span={6}><Card><Statistic title="今日试戴" value={1280} prefix={<ArrowUpOutlined />} suffix="次" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="今日浏览" value={5680} prefix={<ArrowUpOutlined />} suffix="次" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="转化率" value={22.5} prefix={<ArrowDownOutlined />} suffix="%" precision={1} valueStyle={{ color: '#cf1322' }} /></Card></Col>
      </Row>

      {/* 趋势图 */}
      <Card title="7日趋势" style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览" />
            <Line type="monotone" dataKey="tryons" stroke="#ff69b4" name="试戴" />
            <Line type="monotone" dataKey="favorites" stroke="#82ca9d" name="收藏" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Row gutter={16}>
        {/* 热度排行 */}
        <Col span={14}>
          <Card title="热门款式排行">
            <Table
              dataSource={topStyles}
              columns={[
                { title: '排名', dataIndex: 'rank', width: 60, render: (r: number) => <Tag color={r <= 3 ? 'pink' : 'default'}>{r}</Tag> },
                { title: '款式', dataIndex: 'name' },
                { title: '热度分', dataIndex: 'hotScore', sorter: (a: any, b: any) => a.hotScore - b.hotScore },
                {
                  title: '趋势', dataIndex: 'trend',
                  render: (t: string, r: any) => t === 'up' ? <span style={{ color: 'green' }}>↑{r.change}%</span> : <span style={{ color: 'red' }}>↓{r.change}%</span>
                },
              ]}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* AI对话面板 */}
        <Col span={10}>
          <Card
            title={<span><RobotOutlined /> AI运营助手</span>}
            bodyStyle={{ padding: 0 }}
          >
            <div style={{ height: 350, overflow: 'auto', padding: 16 }}>
              <List
                dataSource={chatMessages}
                renderItem={(msg) => (
                  <div style={{
                    marginBottom: 12, textAlign: msg.role === 'user' ? 'right' : 'left',
                  }}>
                    <div style={{
                      display: 'inline-block', maxWidth: '80%', padding: '8px 16px', borderRadius: 12,
                      background: msg.role === 'user' ? '#ff69b4' : '#f0f0f0',
                      color: msg.role === 'user' ? '#fff' : '#333',
                      fontSize: 13, lineHeight: 1.6,
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
                style={{ flex: 1 }}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleSend} style={{ marginLeft: 8, background: '#ff69b4' }} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
