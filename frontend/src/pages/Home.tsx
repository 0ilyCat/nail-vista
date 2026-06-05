import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Button, Tag, Spin } from 'antd';
import { Link } from 'react-router-dom';
import { stylesAPI, merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Paragraph } = Typography;

export default function HomePage() {
  const [hotStyles, setHotStyles] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      stylesAPI.hotRanking(12).catch(() => ({ data: [] })),
      merchantsAPI.list({ page_size: 6 }).catch(() => ({ data: { items: [] } })),
    ]).then(([sRes, mRes]) => {
      const styles = Array.isArray(sRes.data) ? sRes.data : [];
      setHotStyles(styles);
      setMerchants(mRes.data?.items || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
        <Title level={1} style={{ color: '#222', fontSize: 36 }}>
          AI 美甲灵感引擎：从想法到指尖，一步到位
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          一句话/一张图，生成专属美甲方案，一键预约到店
        </Paragraph>
        <div style={{ marginTop: 24 }}>
          <Link to="/tryon"><Button type="primary" size="large" style={{ marginRight: 12 }}>立即体验 AI 试戴</Button></Link>
          <Link to="/community"><Button size="large">先逛逛灵感社区</Button></Link>
        </div>
        <div style={{ marginTop: 24 }}>
          <span style={{ color: '#999' }}>热门风格：</span>
          {['猫眼','通勤','裸色','极简','手绘','彩绘'].map(t => (
            <Link key={t} to={`/community?search=${t}`}><Tag style={{ marginLeft: 8, border: '1.5px solid #E8708D', color: '#E8708D', background: 'transparent', borderRadius: 14 }}>{t}</Tag></Link>
          ))}
        </div>
      </div>

      {/* Hot Styles */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Title level={2} style={{ color: '#222' }}>今日热门灵感</Title>
        <Row gutter={[16, 16]}>
          {hotStyles.map(s => (
            <Col xs={12} sm={8} md={6} lg={4} key={s.id}>
              <Link to={`/styles/${s.id}`}>
                <Card hoverable cover={
                  <div style={{ height: 200, overflow: 'hidden' }}>
                    <img src={imgUrl(s.image_url)} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                }>
                  <Card.Meta
                    title={<span style={{ fontSize: 13 }}>{s.name}</span>}
                    description={<span style={{ color: '#E8708D', fontWeight: 600 }}>¥{s.price}</span>}
                  />
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>

      {/* Nearby Merchants */}
      <div style={{ maxWidth: 1200, margin: '40px auto' }}>
        <Title level={2} style={{ color: '#222' }}>推荐店家</Title>
        <Row gutter={[16, 16]}>
          {merchants.map(m => (
            <Col xs={24} sm={12} md={8} key={m.id}>
              <Card hoverable>
                <Row align="middle" gutter={16}>
                  <Col>
                    {m.images && m.images.length > 0 ? (
                      <img src={imgUrl(m.images[0])} alt={m.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }} />
                    ) : m.logo_url ? (
                      <img src={imgUrl(m.logo_url)} alt={m.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#ccc' }}>
                        店
                      </div>
                    )}
                  </Col>
                  <Col flex={1}>
                    <Link to={`/merchants/${m.id}`}><strong>{m.name}</strong></Link>
                    <div>{m.city} · 评分 {m.rating}</div>
                    <div style={{ marginTop: 8 }}>
                      <Link to={`/merchants/${m.id}`}><Button size="small" type="primary">预约/咨询</Button></Link>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
