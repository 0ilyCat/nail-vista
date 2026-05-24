import { Card, Statistic, Table, Button, Tag, Spin, message } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, RobotOutlined,
  ReloadOutlined, 
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
        fontSize: 'var(--text-lg)',
        fontWeight: 600,
        marginBottom: 12,
        color: 'var(--text)',
      }}>
        运营看板
      </h1>

      <div className="dashboard-main-layout">
        {/* ── Left panel: compact stats + chart + ranking ── */}
        <div className="dashboard-left-panel">
          {/* Stats row — ultra compact */}
          <div className="dashboard-stats-row">
            <div className="stat-card-compact">
              <Statistic title="款式" value={overview?.total_styles ?? '-'} valueStyle={{ fontSize: 22 }} />
            </div>
            <div className="stat-card-compact">
              <Statistic
                title="今日试戴" value={overview?.today_tryons ?? '-'}
                prefix={(overview?.tryon_change_pct ?? 0) > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ fontSize: 22, color: (overview?.tryon_change_pct ?? 0) >= 0 ? '#3f8600' : '#cf1322' }}
              />
            </div>
            <div className="stat-card-compact">
              <Statistic title="今日营收" value={overview?.today_revenue != null ? `¥${overview.today_revenue}` : '-'} valueStyle={{ fontSize: 22 }} />
            </div>
            <div className="stat-card-compact">
              <Statistic
                title="评分" value={overview?.avg_rating ?? '-'} suffix="⭐"
                valueStyle={{ fontSize: 22 }}
              />
            </div>
          </div>

          {/* Trend chart — compact */}
          <Card
            className="dashboard-trend-card gradient-border-subtle"
            size="small"
            title={<span style={{ fontWeight: 600, fontSize: 13 }}>📈 7 日趋势</span>}
            extra={<Button icon={<ReloadOutlined />} onClick={loadData} size="small" />}
            bodyStyle={{ padding: '8px 12px' }}
          >
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={32} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
                <Line type="monotone" dataKey="tryons" stroke="#c0395c" name="试戴" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="views" stroke="#8884d8" name="浏览" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="orders" stroke="#27ae60" name="订单" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Hot ranking — compact table */}
          <Card
            className="gradient-border-subtle"
            size="small"
            title={<span style={{ fontWeight: 600, fontSize: 13 }}>🔥 热门款式 TOP10</span>}
            bodyStyle={{ padding: 0 }}
          >
            <div className="dashboard-ranking-table">
              <Table
                dataSource={hotStyles}
                rowKey="style_id"
                size="small"
                columns={[
                  { title: '#', dataIndex: 'rank', width: 38,
                    render: (r: number) => (
                      <Tag color={r <= 3 ? 'pink' : 'default'} style={{ borderRadius: 8, minWidth: 22, textAlign: 'center', padding: '0 4px', fontSize: 11, lineHeight: '18px' }}>
                        {r}
                      </Tag>
                    ),
                  },
                  { title: '款式', dataIndex: 'name', width: 90, ellipsis: true,
                    render: (n: string) => <span style={{ fontSize: 12, fontWeight: 500 }}>{n}</span> },
                  { title: '分类', dataIndex: 'category', width: 60,
                    render: (c: string) => <Tag style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>{c}</Tag> },
                  { title: '试戴', dataIndex: 'tryons', width: 52, align: 'right' as const },
                  { title: '订单', dataIndex: 'orders', width: 52, align: 'right' as const,
                    render: (v: number) => v || 0 },
                  { title: '热度', dataIndex: 'hot_score', width: 52, align: 'right' as const,
                    render: (v: number) => <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: 12 }}>{v}</span>,
                  },
                  { title: '变化', dataIndex: 'change_pct', width: 60,
                    render: (v: number) => v > 0
                      ? <Tag color="success" style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>↑{v}%</Tag>
                      : <Tag color="error" style={{ fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>↓{Math.abs(v)}%</Tag>,
                  },
                ]}
                pagination={false}
                locale={{ emptyText: '暂无排行数据' }}
              />
            </div>
          </Card>

          {/* Quick actions */}
          <div className="dashboard-quick-actions">
            {quickActions.map((a) => (
              <Button key={a.label} size="small" style={{ fontSize: 11 }}>{a.label}</Button>
            ))}
          </div>
        </div>

        {/* ── Right panel: full-height AI chat ── */}
        <div className="dashboard-chat-panel">
          <Card
            className="gradient-border-subtle dashboard-chat-card"
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
                <RobotOutlined style={{ color: 'var(--accent)' }} />
                AI 运营助手
              </span>
            }
            bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            <ChatWidget
              agentType="dashboard"
              placeholder="试试「今日概览」或「热门排行」..."
              welcomeMessage="你好！我是 AI 运营助手 📊\n\n可以帮你：\n• 查询运营概览数据\n• 分析趋势变化\n• 生成运营报告\n\n试试问我「今天生意怎么样」？"
              quickActions={quickActions}
            />
          </Card>
        </div>
      </div>
    </Spin>
  );
}
