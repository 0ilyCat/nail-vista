import { Card, Row, Col, Statistic, Table, Button, Tag, Spin, message } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, RobotOutlined,
  ReloadOutlined, FileTextOutlined, ThunderboltOutlined,
  FireOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getOverview, getTrends, getHotStylesData } from '../services/api';
import ChatWidget from '../components/chat/ChatWidget';

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [hotStyles, setHotStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const quickActions = [
    { label: '📊 今日概览', message: '查询今天的运营概览数据' },
    { label: '🔥 热门排行', message: '展示最近7天的热门款式排行' },
    { label: '📈 趋势分析', message: '分析最近7天的数据趋势' },
    { label: '📝 生成日报', message: '生成今天的运营日报' },
  ];

  return (
    <Spin spinning={loading}>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xl)',
        fontWeight: 600,
        marginBottom: 'var(--space-lg)',
        color: 'var(--text)',
      }}>
        运营看板
      </h1>

      {/* Stats row — with gradient top accent */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="stat-card-gradient" style={{ background: 'var(--surface)', padding: '16px 20px' }}>
            <Statistic title="款式总数" value={overview?.total_styles ?? '-'} suffix="款" />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card-gradient" style={{ background: 'var(--surface)', padding: '16px 20px' }}>
            <Statistic
              title="今日试戴" value={overview?.today_tryons ?? '-'} suffix="次"
              prefix={overview?.tryon_change_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: (overview?.tryon_change_pct ?? 0) >= 0 ? '#3f8600' : '#cf1322' }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card-gradient" style={{ background: 'var(--surface)', padding: '16px 20px' }}>
            <Statistic title="今日浏览" value={overview?.today_views ?? '-'} suffix="次" />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="stat-card-gradient" style={{ background: 'var(--surface)', padding: '16px 20px' }}>
            <Statistic title="累计试戴" value={overview?.total_tryons ?? '-'} suffix="次" />
          </div>
        </Col>
      </Row>

      {/* Trend Chart — compact */}
      <Card
        className="dashboard-trend-card gradient-border-subtle"
        title={<span style={{ fontWeight: 600 }}>📈 7 日趋势</span>}
        extra={<Button icon={<ReloadOutlined />} onClick={loadData} size="small">刷新</Button>}
      >
        {trends.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tryons" stroke="#c0395c" name="试戴" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="favorites" stroke="#82ca9d" name="收藏" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="skeleton" style={{ width: 400, height: 160 }} />
          </div>
        )}
      </Card>

      {/* Lower section: Ranking + Chat side by side */}
      <div className="dashboard-lower-row">
        {/* Hot Ranking Table */}
        <div className="ranking-col">
          <Card
            className="gradient-border-subtle"
            title={<span style={{ fontWeight: 600 }}>🔥 热门款式排行 (7天)</span>}
          >
            <div className="dashboard-ranking-table">
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
                    render: (v: number) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{v}</span>,
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
            </div>
          </Card>
        </div>

        {/* AI Operations Assistant */}
        <div className="chat-col">
          <Card
            className="gradient-border-subtle"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                <RobotOutlined style={{ color: 'var(--accent)' }} />
                AI 运营助手
              </span>
            }
            bodyStyle={{ padding: 0 }}
          >
            <ChatWidget
              agentType="dashboard"
              placeholder="试试「今日概览」或「热门排行」..."
              welcomeMessage="你好！我是 AI 运营助手 📊\n\n可以帮你：\n• 查询运营概览数据\n• 分析趋势变化\n• 生成运营报告\n• 配置定时任务\n\n试试问我「今天的数据怎么样？」"
              quickActions={quickActions}
            />
          </Card>
        </div>
      </div>
    </Spin>
  );
}
