/**
 * 预约弹窗 — 共用组件，StyleDetail 和 MerchantDetail 统一使用
 *
 * Props:
 *   open / onClose         — 弹窗开关
 *   merchantId             — 商家 ID
 *   styleId? styleName?    — 关联款式（可选；从商家款式下拉框中预选）
 *   onSuccess              — 预约成功回调
 */
import { useEffect, useState } from 'react';
import { Modal, Button, Select, Input, message, Spin, Empty, Tag } from 'antd';
import { CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { appointmentsAPI, stylesAPI } from '../services/api';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

interface TimeSlot {
  start: string;
  end: string;
  max_bookings: number;
  booked: number;
  available: number;
}

interface StyleOption {
  id: number;
  name: string;
  price: number;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  merchantId: number;
  styleId?: number;
  styleName?: string;
  onSuccess?: () => void;
}

export default function AppointmentModal({ open, onClose, merchantId, styleId, styleName, onSuccess }: Props) {
  const nav = useNavigate();

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [date, setDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState<number | undefined>(styleId);
  const [serviceItem, setServiceItem] = useState(styleName || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ──────── 商家款式列表 ──────── */
  const [merchantStyles, setMerchantStyles] = useState<StyleOption[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);

  // 生成未来 7 天日期选项
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }),
      value: d.toISOString().slice(0, 10),
    };
  });

  useEffect(() => {
    if (open && merchantId) {
      setDate(dateOptions[0].value);
      setSelectedStyleId(styleId);
      setServiceItem(styleName || '');
      loadMerchantStyles(merchantId);
    } else {
      setSlots([]);
      setSelectedSlot('');
      setSelectedStyleId(undefined);
      setServiceItem('');
      setNotes('');
      setMerchantStyles([]);
    }
  }, [open, merchantId, styleId, styleName]);

  // 日期/商家变化时加载时段
  useEffect(() => {
    if (!open || !merchantId || !date) return;
    loadSlots();
  }, [date, merchantId, open]);

  /* ──────── 加载商家款式 ──────── */
  const loadMerchantStyles = async (mId: number) => {
    setStylesLoading(true);
    try {
      const res = await stylesAPI.list({ merchant_id: mId, page_size: 100 });
      const items = (res.data?.items || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        category: s.category,
      }));
      setMerchantStyles(items);
    } catch {
      setMerchantStyles([]);
    } finally {
      setStylesLoading(false);
    }
  };

  const loadSlots = async () => {
    setSlotsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await api.get(`/merchants/${merchantId}/slots`, {
        params: { date },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSlots(res.data.slots || []);
      setSelectedSlot('');
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  /* ──────── 款式选中处理 ──────── */
  const onStyleChange = (value: number) => {
    const selected = merchantStyles.find(s => s.id === value);
    setSelectedStyleId(value);
    setServiceItem(selected?.name || '');
  };

  /* ──────── 提交预约 ──────── */
  const onSubmit = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      message.warning('请先登录后再预约');
      nav('/login');
      return;
    }
    if (!selectedSlot) {
      message.warning('请选择预约时段');
      return;
    }
    if (!selectedStyleId) {
      message.warning('请选择服务项目');
      return;
    }

    setSubmitting(true);
    try {
      const slot = slots.find(s => s.start === selectedSlot);
      const apptDate = date;
      await appointmentsAPI.create({
        merchant_id: merchantId,
        style_id: selectedStyleId,
        service_item: serviceItem,
        appointment_time: slot ? `${apptDate}T${slot.start}:00` : undefined,
        notes,
      });
      message.success('预约成功，商家将尽快确认');
      onClose();
      onSuccess?.();
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      if (e.response?.status === 401) {
        message.error('登录已过期，请重新登录');
        nav('/login');
      } else {
        message.error(typeof detail === 'string' ? detail : '预约失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ──────── 构建 Select 选项 ──────── */
  const styleOptions = merchantStyles.map(s => ({
    label: (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{s.name}</span>
        <span style={{ color: '#2f6f68', fontWeight: 600, fontSize: 13 }}>¥{s.price}</span>
      </div>
    ),
    value: s.id,
  }));

  return (
    <Modal
      title="预约美甲服务"
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={submitting}
      okText="确认预约"
      cancelText="取消"
      width={480}
      destroyOnHidden
      styles={{ body: { padding: '20px 24px' } }}
    >
      {/* 款式信息（外部传入时预填提示） */}
      {styleName && !selectedStyleId && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f3f8f4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="#2f6f68" style={{ margin: 0 }}>推荐款式</Tag>
          <span style={{ fontWeight: 600, color: '#333' }}>{styleName}</span>
        </div>
      )}

      {/* 服务项目 — 下拉选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>服务项目 *</label>
        {stylesLoading ? (
          <Spin size="small" style={{ display: 'block', margin: '12px 0' }} />
        ) : merchantStyles.length === 0 ? (
          <div style={{ padding: '10px 12px', color: '#bbb', fontSize: 13, background: '#fafafa', borderRadius: 8 }}>
            该商家暂无已发布的美甲款式
          </div>
        ) : (
          <Select
            showSearch
            value={selectedStyleId}
            onChange={onStyleChange}
            placeholder="请选择美甲款式"
            optionFilterProp="label"
            options={styleOptions}
            style={{ width: '100%' }}
          />
        )}
      </div>

      {/* 日期选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>
          <CalendarOutlined style={{ marginRight: 6 }} />预约日期
        </label>
        <Select
          value={date}
          onChange={setDate}
          options={dateOptions}
          style={{ width: '100%' }}
        />
      </div>

      {/* 时段选择 */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>
          <ClockCircleOutlined style={{ marginRight: 6 }} />预约时段
        </label>
        {slotsLoading ? (
          <Spin size="small" />
        ) : slots.length === 0 ? (
          <Empty description={date ? '该日期暂无可用时段' : '请先选择日期'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {slots.map(slot => (
              <div
                key={slot.start}
                onClick={() => {
                  if (slot.available > 0) setSelectedSlot(slot.start);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: selectedSlot === slot.start ? '2px solid #2f6f68' : '1px solid #e8e8e8',
                  background: selectedSlot === slot.start ? '#f3f8f4' : '#fff',
                  cursor: slot.available > 0 ? 'pointer' : 'not-allowed',
                  opacity: slot.available > 0 ? 1 : 0.45,
                  fontSize: 13,
                  transition: 'all .15s',
                }}
              >
                {slot.start}-{slot.end}
                {slot.available > 0 ? (
                  <span style={{ color: '#52c41a', marginLeft: 6, fontSize: 11 }}>
                    剩{slot.available}
                  </span>
                ) : (
                  <span style={{ color: '#999', marginLeft: 6, fontSize: 11 }}>已满</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 备注 */}
      <div>
        <label style={{ fontWeight: 500, marginBottom: 6, display: 'block', color: '#555' }}>备注（选填）</label>
        <Input.TextArea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="如有特殊需求请在此说明"
        />
      </div>
    </Modal>
  );
}

