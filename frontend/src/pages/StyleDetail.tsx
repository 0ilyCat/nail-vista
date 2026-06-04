import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Spin, Tag, message } from 'antd';
import { stylesAPI, favoritesAPI } from '../services/api';
import { imgUrl } from '../services/image';
import AppointmentModal from '../components/AppointmentModal';

const { Title, Paragraph } = Typography;

export default function StyleDetailPage() {
  const { id } = useParams();
  const [style, setStyle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aptOpen, setAptOpen] = useState(false);
  const [merchantId, setMerchantId] = useState<number>(0);

  useEffect(() => {
    stylesAPI.getDetail(Number(id)).then(res => {
      setStyle(res.data);
      setMerchantId(res.data.merchant_id);
    }).catch(() => message.error('款式加载失败')).finally(() => setLoading(false));
  }, [id]);

  const onFavorite = async () => {
    try {
      await favoritesAPI.toggleStyle(style.id);
      message.success('已收藏');
    } catch { message.warning('请先登录'); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!style) return <div style={{ textAlign: 'center', padding: 100, color: '#999' }}>款式不存在</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto' }}>
      <Row gutter={32}>
        <Col xs={24} md={12}>
          <img src={imgUrl(style.image_url)} alt={style.name}
            style={{ width: '100%', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
        </Col>
        <Col xs={24} md={12}>
          <Title level={2} style={{ color: '#5a7a52' }}>{style.name}</Title>
          <div style={{ marginBottom: 12 }}>
            {[style.category, style.color_tone, style.scene, style.nail_shape].filter(Boolean).map((t: string) => (
              <Tag key={t} color="#7d9d7a" style={{ marginRight: 6 }}>{t}</Tag>
            ))}
          </div>
          <div style={{ fontSize: 28, color: '#7d9d7a', fontWeight: 700, marginBottom: 12 }}>¥{style.price}</div>
          <Paragraph>{style.description}</Paragraph>

          <div style={{ marginTop: 24 }}>
            <Button type="primary" size="large" onClick={() => setAptOpen(true)} style={{ marginRight: 12 }}>
              立即预约
            </Button>
            <Link to={`/tryon?merchant_id=${merchantId}&style_id=${style.id}`} style={{ marginRight: 12 }}>
              <Button size="large" style={{ borderColor: '#7d9d7a', color: '#7d9d7a' }}>AI试戴</Button>
            </Link>
            <Button size="large" onClick={onFavorite}>收藏款式</Button>
          </div>

          {style.merchant && (
            <Card size="small" style={{ marginTop: 24 }}>
              <Link to={`/merchants/${style.merchant.id}`}>
                <strong>{style.merchant.name}</strong>
              </Link>
              <div>{style.merchant.city} {style.merchant.address} · 评分 {style.merchant.rating}</div>
              <div style={{ marginTop: 8 }}>
                <Link to={`/merchants/${style.merchant.id}`}><Button size="small">查看店铺详情</Button></Link>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      <AppointmentModal
        open={aptOpen}
        onClose={() => setAptOpen(false)}
        merchantId={merchantId}
        styleId={style.id}
        styleName={style.name}
      />
    </div>
  );
}
