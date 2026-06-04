import { useEffect, useState } from 'react';
import { Row, Col, Card, Typography, Select, Spin, Button, message } from 'antd';
import { Link } from 'react-router-dom';
import { merchantsAPI } from '../services/api';

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
    } catch (e: any) {
      console.error('店家加载失败', e);
      setMerchants([]);
      message.error('店家加载失败');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#8b5e6b' }}>🏪 店家专区</Title>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select allowClear placeholder="城市" style={{ width: 120 }} value={cityFilter || undefined}
          onChange={v => setCityFilter(v || '')} options={cities.map((c: any) => ({ label: c.city, value: c.city }))} />
      </div>
      {loading ? <Spin size="large" style={{ display: 'block', margin: '100px auto' }} /> : (
        <Row gutter={[16, 16]}>
          {merchants.map(m => (
            <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
              <Card hoverable>
                <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🏪</div>
                <Link to={`/merchants/${m.id}`}><strong>{m.name}</strong></Link>
                <div>{m.city} {m.district}</div>
                <div>⭐ {m.rating} · {m.review_count} 条评价</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Link to={`/merchants/${m.id}`}><Button size="small" onClick={() => message.info('正在加载店铺详情...')}>查看详情</Button></Link>
                  <Link to={`/merchants/${m.id}`}><Button size="small" type="primary">预约/咨询</Button></Link>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
