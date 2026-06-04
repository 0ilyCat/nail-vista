import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Spin, Tabs } from 'antd';
import { searchAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title } = Typography;

export default function SearchPage() {
  const [search] = useSearchParams();
  const q = search.get('q') || '';
  const [results, setResults] = useState<any>({ styles: [], posts: [], merchants: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setLoading(true);
    searchAPI.all(q).then(r => setResults(r.data)).finally(() => setLoading(false));
  }, [q]);

  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <Title level={3} style={{ color: '#2f4541' }}>搜索: "{q}"</Title>
      {loading ? <Spin /> : (
        <Tabs items={[
          {
            key: 'styles', label: `美甲款式 (${results.styles?.length || 0})`,
            children: (
              <Row gutter={[16, 16]}>
                {results.styles?.map((s: any) => (
                  <Col xs={12} sm={8} md={4} key={s.id}>
                    <Link to={`/styles/${s.id}`}>
                      <Card hoverable size="small" cover={<img src={imgUrl(s.image_url)} alt={s.name} style={{ height: 160, objectFit: 'cover' }} />}>
                        <Card.Meta title={s.name} description={`¥${s.price}`} />
                      </Card>
                    </Link>
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'posts', label: `帖子 (${results.posts?.length || 0})`,
            children: (
              <Row gutter={[16, 16]}>
                {results.posts?.map((p: any) => (
                  <Col xs={12} sm={8} md={6} key={p.id}>
                    <Link to={`/community/post/${p.id}`}>
                      <Card hoverable size="small" cover={<img src={imgUrl(p.image_url)} alt={p.title} style={{ height: 160, objectFit: 'cover' }} />}>
                        <Card.Meta title={p.title} description={`${p.author_name} · ♥ ${p.likes_count}`} />
                      </Card>
                    </Link>
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'merchants', label: `商家 (${results.merchants?.length || 0})`,
            children: (
              <Row gutter={[16, 16]}>
                {results.merchants?.map((m: any) => (
                  <Col xs={24} sm={12} md={6} key={m.id}>
                    <Link to={`/merchants/${m.id}`}>
                      <Card hoverable size="small">
                        <strong>{m.name}</strong>
                        <div>{m.city} · 评分 {m.rating}</div>
                      </Card>
                    </Link>
                  </Col>
                ))}
              </Row>
            ),
          },
        ]} />
      )}
    </div>
  );
}

