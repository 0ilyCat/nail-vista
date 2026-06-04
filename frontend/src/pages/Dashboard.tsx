/**
 * 商家仪表盘 — 数据概览 | 款式管理 | 预约管理
 */
import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Tabs, Table, Button, Modal, Input,
  InputNumber, Select, message, Tag, Spin, Empty, Upload, Avatar,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, UploadOutlined,
  CalendarOutlined, DollarOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, adminAPI } from '../services/api';
import { imgUrl } from '../services/image';

/* ───────── 状态标签配置 ───────── */
const STATUS: Record<string, { color: string; label: string }> = {
  pending:   { color: 'orange', label: '待确认' },
  confirmed: { color: 'blue',   label: '已确认' },
  completed: { color: 'green',  label: '已完成' },
  cancelled: { color: '#999',   label: '已取消' },
};

export default function DashboardPage() {
  const nav = useNavigate();

  /* ──────── 通用状态 ──────── */
  const [user, setUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  /* ──────── 数据概览 ──────── */
  const [overview, setOverview] = useState<any>({});

  /* ──────── 款式管理 ──────── */
  const [styles, setStyles] = useState<any[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<any>(null);
  const [styleSubmitting, setStyleSubmitting] = useState(false);
  const [styleFormVals, setStyleFormVals] = useState<any>({
    name: '', description: '', price: 0, difficulty: 'medium',
    category: '', color_tone: '', scene: '', nail_shape: '',
  });

  /* ──────── 预约管理 ──────── */
  const [appts, setAppts] = useState<any[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [apptFilter, setApptFilter] = useState<string | undefined>(undefined);

  /* ═══════════════════════════ 初始化 ═══════════════════════════ */
  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { nav('/login'); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== 'merchant') { nav('/'); return; }
    setUser(parsed);
    loadOverview();
    setPageLoading(false);
  }, []);

  const loadOverview = async () => {
    try {
      const res = await dashboardAPI.overview();
      setOverview(res.data);
    } catch { /* ignore */ }
  };

  /* ═══════════════════════════ 款式管理 ═══════════════════════════ */
  const loadStyles = async () => {
    setStylesLoading(true);
    try {
      const res = await adminAPI.listStyles();
      setStyles(res.data.items || []);
    } catch (e: any) {
      message.error(e.response?.data?.detail || '款式加载失败');
    } finally { setStylesLoading(false); }
  };

  const openCreateStyle = () => {
    setEditingStyle(null);
    setStyleFormVals({ name: '', description: '', price: 0, difficulty: 'medium',
      category: '', color_tone: '', scene: '', nail_shape: '' });
    setStyleModalOpen(true);
  };

  const openEditStyle = (s: any) => {
    setEditingStyle(s);
    setStyleFormVals({
      name: s.name || '', description: s.description || '', price: s.price || 0,
      category: s.category || '', color_tone: s.color_tone || '',
      scene: s.scene || '', nail_shape: s.nail_shape || '',
      difficulty: s.difficulty || 'medium', is_active: s.is_active,
    });
    setStyleModalOpen(true);
  };

  const onSubmitStyle = async () => {
    if (!styleFormVals.name?.trim()) {
      message.warning('请输入款式名称');
      return;
    }
    setStyleSubmitting(true);
    try {
      const values = { ...styleFormVals };
      delete values.is_active; // edit mode only
      if (editingStyle) {
        await adminAPI.updateStyle(editingStyle.id, { ...values, ...(styleFormVals.is_active !== undefined ? { is_active: styleFormVals.is_active } : {}) });
        message.success('款式已更新');
      } else {
        await adminAPI.createStyle(values);
        message.success('款式已创建');
      }
      setStyleModalOpen(false);
      loadStyles();
      loadOverview();
    } catch (e: any) {
      if (e.response) {
        const detail = e.response.data?.detail;
        message.error(Array.isArray(detail) ? detail.map((d: any) => d.msg).join('；') : (detail || '操作失败'));
      }
    } finally { setStyleSubmitting(false); }
  };

  const onDeleteStyle = (s: any) => {
    Modal.confirm({
      title: '确认下架',
      content: `确定要下架「${s.name}」吗？下架后用户将无法看到该款式。`,
      okText: '确认下架',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminAPI.deleteStyle(s.id);
          message.success('款式已下架');
          loadStyles();
        } catch (e: any) { message.error('操作失败'); }
      },
    });
  };

  const onUploadStyleImage = async (styleId: number, file: File) => {
    try {
      const res = await adminAPI.setStyleImage(styleId, file);
      message.success('图片已更新');
      loadStyles();
      return res;
    } catch (e: any) { message.error('上传失败'); }
    return false;
  };

  /* ═══════════════════════════ 预约管理 ═══════════════════════════ */
  const loadAppts = async (status?: string) => {
    setApptsLoading(true);
    setApptFilter(status);
    try {
      const res = await adminAPI.listAppointments(status ? { status } : { page_size: 50 });
      setAppts(res.data.items || []);
    } catch { message.error('预约加载失败'); }
    finally { setApptsLoading(false); }
  };

  const onUpdateApptStatus = (id: number, newStatus: string, label: string) => {
    Modal.confirm({
      title: `确认${label}`,
      content: `确定将该预约标记为「${label}」吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await adminAPI.updateAppointment(id, newStatus);
          message.success(`预约已${label}`);
          loadAppts(apptFilter);
          loadOverview();
        } catch (e: any) { message.error('操作失败'); }
      },
    });
  };

  /* ═══════════════════════════ 加载中 ═══════════════════════════ */
  if (pageLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  /* ──────── 款式列定义 ──────── */
  const styleColumns = [
    { title: '图片', dataIndex: 'image_url', width: 72,
      render: (url: string, r: any) => (
        <Upload showUploadList={false} accept="image/*" customRequest={({ file }) => onUploadStyleImage(r.id, file as File)}>
          <Avatar shape="square" size={52} src={imgUrl(url)} icon={<UploadOutlined />}
            style={{ borderRadius: 6, cursor: 'pointer' }} />
        </Upload>
      ),
    },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    { title: '分类', dataIndex: 'category', width: 80 },
    { title: '价格', dataIndex: 'price', width: 80, render: (v: number) => v ? `¥${v}` : '-' },
    { title: '试戴次数', dataIndex: 'tryon_count', width: 90 },
    { title: '收藏', dataIndex: 'favorite_count', width: 70 },
    { title: '状态', dataIndex: 'is_active', width: 80,
      render: (v: boolean) => v ? <Tag color="green">上架</Tag> : <Tag color="#999">下架</Tag>,
    },
    { title: '操作', width: 140,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditStyle(r)}>编辑</Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteStyle(r)}>下架</Button>
        </div>
      ),
    },
  ];

  /* ──────── 预约列定义 ──────── */
  const apptColumns = [
    { title: '用户', dataIndex: 'user_name', width: 90 },
    { title: '服务项目', dataIndex: 'service_item', ellipsis: true, width: 130 },
    { title: '关联款式', dataIndex: 'style_name', ellipsis: true, width: 120,
      render: (v: string, r: any) => v || r.service_item || '-',
    },
    { title: '预约时间', dataIndex: 'appointment_time', width: 150,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }) : '-',
    },
    { title: '金额', dataIndex: 'price', width: 80, render: (v: number) => v ? `¥${v}` : '-' },
    { title: '创建时间', dataIndex: 'created_at', width: 100,
      render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-',
    },
    { title: '备注', dataIndex: 'notes', ellipsis: true, width: 120 },
    { title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => {
        const s = STATUS[v] || STATUS.pending;
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    { title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {r.status === 'pending' && (
            <Button size="small" type="primary" icon={<CheckOutlined />}
              onClick={() => onUpdateApptStatus(r.id, 'confirmed', '确认')}>确认</Button>
          )}
          {r.status === 'confirmed' && (
            <Button size="small" style={{ color: '#52c41a', borderColor: '#52c41a' }} icon={<CheckOutlined />}
              onClick={() => onUpdateApptStatus(r.id, 'completed', '完成')}>完成</Button>
          )}
          {(r.status === 'pending' || r.status === 'confirmed') && (
            <Button size="small" danger icon={<CloseOutlined />}
              onClick={() => onUpdateApptStatus(r.id, 'cancelled', '取消')}>取消</Button>
          )}
        </div>
      ),
    },
  ];

  /* ═══════════════════════════ 渲染 ═══════════════════════════ */
  return (
    <div style={{ maxWidth: 1200, margin: '24px auto' }}>
      <h2 style={{ color: '#8b5e6b', marginBottom: 20 }}>🏪 商家后台</h2>

      <Tabs
        size="large"
        tabBarStyle={{ background: '#fff', borderRadius: 12, padding: '4px 16px 0', border: '1px solid #f0d6dc', marginBottom: 16 }}
        items={[
          /* ════ Tab: 数据概览 ════ */
          {
            key: 'overview',
            label: '📊 数据概览',
            children: (
              <div>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={6}><Card><Statistic title="总预约" value={overview.total_appointments || 0} prefix={<CalendarOutlined />} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="待确认" value={overview.pending_appointments || 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="已完成" value={overview.completed_appointments || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="总营收" value={overview.total_revenue || 0} prefix="¥" precision={2} /></Card></Col>
                </Row>

                {overview.top_styles?.length > 0 && (
                  <Card title="🔥 热门款式 TOP5" size="small" style={{ marginTop: 16, borderRadius: 12 }}>
                    <Table
                      dataSource={overview.top_styles}
                      rowKey="style_name"
                      pagination={false}
                      columns={[
                        { title: '款式', dataIndex: 'style_name' },
                        { title: '预约数', dataIndex: 'appointment_count' },
                        { title: '营收', dataIndex: 'revenue', render: (v: number) => `¥${v.toFixed(2)}` },
                      ]}
                    />
                  </Card>
                )}
              </div>
            ),
          },

          /* ════ Tab: 美甲款式管理 ════ */
          {
            key: 'styles',
            label: '💅 美甲款式管理',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateStyle}>
                    新增款式
                  </Button>
                </div>
                <Table
                  dataSource={styles}
                  rowKey="id"
                  columns={styleColumns}
                  loading={stylesLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                  locale={{ emptyText: <Empty description="暂无款式，点击上方按钮新增" /> }}
                />
              </div>
            ),
          },

          /* ════ Tab: 预约管理 ════ */
          {
            key: 'appointments',
            label: '📋 预约管理',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  {[
                    { key: undefined, label: '全部' },
                    { key: 'pending', label: '待确认' },
                    { key: 'confirmed', label: '已确认' },
                    { key: 'completed', label: '已完成' },
                    { key: 'cancelled', label: '已取消' },
                  ].map(f => {
                    const isActive = apptFilter === f.key;
                    return (
                      <Button key={String(f.key)}
                        type={isActive ? 'primary' : 'default'}
                        onClick={() => loadAppts(f.key)}
                        style={{ marginRight: 8, borderRadius: 20, borderColor: isActive ? undefined : '#f0d6dc' }}
                      >
                        {f.label}
                      </Button>
                    );
                  })}
                </div>
                <Table
                  dataSource={appts}
                  rowKey="id"
                  columns={apptColumns as any}
                  loading={apptsLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  locale={{ emptyText: <Empty description="暂无预约记录" /> }}
                />
              </div>
            ),
          },
        ]}
        onChange={(key) => {
          if (key === 'styles') loadStyles();
          if (key === 'appointments') loadAppts();
        }}
      />

      {/* ════ 款式编辑 Modal ════ */}
      <Modal
        title={editingStyle ? '编辑款式' : '新增款式'}
        open={styleModalOpen}
        onCancel={() => setStyleModalOpen(false)}
        onOk={onSubmitStyle}
        confirmLoading={styleSubmitting}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>款式名称 *</label>
            <Input value={styleFormVals.name} onChange={e => setStyleFormVals({ ...styleFormVals, name: e.target.value })}
              maxLength={64} placeholder="请输入款式名称" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>描述</label>
            <Input.TextArea value={styleFormVals.description || ''} onChange={e => setStyleFormVals({ ...styleFormVals, description: e.target.value })}
              rows={2} maxLength={200} />
          </div>
          <Row gutter={12}>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>价格 (¥) *</label>
              <InputNumber value={styleFormVals.price} onChange={v => setStyleFormVals({ ...styleFormVals, price: v || 0 })}
                min={0} max={99999} style={{ width: '100%' }} />
            </Col>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>分类</label>
              <Input value={styleFormVals.category || ''} onChange={e => setStyleFormVals({ ...styleFormVals, category: e.target.value })}
                placeholder="如: 猫眼、渐变" />
            </Col>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>难度</label>
              <Select value={styleFormVals.difficulty || 'medium'} onChange={v => setStyleFormVals({ ...styleFormVals, difficulty: v })}
                style={{ width: '100%' }} options={[
                  { label: '简单', value: 'easy' }, { label: '中等', value: 'medium' }, { label: '困难', value: 'hard' },
                ]} />
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>色调</label>
              <Input value={styleFormVals.color_tone || ''} onChange={e => setStyleFormVals({ ...styleFormVals, color_tone: e.target.value })}
                placeholder="如: 暖色" />
            </Col>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>适用场景</label>
              <Input value={styleFormVals.scene || ''} onChange={e => setStyleFormVals({ ...styleFormVals, scene: e.target.value })}
                placeholder="如: 通勤" />
            </Col>
            <Col span={8}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>甲型</label>
              <Input value={styleFormVals.nail_shape || ''} onChange={e => setStyleFormVals({ ...styleFormVals, nail_shape: e.target.value })}
                placeholder="如: 方圆" />
            </Col>
          </Row>
          {editingStyle && (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>上架状态</label>
              <Select value={styleFormVals.is_active} onChange={v => setStyleFormVals({ ...styleFormVals, is_active: v })}
                style={{ width: '100%' }} options={[
                  { label: '上架', value: true }, { label: '下架', value: false },
                ]} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
