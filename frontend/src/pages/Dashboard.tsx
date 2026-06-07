/**
 * 商家仪表盘 — 数据概览（左：数据排行榜 | 右：运营助手AI对话）
 * + 款式管理 + 预约管理 + 时段管理
 */
import { useEffect, useState, useRef } from 'react';
import {
  Card, Row, Col, Statistic, Tabs, Table, Button, Modal, Input,
  InputNumber, Select, message, Tag, Spin, Empty, Upload, Avatar, TimePicker,
  Collapse,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, UploadOutlined,
  CalendarOutlined, DollarOutlined, ShoppingOutlined, ClockCircleOutlined,
  RobotOutlined, SendOutlined, UserOutlined, ToolOutlined,
  LoadingOutlined, FireOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, adminAPI, chatAPI } from '../services/api';
import { imgUrl } from '../services/image';
import useChatWS from '../hooks/useChatWS';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import ChartRenderer, { extractCharts, type ChartConfig } from '../components/ChartRenderer';
import dayjs from 'dayjs';

/* ───────── 状态标签配置 ───────── */
const STATUS: Record<string, { color: string; label: string }> = {
  pending:   { color: 'orange', label: '待确认' },
  confirmed: { color: 'blue',   label: '已确认' },
  completed: { color: 'green',  label: '已完成' },
  cancelled: { color: '#999',   label: '已取消' },
};

/* ── 运营助手预设提问 ── */
const OPS_SUGGESTIONS = [
  '今天数据怎么样？',
  '最近什么款式最火？',
  '给我看看7天营收趋势',
  '帮我分析客户偏好',
];

/* ── 工具名称映射 ── */
const TOOL_LABELS: Record<string, string> = {
  get_dashboard_stats: '获取运营数据',
  get_revenue_trends: '营收趋势分析',
  get_style_ranking: '款式排行',
  get_appointment_stats: '预约统计',
  search_nail_styles: '搜索款式',
};

