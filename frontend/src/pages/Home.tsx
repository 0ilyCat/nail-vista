import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Spin, Space } from 'antd';
import { Link } from 'react-router-dom';
import {
  ArrowRightOutlined, CameraOutlined, CompassOutlined, ShopOutlined,
  StarFilled,
} from '@ant-design/icons';
import { stylesAPI, merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Paragraph, Text } = Typography;

export default function HomePage() {
  const [hotStyles, setHotStyles] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      stylesAPI.hotRanking(12).catch(() => ({ data: [] })),
      merchantsAPI.list({ page_size: 6 }).catch(() => ({ data: { items: [] } })),
    ]).then(([sRes, mRes]) => {
      setHotStyles(Array.isArray(sRes.data) ? sRes.data : []);
      setMerchants(mRes.data?.items || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  const heroStyle = hotStyles[0];
  const heroImage = heroStyle?.image_url ? imgUrl(heroStyle.image_url) : '';
  const categories = ['通勤短甲', '猫眼光感', '裸色法式', '手绘花朵', '果冻渐变', '婚礼贴钻', '秋冬酒红'];

  return (
    <div className="nv-page">
      <section className="nv-hero">
        <div className="nv-hero-copy">
          <div className="nv-kicker">
            <CameraOutlined />
            AI 试戴 · 灵感社区 · 店家预约
          </div>
          <h1>先看见上手效果，再决定今天做哪款美甲</h1>
          <p>
            从热门款式、真实晒图到附近店家预约，NailVista 把选款、试戴和下单放进一个顺滑流程里。
          </p>

          <div className="nv-hero-actions">
            <Link to="/tryon">
              <Button type="primary" size="large" icon={<CameraOutlined />}>
                立即试戴
              </Button>
            </Link>
            <Link to="/community">
              <Button size="large" icon={<CompassOutlined />}>
                逛灵感广场
              </Button>
            </Link>
          </div>

          <div className="nv-hero-tags">
            {['猫眼', '通勤', '裸色', '极简', '手绘', '渐变'].map(t => (
              <Link key={t} to={`/community?search=${encodeURIComponent(t)}`}>
                <Tag>{t}</Tag>
              </Link>
            ))}
          </div>

          <div className="nv-stat-row">
            <div className="nv-stat"><strong>{hotStyles.length || 12}+</strong><span>热门灵感</span></div>
            <div className="nv-stat"><strong>{merchants.length || 3}</strong><span>精选店家</span></div>
            <div className="nv-stat"><strong>AI</strong><span>即时试戴</span></div>
          </div>
        </div>

        <div className="nv-hero-visual">
          {heroImage ? (
            <img src={heroImage} alt={heroStyle?.name || '热门美甲款式'} />
          ) : (
            <div style={{ minHeight: 380, display: 'grid', placeItems: 'center', color: 'var(--nv-primary)', fontWeight: 700 }}>
              NailVista
            </div>
          )}
          <div className="nv-hero-overlay">
            <Text style={{ color: 'rgba(255,255,255,0.78)' }}>今日热门</Text>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800 }}>{heroStyle?.name || 'AI 美甲试戴'}</div>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.82)' }}>
              {heroStyle?.price ? `参考价 ${heroStyle.price}` : '上传手图，预览真实效果'}
            </div>
          </div>
        </div>
      </section>

      <section className="nv-feed-band">
        <div className="nv-page-heading" style={{ marginBottom: 12 }}>
          <div>
            <Title level={3} className="nv-section-title">发现频道</Title>
            <Text className="nv-muted">像刷灵感一样选款，先收藏再试戴</Text>
          </div>
          <Link to="/tryon">
            <Button>上传手图试试看</Button>
          </Link>
        </div>
        <div className="nv-category-strip">
          {categories.map(t => (
            <Link key={t} to={`/community?search=${encodeURIComponent(t)}`}>
              {t}
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 10 }}>
        <div className="nv-page-heading">
          <div>
            <Title level={2} className="nv-section-title">今日热门灵感</Title>
            <Text className="nv-muted">按试戴热度和收藏趋势更新</Text>
          </div>
          <Link to="/community">
            <Button type="link">查看更多 <ArrowRightOutlined /></Button>
          </Link>
        </div>

        <Row gutter={[18, 18]}>
          {hotStyles.map(s => (
            <Col xs={12} sm={8} md={6} lg={4} key={s.id}>
              <Link to={`/styles/${s.id}`}>
                <Card hoverable cover={
                  <div className="nv-image-tile">
                    <img src={imgUrl(s.image_url)} alt={s.name} />
                  </div>
                }>
                  <Card.Meta
                    title={<span style={{ fontSize: 14 }}>{s.name}</span>}
                    description={<span className="nv-price">{s.price ? `¥${s.price}` : '查看详情'}</span>}
                  />
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </section>

      <section style={{ marginTop: 48 }}>
        <div className="nv-page-heading">
          <div>
            <Title level={2} className="nv-section-title">推荐店家</Title>
            <Text className="nv-muted">看环境、挑款式、约时段，一次完成</Text>
          </div>
          <Link to="/merchants">
            <Button type="link">全部店家 <ArrowRightOutlined /></Button>
          </Link>
        </div>

        <Row gutter={[18, 18]}>
          {merchants.map(m => {
            const coverImg = (m.images || [])[0];
            return (
              <Col xs={24} sm={12} md={8} key={m.id}>
                <Link to={`/merchants/${m.id}`}>
                  <Card hoverable>
                    <Space align="start" size={14}>
                      <div style={{
                        width: 92, height: 92, borderRadius: 8, overflow: 'hidden',
                        background: 'rgba(47,111,104,0.10)', flexShrink: 0,
                      }}>
                        {coverImg ? (
                          <img src={imgUrl(coverImg)} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--nv-primary)' }}>
                            <ShopOutlined />
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 780, fontSize: 16, marginBottom: 6 }}>{m.name}</div>
                        <div className="nv-muted" style={{ marginBottom: 8 }}>{m.city}{m.district ? ` · ${m.district}` : ''}</div>
                        <div className="nv-price"><StarFilled /> {m.rating} · {m.review_count || 0} 条评价</div>
                      </div>
                    </Space>
                  </Card>
                </Link>
              </Col>
            );
          })}
        </Row>
      </section>
    </div>
  );
}

