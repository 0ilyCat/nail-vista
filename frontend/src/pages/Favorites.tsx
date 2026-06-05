import { useEffect, useState } from 'react';
import { Row, Col, Card, Tabs, Spin, Button, message } from 'antd';
import { Link } from 'react-router-dom';
import { favoritesAPI } from '../services/api';
import { imgUrl } from '../services/image';

export default function FavoritesPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      favoritesAPI.listMerchants({ page_size: 50 }),
      favoritesAPI.listStyles({ page_size: 50 }),
    ]).then(([mRes, sRes]) => {
      setMerchants(mRes.data.items || []);
      setStyles(sRes.data.items || []);
    }).catch(() => message.warning('请先登录')).finally(() => setLoading(false));
  }, []);

  const unfavMerchant = async (id: number) => {
    await favoritesAPI.toggleMerchant(id);
    setMerchants(merchants.filter(m => m.id !== id));
  };

  const unfavStyle = async (id: number) => {
    await favoritesAPI.toggleStyle(id);
    setStyles(styles.filter(s => s.id !== id));
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Tabs items={[
        {
          key: 'styles', label: `收藏款式 (${styles.length})`,
          children: (
            <Row gutter={[16, 16]}>
              {styles.map(s => (
                <Col xs={12} sm={8} md={4} key={s.id}>
                  <Card hoverable size="small" cover={
                    <img src={imgUrl(s.image_url)} alt={s.name} style={{ height: 160, objectFit: 'cover' }} />
                  } actions={[<Button size="small" danger onClick={() => unfavStyle(s.id)}>取消收藏</Button>]}>
                    <Link to={`/styles/${s.id}`}><strong>{s.name}</strong></Link>
                    <div style={{ color: '#E8708D' }}>¥{s.price}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          ),
        },
        {
          key: 'merchants', label: `收藏商家 (${merchants.length})`,
          children: (
            <Row gutter={[16, 16]}>
              {merchants.map(m => (
                <Col xs={24} sm={12} md={6} key={m.id}>
                  <Card size="small" actions={[<Button size="small" danger onClick={() => unfavMerchant(m.id)}>取消收藏</Button>]}>
                    <Link to={`/merchants/${m.id}`}><strong>{m.name}</strong></Link>
                    <div>{m.city} · 评分 {m.rating}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          ),
        },
      ]} />
    </div>
  );
}