export default function DashboardPage() {
  const nav = useNavigate();

  /* ──────── 通用状态 ──────── */
  const [user, setUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  /* ──────── 数据概览 ──────── */
  const [overview, setOverview] = useState<any>({});

  /* ──────── 运营助手AI对话 ──────── */
  const [opsInput, setOpsInput] = useState('');
  const { messages: opsMessages, send: opsSend, loading: opsLoading, connect: opsConnect,
    sessionKey: opsSessionKey, clearMessages: opsClearMessages, setCurrentSessionKey: opsSetCurrentSessionKey } = useChatWS('ops');
  const opsChatRef = useRef<HTMLDivElement>(null);
  const [opsSessions, setOpsSessions] = useState<any[]>([]);
  const [opsActiveKey, setOpsActiveKey] = useState<string | null>(null);
  const [opsHistoryMessages, setOpsHistoryMessages] = useState<any[]>([]);
  const [opsSidebarOpen, setOpsSidebarOpen] = useState(false);

  // 合并消息：历史 + WS实时
  const allOpsMessages = [...opsHistoryMessages, ...opsMessages];

  /* ──────── 款式管理 ──────── */
  const [styles, setStyles] = useState<any[]>([]);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<any>(null);
  const [styleSubmitting, setStyleSubmitting] = useState(false);
  const [styleImageFile, setStyleImageFile] = useState<File | null>(null);
  const [styleImagePreview, setStyleImagePreview] = useState<string>('');
  const [styleFormVals, setStyleFormVals] = useState<any>({
    name: '', description: '', price: 0, difficulty: 'medium',
    category: '', color_tone: '', scene: '', nail_shape: '',
  });

  /* ──────── 预约管理 ──────── */
  const [appts, setAppts] = useState<any[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);
  const [apptFilter, setApptFilter] = useState<string | undefined>(undefined);

  /* ──────── 时段管理 ──────── */
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlotIdx, setEditingSlotIdx] = useState<number | null>(null);
  const [slotForm, setSlotForm] = useState({ start: '09:00', end: '10:00', max_bookings: 2 });
  const [slotSaving, setSlotSaving] = useState(false);

  /* ═══════════════════════════ 初始化 ═══════════════════════════ */
  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { nav('/login'); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== 'merchant') { nav('/'); return; }
    setUser(parsed);
    loadOverview();
    opsConnect().catch(() => {});
    loadOpsSessions();
    setPageLoading(false);
  }, []);

  const loadOverview = async () => {
    try {
      const res = await dashboardAPI.overview();
      setOverview(res.data);
    } catch { /* ignore */ }
  };

  /* ── 运营助手聊天 ── */
  const loadOpsSessions = () => {
    chatAPI.getSessions('ops').then(r => {
      const list = r.data || [];
      setOpsSessions(list);
    }).catch(() => {});
  };

  // 加载运营助手历史消息
  useEffect(() => {
    if (opsActiveKey) {
      opsClearMessages();
      setOpsHistoryMessages([]);
      opsSetCurrentSessionKey(opsActiveKey);
      chatAPI.getMessages(opsActiveKey).then(r => {
        const msgs = r.data.messages || [];
        setOpsHistoryMessages(msgs.map((m: any) => ({
          ...m,
          tool_calls: typeof m.tool_calls === 'string' ? JSON.parse(m.tool_calls || '[]') : (m.tool_calls || []),
          thinking: typeof m.thinking === 'string' ? JSON.parse(m.thinking || '[]') : (m.thinking || []),
        })));
      }).catch(() => setOpsHistoryMessages([]));
    } else {
      opsSetCurrentSessionKey(null);
      setOpsHistoryMessages([]);
    }
  }, [opsActiveKey]);

  // 当 WS 创建新 session 时更新 activeKey
  useEffect(() => {
    if (opsSessionKey) {
      setOpsActiveKey(opsSessionKey);
      loadOpsSessions();
    }
  }, [opsSessionKey]);

  const newOpsChat = () => {
    setOpsActiveKey(null);
    setOpsHistoryMessages([]);
    opsClearMessages();
    opsSetCurrentSessionKey(null);
  };

  const deleteOpsSession = async (key: string) => {
    try {
      await chatAPI.deleteSession(key);
      if (opsActiveKey === key) {
        setOpsActiveKey(null);
        setOpsHistoryMessages([]);
      }
      loadOpsSessions();
    } catch { /* ignore */ }
  };

  const onOpsSend = async () => {
    if (!opsInput.trim() || opsLoading) return;
    const msg = opsInput;
    setOpsInput('');
    await opsSend(msg);
  };

  useEffect(() => {
    if (opsChatRef.current) opsChatRef.current.scrollTop = opsChatRef.current.scrollHeight;
  }, [allOpsMessages]);

  /* ── 运营助手工具调用展示 ── */
  const renderOpsToolCall = (toolCalls: any[]) => {
    if (!toolCalls || toolCalls.length === 0) return null;
    return (
      <div style={{ marginBottom: 6 }}>
        {toolCalls.map((entry: any, idx: number) => {
          const hasResult = entry.result !== undefined;
          const isSuccess = !entry.error && entry.result?.success !== false;
          const label = TOOL_LABELS[entry.name] || entry.name;
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', marginBottom: 3,
              background: hasResult ? (isSuccess ? '#f6ffed' : '#fff2f0') : '#f8f8f8',
              borderRadius: 6, fontSize: 11,
            }}>
              {hasResult ? (
                <Tag color={isSuccess ? 'success' : 'error'} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                  {isSuccess ? '完成' : '异常'}
                </Tag>
              ) : (
                <LoadingOutlined style={{ color: '#2f6f68', fontSize: 10 }} />
              )}
              <span style={{ color: '#333', fontWeight: 500 }}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── 运营助手消息内容渲染（Markdown + 图表） ── */
  const renderOpsContent = (content: string) => {
    if (!content) return null;
    const { cleanContent, charts } = extractCharts(content);
    return (
      <>
        <div className="chat-markdown-body" style={{ fontSize: 13 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{cleanContent}</ReactMarkdown>
        </div>
        {charts.map(chart => (
          <ChartRenderer key={chart.id} config={chart.config} id={chart.id} />
        ))}
      </>
    );
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
    setStyleImageFile(null);
    setStyleImagePreview('');
    setStyleFormVals({ name: '', description: '', price: 0, difficulty: 'medium',
      category: '', color_tone: '', scene: '', nail_shape: '' });
    setStyleModalOpen(true);
  };

  const openEditStyle = (s: any) => {
    setEditingStyle(s);
    setStyleImageFile(null);
    setStyleImagePreview(s.image_url ? imgUrl(s.image_url) : '');
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
      delete values.is_active;
      let styleId: number | null = null;

      if (editingStyle) {
        await adminAPI.updateStyle(editingStyle.id, { ...values, ...(styleFormVals.is_active !== undefined ? { is_active: styleFormVals.is_active } : {}) });
        styleId = editingStyle.id;
        message.success('款式已更新');
      } else {
        const res = await adminAPI.createStyle(values);
        styleId = res.data.id;
        message.success('款式已创建');
      }

      if (styleImageFile && styleId) {
        try {
          await adminAPI.setStyleImage(styleId, styleImageFile);
          message.success('图片已上传');
        } catch (imgErr: any) {
          message.warning('款式已保存，但图片上传失败，可稍后重新上传');
        }
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
      maskClosable: true,
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

  const clearImagePreview = () => {
    setStyleImageFile(null);
    setStyleImagePreview('');
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
      maskClosable: true,
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

  /* ═══════════════════════════ 时段管理 ═══════════════════════════ */
  const loadTimeSlots = async () => {
    try {
      const res = await adminAPI.getProfile();
      setTimeSlots(res.data.time_slots || []);
    } catch { /* ignore */ }
  };

  const openAddSlot = () => {
    setEditingSlotIdx(null);
    setSlotForm({ start: '09:00', end: '10:00', max_bookings: 2 });
    setSlotModalOpen(true);
  };

  const openEditSlot = (idx: number) => {
    setEditingSlotIdx(idx);
    setSlotForm({ ...timeSlots[idx] });
    setSlotModalOpen(true);
  };

  const onDeleteSlot = (idx: number) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== idx));
    message.info('已移除时段，请点击「保存时段设置」生效');
  };

  const onSubmitSlot = () => {
    if (!slotForm.start || !slotForm.end) {
      message.warning('请填写起止时间');
      return;
    }
    if (slotForm.start >= slotForm.end) {
      message.warning('开始时间必须早于结束时间');
      return;
    }
    if ((slotForm.max_bookings || 0) < 1) {
      message.warning('可预约数至少为 1');
      return;
    }
    if (editingSlotIdx !== null) {
      setTimeSlots(prev => prev.map((s, i) => i === editingSlotIdx ? { ...slotForm } : s));
    } else {
      setTimeSlots(prev => [...prev, { ...slotForm }]);
    }
    setSlotModalOpen(false);
    message.info('请点击「保存时段设置」保存到服务器');
  };

  const onSaveSlots = async () => {
    setSlotSaving(true);
    try {
      await adminAPI.updateProfile({ time_slots: timeSlots });
      message.success('时段设置已保存');
      loadTimeSlots();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
    } finally {
      setSlotSaving(false);
    }
  };
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
      <h2 style={{ color: '#222', marginBottom: 20, fontSize: 22, fontWeight: 700 }}>商家后台</h2>

      <Tabs
        size="large"
        tabBarStyle={{ background: '#fff', borderRadius: 12, padding: '4px 16px 0', border: '1px solid #F0F0F0', marginBottom: 16 }}
        items={[
          /* ════ Tab: 数据概览（全宽） ════ */
          {
            key: 'overview',
            label: '📊 数据概览',
            children: (
              <div>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={6}><Card><Statistic title="总预约" value={overview.total_appointments || 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#2f6f68' }} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="待确认" value={overview.pending_appointments || 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="已完成" value={overview.completed_appointments || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
                  <Col xs={12} sm={6}><Card><Statistic title="总营收" value={overview.total_revenue || 0} prefix="¥" precision={2} valueStyle={{ color: '#2f6f68' }} /></Card></Col>
                </Row>

                {overview.top_styles?.length > 0 && (
                  <Card
                    title={<span><FireOutlined style={{ color: '#2f6f68', marginRight: 6 }} />热门款式 TOP5</span>}
                    size="small"
                    style={{ marginTop: 16, borderRadius: 12 }}
                  >
                    <Table
                      dataSource={overview.top_styles}
                      rowKey="style_name"
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '排名', width: 60, render: (_: any, __: any, i: number) => (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 24, height: 24, borderRadius: '50%',
                            background: i < 3 ? '#2f6f68' : '#f0f0f0',
                            color: i < 3 ? '#fff' : '#666',
                            fontSize: 12, fontWeight: 600,
                          }}>{i + 1}</span>
                        )},
                        { title: '款式', dataIndex: 'style_name' },
                        { title: '预约数', dataIndex: 'appointment_count', render: (v: number) => <span style={{ color: '#2f6f68', fontWeight: 600 }}>{v}</span> },
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
            label: '美甲款式管理',
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
                        style={{ marginRight: 8, borderRadius: 20, borderColor: isActive ? undefined : '#F0F0F0' }}
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

          /* ════ Tab: 时段管理 ════ */
          {
            key: 'slots',
            label: '时段管理',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#888', fontSize: 13 }}>
                    设置每日可预约时段及每个时段的最大预约数，用户预约时将看到这些时段选项。
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button icon={<PlusOutlined />} onClick={openAddSlot}>添加时段</Button>
                    <Button type="primary" icon={<ClockCircleOutlined />} onClick={onSaveSlots} loading={slotSaving}>
                      保存时段设置
                    </Button>
                  </div>
                </div>

                {timeSlots.length === 0 ? (
                  <Empty description="暂无预约时段，点击「添加时段」设置" />
                ) : (
                  <Table
                    dataSource={timeSlots.map((s, i) => ({ ...s, key: i }))}
                    rowKey="key"
                    pagination={false}
                    columns={[
                      {
                        title: '开始时间', dataIndex: 'start', width: 120,
                        render: (v: string) => <Tag color="blue">{v}</Tag>,
                      },
                      {
                        title: '结束时间', dataIndex: 'end', width: 120,
                        render: (v: string) => <Tag color="blue">{v}</Tag>,
                      },
                      {
                        title: '每时段最大预约数', dataIndex: 'max_bookings', width: 160, align: 'center' as const,
                        render: (v: number) => <strong style={{ color: '#2f6f68' }}>{v || '-'}</strong>,
                      },
                      {
                        title: '操作', width: 120,
                        render: (_: any, __: any, idx: number) => (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button size="small" icon={<EditOutlined />} onClick={() => openEditSlot(idx)}>编辑</Button>
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteSlot(idx)}>删除</Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            ),
          },
          /* ════ Tab: 运营助手 AI分析师 ════ */
          {
            key: 'ops',
            label: '运营助手',
            children: (
              <div style={{ display: 'flex', height: 'calc(100vh - 160px)' }}>
                {/* 历史会话侧栏 */}
                <div style={{
                  width: opsSidebarOpen ? 180 : 0,
                  borderRight: opsSidebarOpen ? '1px solid #F0F0F0' : 'none',
                  background: '#FAFAFA',
                  overflow: opsSidebarOpen ? 'auto' : 'hidden',
                  padding: opsSidebarOpen ? '6px 4px' : 0,
                  transition: 'width .25s ease',
                  flexShrink: 0,
                }}>
                  {opsSessions.map((s: any) => (
                    <div key={s.session_key}
                      onClick={() => { if (!opsLoading) setOpsActiveKey(s.session_key); }}
                      style={{
                        cursor: opsLoading ? 'not-allowed' : 'pointer', borderRadius: 6, padding: '6px 8px', marginBottom: 2,
                        background: s.session_key === opsActiveKey ? '#f3f8f4' : 'transparent',
                        color: s.session_key === opsActiveKey ? '#2f6f68' : '#666',
                        fontSize: 12, transition: 'all .15s',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        opacity: opsLoading ? 0.5 : 1,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {s.title || '新对话'}
                      </span>
                      <DeleteOutlined style={{ fontSize: 10, color: '#ccc', marginLeft: 4, flexShrink: 0 }}
                        onClick={(e) => { e.stopPropagation(); deleteOpsSession(s.session_key); }} />
                    </div>
                  ))}
                  {opsSessions.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#ccc', fontSize: 11, marginTop: 20 }}>暂无历史</div>
                  )}
                </div>

                {/* 对话主区域 */}
                <Card
                  title={(
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span><RobotOutlined style={{ marginRight: 6, color: '#2f6f68' }} />运营助手 · AI分析师</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="small" type="link" onClick={() => setOpsSidebarOpen(!opsSidebarOpen)}>
                          {opsSidebarOpen ? '收起' : '历史'}
                        </Button>
                        <Button size="small" type="link" icon={<PlusOutlined />} onClick={newOpsChat}>新对话</Button>
                      </div>
                    </div>
                  )}
                  size="small"
                  style={{ borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column' }}
                  styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
                >
                  <div ref={opsChatRef} style={{
                    flex: 1, overflow: 'auto', padding: '12px 16px',
                    background: '#FAFAFA',
                  }}>
                    {allOpsMessages.length === 0 && (
                      <div style={{ textAlign: 'center', marginTop: 60, color: '#bbb', fontSize: 13 }}>
                        <div className="morphing-blob" style={{ width: 60, height: 60, margin: '0 auto 16px' }} />
                        <div style={{ color: '#999', fontWeight: 500, marginBottom: 8 }}>运营AI助手</div>
                        <div>问我运营数据、热门款式、营收趋势...</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, alignItems: 'center' }}>
                          {OPS_SUGGESTIONS.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => { setOpsInput(''); opsSend(s); }}
                              style={{
                                padding: '6px 16px', borderRadius: 16,
                                border: '1px solid #eee', background: '#fff',
                                color: '#2f6f68', fontSize: 12, cursor: 'pointer',
                                transition: 'all .2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f8f8f8'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {allOpsMessages.map((m, i) => (
                      <div key={i} style={{
                        marginBottom: 12, display: 'flex', gap: 8,
                        flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                      }}>
                        <Avatar icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                          size={28}
                          style={{
                            backgroundColor: m.role === 'user' ? '#E8E8E8' : '#eee',
                            color: m.role === 'user' ? '#555' : '#2f6f68',
                            flexShrink: 0,
                          }} />
                        <div style={{ maxWidth: '80%' }}>
                          {m.tool_calls && renderOpsToolCall(m.tool_calls)}
                          <div style={{
                            background: m.role === 'user' ? '#e8e8e8' : '#fff',
                            color: m.role === 'user' ? '#222' : '#333',
                            padding: '8px 14px', borderRadius: 10,
                            fontSize: 13, lineHeight: 1.6,
                            border: m.role === 'assistant' ? '1px solid #F0F0F0' : 'none',
                          }}>
                            {m.role === 'user' ? m.content : renderOpsContent(m.content)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {opsLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar icon={<RobotOutlined />} size={28} style={{ backgroundColor: '#eee', color: '#2f6f68' }} />
                        <Spin indicator={<LoadingOutlined style={{ color: '#2f6f68' }} spin />} size="small" />
                        <span style={{ fontSize: 12, color: '#2f6f68' }}>分析中...</span>
                      </div>
                    )}
                  </div>
                  {!opsLoading && allOpsMessages.length > 0 && allOpsMessages.length <= 2 && (
                    <div style={{
                      display: 'flex', gap: 6, padding: '8px 14px 0',
                      flexWrap: 'wrap',
                    }}>
                      {OPS_SUGGESTIONS.slice(0, 3).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setOpsInput(''); opsSend(s); }}
                          style={{
                            padding: '3px 10px', borderRadius: 12,
                            border: '1px solid #eee', background: '#fff',
                            color: '#2f6f68', fontSize: 11, cursor: 'pointer',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{
                    padding: '10px 14px', borderTop: '1px solid #f0f0f0',
                    display: 'flex', gap: 8, alignItems: 'flex-end',
                  }}>
                    <Input.TextArea
                      value={opsInput}
                      onChange={e => setOpsInput(e.target.value)}
                      onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); onOpsSend(); } }}
                      placeholder="问运营数据..."
                      autoSize={{ minRows: 1, maxRows: 3 }}
                      style={{ borderRadius: 8, fontSize: 13, borderColor: '#eee' }}
                    />
                    <Button type="primary" icon={<SendOutlined />} onClick={onOpsSend}
                      loading={opsLoading} style={{ borderRadius: 8 }}>发送</Button>
                  </div>
                </Card>
              </div>
            ),
          },
        ]}
        onChange={(key) => {
          if (key === 'styles') loadStyles();
          if (key === 'appointments') loadAppts();
          if (key === 'slots') loadTimeSlots();
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
        maskClosable
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
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>款式图片</label>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                if (!file.type.startsWith('image/')) {
                  message.error('仅支持图片文件');
                  return false;
                }
                setStyleImageFile(file);
                const reader = new FileReader();
                reader.onload = (e) => setStyleImagePreview(e.target?.result as string);
                reader.readAsDataURL(file);
                return false;
              }}
            >
              {styleImagePreview ? (
                <img src={styleImagePreview} alt="preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1px solid #e8e8e8' }} />
              ) : (
                <div style={{
                  width: 120, height: 120, border: '2px dashed #ddd', borderRadius: 8,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#999', transition: 'border-color .2s',
                }}>
                  <UploadOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                  <span style={{ fontSize: 12 }}>上传图片</span>
                </div>
              )}
            </Upload>
          </div>
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

      {/* ════ 时段编辑 Modal ════ */}
      <Modal
        title={editingSlotIdx !== null ? '编辑时段' : '添加时段'}
        open={slotModalOpen}
        onCancel={() => setSlotModalOpen(false)}
        onOk={onSubmitSlot}
        okText="确定"
        cancelText="取消"
        maskClosable
        width={400}
        destroyOnHidden
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>开始时间</label>
              <TimePicker
                value={slotForm.start ? dayjs(slotForm.start, 'HH:mm') : null}
                onChange={(t) => setSlotForm({ ...slotForm, start: t ? t.format('HH:mm') : '' })}
                format="HH:mm"
                minuteStep={5}
                style={{ width: '100%', borderRadius: 8 }}
                placeholder="选择开始时间"
              />
            </Col>
            <Col span={12}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>结束时间</label>
              <TimePicker
                value={slotForm.end ? dayjs(slotForm.end, 'HH:mm') : null}
                onChange={(t) => setSlotForm({ ...slotForm, end: t ? t.format('HH:mm') : '' })}
                format="HH:mm"
                minuteStep={5}
                style={{ width: '100%', borderRadius: 8 }}
                placeholder="选择结束时间"
              />
            </Col>
          </Row>
          <div>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>该时段最大预约数</label>
            <InputNumber
              value={slotForm.max_bookings}
              onChange={v => setSlotForm({ ...slotForm, max_bookings: v || 1 })}
              min={1}
              max={999}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ color: '#999', fontSize: 12 }}>
            例如设置 09:00-10:00 最大 2 人，则该时段超过 2 人预约后将显示「已满」。
          </div>
        </div>
      </Modal>
    </div>
  );
}

