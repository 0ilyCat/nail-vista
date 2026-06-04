import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Select, Spin, Button, message, Image } from 'antd';
import { Link } from 'react-router-dom';
import { StarOutlined } from '@ant-design/icons';
import { merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title } = Typography;

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
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#8b5e6b' }}>店家专区</Title>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select allowClear placeholder="城市" style={{ width: 120 }} value={cityFilter || undefined}
          onChange={v => setCityFilter(v || '')} options={cities.map((c: any) => ({ label: c.city, value: c.city }))} />
      </div>
      {loading ? <Spin size="large" style={{ display: 'block', margin: '100px auto' }} /> : (
        <Row gutter={[16, 16]}>
          {merchants.map(m => {
            const coverImg = (m.images || [])[0];
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                <Card
                  hoverable
                  cover={
                    <div style={{ height: 180, overflow: 'hidden', background: '#fdf2f4' }}>
                      {coverImg ? (
                        <img
                          src={imgUrl(coverImg)}
                          alt={m.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 48, color: '#d4a0a8',
                        }}>💅</div>
                      )}
                    </div>
                  }
                  styles={{ body: { padding: '12px 16px' } }}
                >
                  <Link to={`/merchants/${m.id}`}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 4 }}>{m.name}</div>
                  </Link>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                    {m.city}{m.district ? ` · ${m.district}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#c77986', marginBottom: 8 }}>
                    <StarOutlined /> {m.rating} · {m.review_count || 0} 条评价
                  </div>
                  <Link to={`/merchants/${m.id}`}>
                    <Button type="primary" size="small" block style={{ borderRadius: 8 }}>
                      查看详情
                    </Button>
                  </Link>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
