/**
 * 商家入驻页面
 */
import { useState } from 'react';
import { Card, Form, Input, Select, Button, Upload, Tag, App, Row, Col } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { TextArea } = Input;

const CITIES = ['北京','上海','广州','深圳','杭州','成都','南京','武汉','苏州','西安','重庆','厦门','昆明','长沙','青岛','其他'];
const STYLE_TAGS = ['通勤','裸色','猫眼','日式','法式','彩绘','渐变','极简','甜美','手绘','贴钻','定制甲片','晕染','果冻'];

export default function MerchantJoinPage() {
  const nav = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const onSubmit = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token) { nav('/login'); return; }
    setLoading(true);
    try {
      await axios.post('/api/merchants/join', { ...values, tags: selectedTags }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success('入驻申请已提交！门店已发布');
      nav('/dashboard');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '入驻失败，请重试');
    } finally { setLoading(false); }
  };

  const toggleTag = (t: string) => {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <div style={{ maxWidth: 700, margin: '24px auto' }}>
      <Card title="商家入驻">
        <p style={{ color: '#999', marginBottom: 24 }}>
          填写入驻申请表，提交后门店将直接展示在店家专区供用户预约。
        </p>

        <Form layout="vertical" onFinish={onSubmit} size="large">
          <Form.Item name="name" label="商家名称" rules={[{ required: true, message: '请输入商家名称' }]}>
            <Input placeholder="例：XX 美甲工坊" />
          </Form.Item>

          <Form.Item name="city" label="所在城市" rules={[{ required: true, message: '请选择城市' }]}>
            <Select placeholder="请选择" options={CITIES.map(c => ({ label: c, value: c }))} />
          </Form.Item>

          <Form.Item name="district" label="所在区域">
            <Input placeholder="例：天河区" />
          </Form.Item>

          <Form.Item name="address" label="详细地址" rules={[{ required: true, message: '请填写地址' }]}>
            <Input placeholder="街道、门牌号" />
          </Form.Item>

          <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请填写电话' }]}>
            <Input placeholder="例：13800138000" />
          </Form.Item>

          <Form.Item name="business_hours" label="营业时间" rules={[{ required: true, message: '请填写营业时间' }]}>
            <Input placeholder="例：10:00-22:00" />
          </Form.Item>

          <Form.Item name="description" label="商家简介">
            <TextArea rows={3} placeholder="介绍门店特色、服务理念等" maxLength={500} showCount />
          </Form.Item>

          <Form.Item label="风格/特色">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {STYLE_TAGS.map(t => (
                <Tag.CheckableTag key={t} checked={selectedTags.includes(t)} onChange={() => toggleTag(t)}
                  style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
                  {t}
                </Tag.CheckableTag>
              ))}
            </div>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              确认并发布门店
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
