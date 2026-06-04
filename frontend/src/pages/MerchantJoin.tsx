/**
 * 商家入驻页面 — 含店面图片上传（至少1张，最多3张）
 */
import { useState } from 'react';
import { Card, Form, Input, Select, Button, Upload, Tag, message, Image } from 'antd';
import { UploadOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { merchantsAPI } from '../services/api';
import { imgUrl } from '../services/image';

const { TextArea } = Input;

const CITIES = ['北京','上海','广州','深圳','杭州','成都','南京','武汉','苏州','西安','重庆','厦门','昆明','长沙','青岛','其他'];
const STYLE_TAGS = ['通勤','裸色','猫眼','日式','法式','彩绘','渐变','极简','甜美','手绘','贴钻','定制甲片','晕染','果冻'];

export default function MerchantJoinPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  /* ──────── 店面图片 ──────── */
  const [images, setImages] = useState<string[]>([]);         // 后端返回的 image_url
  const [uploading, setUploading] = useState(false);

  const onUploadImage = async (file: File) => {
    if (images.length >= 3) {
      message.warning('最多上传 3 张店面图片');
      return false;
    }
    setUploading(true);
    try {
      const res = await merchantsAPI.uploadImage(file);
      const url = res.data.image_path;  // 相对路径用于提交
      setImages(prev => [...prev, url]);
      message.success('图片上传成功');
    } catch {
      message.error('图片上传失败');
    } finally {
      setUploading(false);
    }
    return false;  // 阻止默认上传行为
  };

  const onRemoveImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const onSubmit = async (values: any) => {
    const token = localStorage.getItem('token');
    if (!token) { nav('/login'); return; }
    if (images.length === 0) {
      message.warning('请至少上传一张店面图片');
      return;
    }
    setLoading(true);
    try {
      await merchantsAPI.join({ ...values, tags: selectedTags, images });
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
          填写入驻申请表，提交后门店将直接展示在店家专区供用户预约。每个商家账号仅限入驻一次。
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

          {/* 店面图片上传 */}
          <Form.Item
            label="店面图片"
            required
            help="至少上传 1 张，最多 3 张店面环境图片"
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {images.map((img, idx) => (
                <div key={idx} style={{
                  position: 'relative', width: 120, height: 120, borderRadius: 8,
                  overflow: 'hidden', border: '1px solid #f0d6dc',
                }}>
                  <Image
                    src={imgUrl(img)}
                    alt={`店面图${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    preview={{ mask: '预览' }}
                  />
                  <div
                    onClick={() => onRemoveImage(idx)}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.45)', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    <CloseOutlined />
                  </div>
                </div>
              ))}
              {images.length < 3 && (
                <Upload
                  beforeUpload={onUploadImage}
                  showUploadList={false}
                  accept="image/*"
                >
                  <div style={{
                    width: 120, height: 120, border: '2px dashed #f0d6dc', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', color: '#c77986',
                    background: '#fdf2f4', transition: 'all .2s',
                  }}>
                    {uploading ? (
                      <span style={{ fontSize: 13 }}>上传中...</span>
                    ) : (
                      <>
                        <PlusOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                        <span style={{ fontSize: 12 }}>上传图片</span>
                      </>
                    )}
                  </div>
                </Upload>
              )}
            </div>
            {images.length > 0 && (
              <span style={{ fontSize: 12, color: '#8b5e6b' }}>已选择 {images.length}/3 张</span>
            )}
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
            <Button type="primary" htmlType="submit" loading={loading} block size="large" disabled={uploading}>
              确认并发布门店
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
