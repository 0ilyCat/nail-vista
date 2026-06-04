import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Select, Spin, Button, message, Tag, Space } from 'antd';
import { Link } from 'react-router-dom';
import { EnvironmentOutlined, RightOutlined, ShopOutlined, StarFilled } from '@ant-design/icons';
import { merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Text, Paragraph } = Typography;

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [cityFilter, setCityFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    merchantsAPI.cities().then(r => setCities(r.data || [])).catch(() => {});
    fetchMerchants();
  }, [cityFilter]);

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const res = await merchantsAPI.list({ city: cityFilter || undefined, page_size: 50 });
      setMerchants(res.data?.items || []);
    } catch {
      setMerchants([]);
      message.error('店家加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nv-page">
      <div className="nv-page-heading">
        <div>
          <div className="nv-kicker"><ShopOutlined /> 店家专区</div>
          <Title level={2} style={{ margin: '14px 0 6px' }}>精选美甲店</Title>
          <Text className="nv-muted">挑选店铺、浏览款式、预约可用时段。</Text>
        </div>
        <Select
          allowClear
          placeholder="城市"
          style={{ width: 150 }}
          value={cityFilter || undefined}
          onChange={v => setCityFilter(v || '')}
          options={cities.map((c: any) => ({ label: c.city, value: c.city }))}
        />
      </div>

      {loading ? <Spin size="large" style={{ display: 'block', margin: '100px auto' }} /> : (
        <Row gutter={[18, 18]}>
          {merchants.map(m => {
            const coverImg = (m.images || [])[0];
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                <Card
                  hoverable
                  cover={
                    <div className="nv-image-tile" style={{ aspectRatio: '1 / .74' }}>
                      {coverImg ? (
                        <img src={imgUrl(coverImg)} alt={m.name} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#2f6f68', fontSize: 38 }}>
                          <ShopOutlined />
                        </div>
                      )}
                    </div>
                  }
                >
                  <Link to={`/merchants/${m.id}`}>
                    <div style={{ fontWeight: 780, fontSize: 16, color: '#2f2528', marginBottom: 6 }}>{m.name}</div>
                  </Link>
                  <Space size={6} className="nv-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    <EnvironmentOutlined />
                    <span>{m.city}{m.district ? ` · ${m.district}` : ''}</span>
                  </Space>
                  <Paragraph ellipsis={{ rows: 2 }} className="nv-muted" style={{ minHeight: 44, marginBottom: 10 }}>
                    {m.description || '环境舒适，款式丰富，支持线上预约。'}
                  </Paragraph>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <Tag color="rgba(47,111,104,0.12)" style={{ color: '#17413d', border: 'none', margin: 0 }}>
                      <StarFilled /> {m.rating} · {m.review_count || 0} 评价
                    </Tag>
                    <Link to={`/merchants/${m.id}`}>
                      <Button type="primary" size="small">
                        详情 <RightOutlined />
                      </Button>
                    </Link>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}

