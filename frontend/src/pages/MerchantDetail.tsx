import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Spin, Tag, message, Carousel, Image } from 'antd';
import { merchantsAPI, favoritesAPI } from '../services/api';
import { imgUrl } from '../services/image';
import AppointmentModal from '../components/AppointmentModal';

const { Title, Paragraph } = Typography;

export default function MerchantDetailPage() {
  const { id } = useParams();
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aptOpen, setAptOpen] = useState(false);

  useEffect(() => {
    merchantsAPI.getDetail(Number(id)).then(res => setMerchant(res.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!merchant) return <div>商家不存在</div>;

  const storeImages = (merchant.images || []).filter(Boolean);

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto' }}>
      {/* 店面图片轮播 */}
      {storeImages.length > 0 && (
        <div style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}>
          <Image.PreviewGroup>
            <Carousel autoplay autoplaySpeed={4000} dots={storeImages.length > 1}>
              {storeImages.map((img: string, idx: number) => (
                <div key={idx}>
                  <Image
                    src={imgUrl(img)}
                    alt={`店面图片 ${idx + 1}`}
                    style={{
                      width: '100%', height: 320, objectFit: 'cover',
                      display: 'block', cursor: 'pointer',
                    }}
                    preview={{ mask: '点击放大' }}
                  />
                </div>
              ))}
            </Carousel>
          </Image.PreviewGroup>
        </div>
      )}

      <Title level={2} style={{ color: '#5a7a52' }}>{merchant.name}</Title>
      <div style={{ marginBottom: 12 }}>
        <Tag>{merchant.city}{merchant.district ? ` · ${merchant.district}` : ''}</Tag>
        <Tag>⭐ {merchant.rating}</Tag>
        {(merchant.tags || []).map((t: string) => <Tag key={t} color="#7d9d7a">{t}</Tag>)}
      </div>
      <Paragraph style={{ color: '#555', fontSize: 14 }}>{merchant.description}</Paragraph>
      <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>📍 {merchant.address}</div>
      <div style={{ color: '#888', fontSize: 13 }}>🕐 {merchant.business_hours}</div>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Title level={4} style={{ color: '#5a7a52' }}>服务项目</Title>
          {(merchant.styles || []).map((s: any) => (
            <Card key={s.id} size="small" style={{ marginBottom: 8 }}>
              <Row align="middle">
                <Col><img src={imgUrl(s.image_url)} alt={s.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} /></Col>
                <Col flex={1} style={{ marginLeft: 16 }}>
                  <Link to={`/styles/${s.id}`}><strong>{s.name}</strong></Link>
                  <div style={{ color: '#888', fontSize: 13 }}>{s.description}</div>
                  <strong style={{ color: '#7d9d7a' }}>¥{s.price}</strong>
                </Col>
              </Row>
            </Card>
          ))}
        </Col>
        <Col xs={24} md={8}>
          <Card title="预约/咨询" style={{ borderRadius: 12, border: '1px solid #e8ede6' }}>
            <Button type="primary" block onClick={() => setAptOpen(true)} size="large" style={{ marginBottom: 12, borderRadius: 8 }}>
              立即预约
            </Button>
            <Button block style={{ borderRadius: 8 }}
              onClick={() => favoritesAPI.toggleMerchant(merchant.id).then(() => message.success('已收藏')).catch(() => {})}>
              收藏该商家
            </Button>
          </Card>
        </Col>
      </Row>

      <AppointmentModal
        open={aptOpen}
        onClose={() => setAptOpen(false)}
        merchantId={merchant.id}
      />
    </div>
  );
}
