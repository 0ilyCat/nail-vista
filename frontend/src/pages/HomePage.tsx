import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Button, Spin, Tag } from 'antd';
import {
  ExperimentOutlined, AppstoreOutlined, DashboardOutlined,
  ThunderboltOutlined, RobotOutlined, BarChartOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { getOverview, getHotRanking } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);
  const [topStyles, setTopStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOverview(),
      getHotRanking(5, 7),
    ]).then(([ov, ranking]) => {
      setOverview(ov);
      setTopStyles(ranking);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <p style={{ marginTop: 16, color: '#999' }}>加载中...</p>
      </div>
    );
  }

  const features = [
    {
      title: 'AI 虚拟试戴',
      desc: '上传手部照片，秒级生成美甲试戴效果。MediaPipe 精确手部关键点检测 + OpenCV 透视变换。',
      icon: <ExperimentOutlined style={{ fontSize: 40, color: '#ff69b4' }} />,
      action: () => navigate('/tryon'),
      color: '#fff0f6',
    },
    {
      title: '款式智能浏览',
      desc: '25款精选美甲，支持按风格/颜色/热度筛选。每款都有原始图 + AI增强图。',
      icon: <AppstoreOutlined style={{ fontSize: 40, color: '#722ed1' }} />,
      action: () => navigate('/styles'),
      color: '#f9f0ff',
    },
    {
      title: '智能运营看板',
      desc: '实时热度排行、7日趋势分析、AI运营助手。LongCat大模型驱动日报/策略生成。',
      icon: <DashboardOutlined style={{ fontSize: 40, color: '#1890ff' }} />,
      action: () => navigate('/dashboard'),
      color: '#e6f7ff',
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <div style={{
        textAlign: 'center', padding: '48px 24px', marginBottom: 24,
        background: 'linear-gradient(135deg, #fff0f6 0%, #f9f0ff 50%, #e6f7ff 100%)',
        borderRadius: 12,
      }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 12, color: '#333' }}>
          💅 美甲AI试戴与智能运营
        </h1>
        <p style={{ fontSize: 16, color: '#666', maxWidth: 600, margin: '0 auto 24px', lineHeight: 1.8 }}>
          基于 MediaPipe + OpenCV 的虚拟试戴引擎，结合 LongCat 大模型的智能运营分析。
          让用户「所见即所得」，让运营「实时感知趋势」。
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Tag color="pink" style={{ fontSize: 13, padding: '4px 12px' }}>MediaPipe 手部检测</Tag>
          <Tag color="purple" style={{ fontSize: 13, padding: '4px 12px' }}>OpenCV 图像合成</Tag>
          <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>LongCat-2.0-Preview</Tag>
          <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>FastAPI 后端</Tag>
          <Tag color="orange" style={{ fontSize: 13, padding: '4px 12px' }}>React 19 前端</Tag>
        </div>
      </div>

      {/* Quick Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="款式总数"
              value={overview?.total_styles || 25}
              suffix="款"
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="累计试戴"
              value={overview?.total_tryons || 0}
              suffix="次"
              prefix={<ExperimentOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="今日浏览"
              value={overview?.today_views || 0}
              suffix="次"
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="stat-card">
            <Statistic
              title="AI引擎"
              value="LongCat"
              suffix="V2.5"
              prefix={<RobotOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Features */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {features.map((f, i) => (
          <Col key={i} xs={24} md={8}>
            <Card
              hoverable
              onClick={f.action}
              style={{ height: '100%', cursor: 'pointer', textAlign: 'center' }}
              bodyStyle={{ padding: '32px 24px' }}
            >
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: f.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 18, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ color: '#666', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{f.desc}</p>
              <Button type="link" icon={<RightOutlined />} style={{ color: '#ff69b4' }}>
                立即体验
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Hot Ranking Preview */}
      {topStyles.length > 0 && (
        <Card
          title="🔥 本周热门 TOP5"
          extra={<Button type="link" onClick={() => navigate('/dashboard')}>查看完整看板 →</Button>}
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {topStyles.map((s, i) => (
              <div
                key={s.style_id}
                style={{
                  flex: 1, minWidth: 150, padding: 16, background: '#fafafa',
                  borderRadius: 8, textAlign: 'center',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: i < 3 ? 'linear-gradient(135deg, #ff69b4, #ff1493)' : '#ddd',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 8px', fontWeight: 'bold', fontSize: 16,
                }}>
                  {s.rank}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {s.category} · 热度 {s.hot_score}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
