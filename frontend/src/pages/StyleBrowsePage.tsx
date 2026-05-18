import { Card, Row, Col, Tag, Input, Select } from 'antd';
import { HeartOutlined, EyeOutlined, ExperimentOutlined } from '@ant-design/icons';

const MOCK_STYLES = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  name: [`法式简约${i + 1}`, '星空渐变', '樱花粉', '经典红', '裸色优雅', '闪钻奢华', '莫兰迪绿', '雾霾蓝', '焦糖棕', '玫瑰金'][i % 10],
  category: ['纯色', '渐变', '法式', '闪粉', '手绘'][i % 5],
  color: ['#ffe4e1', '#6a5acd', '#ffb7c5', '#dc143c', '#deb887', '#ffd700', '#98fb98', '#87ceeb', '#d2691e', '#e8b4b8'][i % 10],
  views: Math.floor(Math.random() * 1000),
  tryons: Math.floor(Math.random() * 500),
  favorites: Math.floor(Math.random() * 200),
}));

export default function StyleBrowsePage() {
  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Input.Search placeholder="搜索美甲款式..." style={{ maxWidth: 300 }} />
        <Select placeholder="分类筛选" style={{ width: 120 }} options={[
          { label: '全部', value: '' }, { label: '纯色', value: '纯色' },
          { label: '渐变', value: '渐变' }, { label: '法式', value: '法式' },
          { label: '闪粉', value: '闪粉' }, { label: '手绘', value: '手绘' },
        ]} />
      </div>
      <Row gutter={[16, 16]}>
        {MOCK_STYLES.map(style => (
          <Col key={style.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              cover={
                <div style={{
                  height: 160, background: `linear-gradient(135deg, ${style.color}, ${style.color}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 48
                }}>
                  💅
                </div>
              }
              actions={[
                <EyeOutlined key="view" />,
                <ExperimentOutlined key="try" />,
                <HeartOutlined key="fav" />,
              ]}
            >
              <Card.Meta
                title={style.name}
                description={
                  <div>
                    <Tag color="pink">{style.category}</Tag>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      👁 {style.views} · 🎨 {style.tryons} · ❤️ {style.favorites}
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
