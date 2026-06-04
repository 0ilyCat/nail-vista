import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Typography, Button, Spin, Tag, message, Select, Input } from 'antd';
import { merchantsAPI, appointmentsAPI, favoritesAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { Title, Paragraph } = Typography;

export default function MerchantDetailPage() {
  const { id } = useParams();
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aptSubmitting, setAptSubmitting] = useState(false);
  const [aptTime, setAptTime] = useState('');
  const [aptService, setAptService] = useState('');
  const [aptNotes, setAptNotes] = useState('');

  useEffect(() => {
    merchantsAPI.getDetail(Number(id)).then(res => setMerchant(res.data)).finally(() => setLoading(false));
  }, [id]);

  const onAppointment = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.warning('请先登录后再预约');
      return;
    }
    if (!aptService.trim()) {
      message.warning('请填写服务项目');
      return;
    }
    setAptSubmitting(true);
    try {
      // 将中文时间描述转换为 ISO 日期字符串
      const now = new Date();
      let appointmentTime: string | undefined;
      if (aptTime.includes('明天')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        appointmentTime = `${tomorrow.toISOString().slice(0, 10)}T${aptTime.split(' ')[1]}:00`;
      } else if (aptTime.includes('后天')) {
        const dayAfter = new Date(now);
        dayAfter.setDate(dayAfter.getDate() + 2);
        appointmentTime = `${dayAfter.toISOString().slice(0, 10)}T${aptTime.split(' ')[1]}:00`;
      }

      await appointmentsAPI.create({
        merchant_id: merchant.id,
        service_item: aptService,
        appointment_time: appointmentTime,
        notes: aptNotes,
      });
      message.success('预约成功，商家将尽快确认');
      setAptService('');
      setAptNotes('');
      setAptTime('');
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 401) {
        message.error('登录已过期，请重新登录');
      } else if (Array.isArray(detail)) {
        message.error(detail.map((d: any) => d.msg).join('；'));
      } else {
        message.error(typeof detail === 'string' ? detail : '预约失败，请稍后重试');
      }
    } finally { setAptSubmitting(false); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  if (!merchant) return <div>商家不存在</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto' }}>
      <Title level={2} style={{ color: '#8b5e6b' }}>{merchant.name}</Title>
      <div style={{ marginBottom: 12 }}>
        <Tag>{merchant.city}</Tag>
        <Tag>⭐ {merchant.rating}</Tag>
        {merchant.tags?.map((t: string) => <Tag key={t} color="#c77986">{t}</Tag>)}
      </div>
      <Paragraph>{merchant.description}</Paragraph>
      <div>📍 {merchant.address}</div>
      <div>🕐 {merchant.business_hours}</div>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col xs={24} md={16}>
          <Title level={4}>服务项目</Title>
          {merchant.styles?.map((s: any) => (
            <Card key={s.id} size="small" style={{ marginBottom: 8 }}>
              <Row align="middle">
                <Col><img src={imgUrl(s.image_url)} alt={s.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} /></Col>
                <Col flex={1} style={{ marginLeft: 16 }}>
                  <Link to={`/styles/${s.id}`}><strong>{s.name}</strong></Link>
                  <div>{s.description}</div>
                  <strong style={{ color: '#c77986' }}>¥{s.price}</strong>
                </Col>
              </Row>
            </Card>
          ))}
        </Col>
        <Col xs={24} md={8}>
          <Card title="预约/咨询">
            <Select style={{ width: '100%', marginBottom: 12 }} placeholder="期望时间" value={aptTime || undefined}
              onChange={setAptTime}
              options={['明天 14:00', '明天 16:30', '后天 11:00', '后天 19:30'].map(t => ({ label: t, value: t }))} />
            <Input placeholder="服务项目" value={aptService} onChange={e => setAptService(e.target.value)} style={{ marginBottom: 12 }} />
            <Input.TextArea placeholder="需求备注（选填）" value={aptNotes} onChange={e => setAptNotes(e.target.value)} rows={2} style={{ marginBottom: 12 }} />
            <Button type="primary" block onClick={onAppointment} loading={aptSubmitting}>提交预约</Button>
            <Button block style={{ marginTop: 8 }} onClick={() => favoritesAPI.toggleMerchant(merchant.id).then(() => message.success('已收藏')).catch(() => {})}>
              收藏该商家
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
