import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Spin, Tag, message, Modal, Input } from 'antd';
import { stylesAPI, appointmentsAPI, favoritesAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Paragraph } = Typography;

export default function StyleDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [style, setStyle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aptOpen, setAptOpen] = useState(false);
  const [aptTime, setAptTime] = useState('');
  const [aptNotes, setAptNotes] = useState('');
  const [aptLoading, setAptLoading] = useState(false);

  useEffect(() => {
    stylesAPI.getDetail(Number(id)).then(res => setStyle(res.data)).catch(() => message.error('款式加载失败')).finally(() => setLoading(false));
  }, [id]);

  const onAppointment = async () => {
    const token = localStorage.getItem('token');
    if (!token) { message.warning('请先登录'); nav('/login'); return; }
    setAptLoading(true);
    try {
      await appointmentsAPI.create({
        merchant_id: style.merchant_id, style_id: style.id,
        service_item: style.name, appointment_time: aptTime || undefined,
        notes: aptNotes, price: style.price,
      });
      message.success('预约成功！商家将尽快与您确认');
      setAptOpen(false);
      setAptTime(''); setAptNotes('');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '预约失败，请重试');
    } finally { setAptLoading(false); }
  };

  const onFavorite = async () => {
    try {
      await favoritesAPI.toggleStyle(style.id);
      message.success('已收藏');
    } catch (e: any) { message.warning('请先登录'); }
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
          <Title level={2} style={{ color: '#8b5e6b' }}>{style.name}</Title>
          <div style={{ marginBottom: 12 }}>
            {[style.category, style.color_tone, style.scene, style.nail_shape].filter(Boolean).map((t: string) => (
              <Tag key={t} color="#c77986" style={{ marginRight: 6 }}>{t}</Tag>
            ))}
          </div>
          <div style={{ fontSize: 28, color: '#c77986', fontWeight: 700, marginBottom: 12 }}>¥{style.price}</div>
          <Paragraph>{style.description}</Paragraph>

          <div style={{ marginTop: 24 }}>
            <Button type="primary" size="large" onClick={() => setAptOpen(true)} style={{ marginRight: 12 }}>
              立即预约
            </Button>
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

      <Modal title="预约确认" open={aptOpen} onOk={onAppointment} onCancel={() => setAptOpen(false)}
        okText="确认预约" confirmLoading={aptLoading}>
        <p><strong>款式：</strong>{style.name}</p>
        <p><strong>价格：</strong>¥{style.price}</p>
        {style.merchant && <p><strong>店铺：</strong>{style.merchant.name}</p>}
        <Input placeholder="期望时间（如：明天下午2点）" value={aptTime} onChange={e => setAptTime(e.target.value)} style={{ marginBottom: 12 }} />
        <Input.TextArea placeholder="需求备注（选填）" value={aptNotes} onChange={e => setAptNotes(e.target.value)} rows={2} />
      </Modal>
    </div>
  );
}
