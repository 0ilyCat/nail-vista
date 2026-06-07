/**
 * 用户中心 — 侧边栏 + 多Tab内容区
 * Tab: 个人信息 | 我的预约 | 我的收藏 | 我的帖子 | 账号安全
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Button, Upload, Avatar, Tabs, Spin, Empty,
  List, Tag, Statistic, Row, Col, Modal, message, Descriptions,
} from 'antd';
import {
  UserOutlined, UploadOutlined, CalendarOutlined, HeartOutlined,
  EditOutlined, LockOutlined, LogoutOutlined, ShopOutlined,
  PictureOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { authAPI, appointmentsAPI, favoritesAPI, postsAPI } from '../services/api';
import { imgUrl } from '../services/image';

/* ───────── 状态标签映射 ───────── */
const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  pending:    { color: 'orange',  icon: <ClockCircleOutlined />,     text: '待确认' },
  confirmed:  { color: 'blue',    icon: <CheckCircleOutlined />,     text: '已确认' },
  completed:  { color: 'green',   icon: <CheckCircleOutlined />,     text: '已完成' },
  cancelled:  { color: '#999',    icon: <CloseCircleOutlined />,     text: '已取消' },
};

export default function ProfilePage() {
  const nav = useNavigate();

  /* ──────── 全局状态 ──────── */
  const [user, setUser]       = useState<any>(null);
  const [stats, setStats]     = useState<any>({});
  const [loading, setLoading] = useState(true);

  /* ──────── 个人信息表单 ──────── */
  const [saving, setSaving]       = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  /* ──────── 预约 ──────── */
  const [appts, setAppts]         = useState<any[]>([]);
  const [apptsLoading, setApptsLoading] = useState(false);

  /* ──────── 收藏 ──────── */
  const [favStyles, setFavStyles]     = useState<any[]>([]);
  const [favMerchants, setFavMerchants] = useState<any[]>([]);
  const [favsLoading, setFavsLoading] = useState(false);

  /* ──────── 我的帖子 ──────── */
  const [myPosts, setMyPosts]         = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  /* ──────── 密码修改 ──────── */
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [pwdChanging, setPwdChanging] = useState(false);
  const [pwdForm] = Form.useForm();

  /* ═══════════════════════════ 初始化 ═══════════════════════════ */
  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { nav('/login'); return; }
    const parsed = JSON.parse(u);
    setUser(parsed);
    loadAll(parsed.id);
  }, []);

  const loadAll = async (userId: number) => {
    setLoading(true);
    try {
      const [statsRes] = await Promise.allSettled([authAPI.getStats()]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
    } catch { /* stats fetch optional */ }
    setLoading(false);
    // 默认不预加载其他 tab 数据，切换时加载
  };

  /* ═══════════════════════════ 头像上传 ═══════════════════════════ */
  const onAvatarUpload = async (file: File) => {
    setAvatarUploading(true);
    try {
      const res = await authAPI.uploadAvatar(file);
      const avatarUrl = res.data.avatar_url;
      const updated = { ...user, avatar_url: avatarUrl };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      message.success('头像已更新');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '头像上传失败');
    } finally { setAvatarUploading(false); }
    return false;
  };

  /* ═══════════════════════════ 个人信息保存 ═══════════════════════════ */
  const onSaveProfile = async (values: any) => {
    setSaving(true);
    try {
      const res = await authAPI.updateMe(values);
      const updated = res.data;
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      message.success('个人信息已保存');
    } catch (e: any) {
      message.error(e.response?.data?.detail || '保存失败');
    } finally { setSaving(false); }
  };

  /* ═══════════════════════════ Tab 数据加载 ═══════════════════════════ */
  const loadAppointments = async () => {
    if (appts.length > 0) return;
    setApptsLoading(true);
    try {
      const res = await appointmentsAPI.list({ page_size: 10 });
      setAppts(res.data.items || []);
    } catch { message.error('预约数据加载失败'); }
    finally { setApptsLoading(false); }
  };

  const loadFavorites = async () => {
    if (favStyles.length > 0 || favMerchants.length > 0) return;
    setFavsLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        favoritesAPI.listStyles({ page_size: 6 }),
        favoritesAPI.listMerchants({ page_size: 6 }),
      ]);
      setFavStyles(sRes.data.items || []);
      setFavMerchants(mRes.data.items || []);
    } catch { message.error('收藏数据加载失败'); }
    finally { setFavsLoading(false); }
  };

  const loadMyPosts = async () => {
    if (myPosts.length > 0) return;
    setPostsLoading(true);
    try {
      const res = await postsAPI.list({ user_id: user.id, page_size: 10 });
      setMyPosts(res.data.items || []);
    } catch { message.error('帖子数据加载失败'); }
    finally { setPostsLoading(false); }
  };

  /* ═══════════════════════════ 密码修改 ═══════════════════════════ */
  const onChangePassword = async (values: any) => {
    setPwdChanging(true);
    try {
      await authAPI.changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      message.success('密码修改成功，请重新登录');
      pwdForm.resetFields();
      setPwdModalOpen(false);
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        nav('/login');
      }, 1500);
    } catch (e: any) {
      message.error(e.response?.data?.detail || '密码修改失败');
    } finally { setPwdChanging(false); }
  };

  /* ═══════════════════════════ 登出 ═══════════════════════════ */
  const onLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    nav('/');
  };

  /* ═══════════════════════════ 取消预约 ═══════════════════════════ */
  const onCancelAppt = async (id: number) => {
    Modal.confirm({
      title: '确认取消',
      icon: <ExclamationCircleOutlined />,
      content: '确定要取消该预约吗？',
      okText: '确定',
      cancelText: '返回',
      onOk: async () => {
        try {
          await appointmentsAPI.cancel(id);
          message.success('预约已取消');
          setAppts(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
        } catch (e: any) {
          message.error('取消失败');
        }
      },
    });
  };

  /* ═══════════════════════════ 删除帖子 ═══════════════════════════ */
  const onDeletePost = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '帖子删除后无法恢复，确定删除？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await postsAPI.delete(id);
          message.success('帖子已删除');
          setMyPosts(prev => prev.filter(p => p.id !== id));
        } catch (e: any) {
          message.error('删除失败');
        }
      },
    });
  };

  /* ═══════════════════════════ 加载态 ═══════════════════════════ */
  if (!user) {
    return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;
  }

  const roleLabel = user.role === 'merchant' ? '商家' : '普通用户';

  /* ──────── 侧边栏 ──────── */
  const sidebar = (
    <div style={{ width: 272, flexShrink: 0 }}>
      {/* 用户卡片 */}
      <Card
        style={{ borderRadius: 12, marginBottom: 16, textAlign: 'center', border: '1px solid #d8e8df' }}
        styles={{ body: { padding: '28px 20px 20px' } }}
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            size={88}
            src={imgUrl(user.avatar_url)}
            icon={<UserOutlined />}
            style={{ border: '3px solid #f3f8f4' }}
          />
          <Upload beforeUpload={onAvatarUpload} showUploadList={false} accept="image/*">
            <Button
              shape="circle"
              size="small"
              icon={<UploadOutlined />}
              loading={avatarUploading}
              style={{
                position: 'absolute', bottom: -4, right: -4,
                backgroundColor: '#2f6f68', color: '#fff', border: '2px solid #fff',
              }}
            />
          </Upload>
        </div>
        <h3 style={{ margin: '14px 0 4px', fontSize: 18, color: '#333' }}>{user.nickname || user.username}</h3>
        <Tag color="#2f6f68" style={{ borderRadius: 10 }}>{roleLabel}</Tag>
        <div style={{ marginTop: 6, color: '#999', fontSize: 13 }}>
          @{user.username}
        </div>
      </Card>

      {/* 统计卡片 */}
      <Card style={{ borderRadius: 12, marginBottom: 16, border: '1px solid #d8e8df' }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[0, 16]}>
          <Col span={12} style={{ textAlign: 'center' }}>
            <Statistic title="预约" value={stats.appointment_count || 0} valueStyle={{ fontSize: 22, color: '#2f6f68' }} prefix={<CalendarOutlined />} />
          </Col>
          <Col span={12} style={{ textAlign: 'center' }}>
            <Statistic title="帖子" value={stats.post_count || 0} valueStyle={{ fontSize: 22, color: '#2f6f68' }} prefix={<EditOutlined />} />
          </Col>
          <Col span={12} style={{ textAlign: 'center' }}>
            <Statistic title="收藏款式" value={stats.favorite_style_count || 0} valueStyle={{ fontSize: 22, color: '#2f6f68' }} prefix={<HeartOutlined />} />
          </Col>
          <Col span={12} style={{ textAlign: 'center' }}>
            <Statistic title="收藏商家" value={stats.favorite_merchant_count || 0} valueStyle={{ fontSize: 22, color: '#2f6f68' }} prefix={<ShopOutlined />} />
          </Col>
        </Row>
      </Card>

      {/* 快捷入口 */}
      <Card style={{ borderRadius: 12, border: '1px solid #d8e8df' }} styles={{ body: { padding: 0 } }}>
        {[
          { icon: <CalendarOutlined />, label: '我的预约', onClick: () => nav('/appointments') },
          { icon: <HeartOutlined />, label: '我的收藏', onClick: () => nav('/favorites') },
          { icon: <EditOutlined />, label: '发布帖子', onClick: () => nav('/community') },
        ].map((item, i) => (
          <div
            key={i}
            onClick={item.onClick}
            style={{
              padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: i < 2 ? '1px solid #f3f8f4' : 'none',
              color: '#555', fontSize: 14, transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f8f4')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            <span style={{ color: '#2f6f68', fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </Card>
    </div>
  );

  /* ──────── Tab: 个人信息 ──────── */
  const tabProfile = (
    <Card title="编辑个人信息" style={{ borderRadius: 12, border: '1px solid #d8e8df' }}>
      <Form
        layout="vertical"
        initialValues={{
          nickname: user.nickname,
          bio: user.bio || '',
          phone: user.phone || '',
          email: user.email || '',
        }}
        onFinish={onSaveProfile}
      >
        <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
          <Input maxLength={32} />
        </Form.Item>
        <Form.Item name="bio" label="个人简介">
          <Input.TextArea rows={3} maxLength={200} showCount placeholder="介绍一下自己..." />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="phone" label="手机号">
              <Input maxLength={20} placeholder="用于预约联系" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="邮箱">
              <Input maxLength={64} placeholder="用于通知接收" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block style={{ height: 40, borderRadius: 8 }}>
            保存修改
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

  /* ──────── Tab: 我的预约 ──────── */
  const tabAppointments = (
    loading || apptsLoading ? (
      <Spin style={{ display: 'block', margin: '60px auto' }} />
    ) : appts.length === 0 ? (
      <Empty description="暂无预约记录" style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => nav('/merchants')}>去逛逛</Button>
      </Empty>
    ) : (
      <List
        dataSource={appts}
        renderItem={(a: any) => {
          const st = statusMap[a.status] || statusMap.pending;
          return (
            <List.Item
              extra={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#2f6f68' }}>
                    ¥{a.price?.toFixed(0) || 0}
                  </div>
                  {a.status === 'pending' && (
                    <Button size="small" danger style={{ marginTop: 4 }} onClick={() => onCancelAppt(a.id)}>
                      取消预约
                    </Button>
                  )}
                </div>
              }
            >
              <List.Item.Meta
                avatar={
                  <Avatar shape="square" size={56} src={imgUrl(a.style_image)}
                    icon={<PictureOutlined />} style={{ borderRadius: 8 }} />
                }
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{a.service_item || a.style_name || '美甲服务'}</span>
                    <Tag color={st.color} icon={st.icon}>{st.text}</Tag>
                  </div>
                }
                description={
                  <div style={{ color: '#888', fontSize: 13 }}>
                    <div>{a.merchant_name}</div>
                    <div>
                      {a.appointment_time
                        ? new Date(a.appointment_time).toLocaleString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '时间待定'}
                    </div>
                  </div>
                }
              />
            </List.Item>
          );
        }}
        style={{ background: '#fff', borderRadius: 12, padding: '8px 20px', border: '1px solid #d8e8df' }}
      />
    )
  );

  /* ──────── Tab: 我的收藏 ──────── */
  const tabFavorites = (
    favsLoading ? (
      <Spin style={{ display: 'block', margin: '60px auto' }} />
    ) : (favStyles.length === 0 && favMerchants.length === 0) ? (
      <Empty description="暂无收藏" style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => nav('/')}>去发现</Button>
      </Empty>
    ) : (
      <div>
        {favStyles.length > 0 && (
          <Card title="收藏的款式" size="small" style={{ borderRadius: 12, marginBottom: 16, border: '1px solid #d8e8df' }}
            extra={<a onClick={() => nav('/favorites')} style={{ color: '#2f6f68' }}>查看全部</a>}>
            <Row gutter={[12, 12]}>
              {favStyles.slice(0, 6).map((s: any) => (
                <Col key={s.id} xs={12} sm={8} md={6}>
                  <div
                    onClick={() => nav(`/styles/${s.id}`)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid #d8e8df', transition: 'transform .2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}
                  >
                    <div style={{ height: 120, background: '#f3f8f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={imgUrl(s.image_url)} alt={s.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ padding: '8px 10px', background: '#fff' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 13, color: '#2f6f68', fontWeight: 600 }}>
                        ¥{s.price?.toFixed(0) || 0}
                      </div>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}
        {favMerchants.length > 0 && (
          <Card title="收藏的商家" size="small" style={{ borderRadius: 12, border: '1px solid #d8e8df' }}
            extra={<a onClick={() => nav('/favorites')} style={{ color: '#2f6f68' }}>查看全部</a>}>
            <Row gutter={[12, 12]}>
              {favMerchants.slice(0, 6).map((m: any) => (
                <Col key={m.id} xs={12} sm={8} md={6}>
                  <div
                    onClick={() => nav(`/merchants/${m.id}`)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid #d8e8df', textAlign: 'center', padding: '16px 10px',
                      transition: 'transform .2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}
                  >
                    <Avatar size={48} src={imgUrl(m.logo_url)} icon={<ShopOutlined />}
                      style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{m.city} {m.district}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </div>
    )
  );

  /* ──────── Tab: 我的帖子 ──────── */
  const tabPosts = (
    postsLoading ? (
      <Spin style={{ display: 'block', margin: '60px auto' }} />
    ) : myPosts.length === 0 ? (
      <Empty description="暂无发布帖子" style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => nav('/community')}>去灵感广场</Button>
      </Empty>
    ) : (
      <List
        dataSource={myPosts}
        renderItem={(p: any) => (
          <List.Item
            extra={
              <Button size="small" danger onClick={() => onDeletePost(p.id)}>删除</Button>
            }
            style={{ cursor: 'pointer' }}
            onClick={() => nav(`/community/post/${p.id}`)}
          >
            <List.Item.Meta
              avatar={
                p.image_url ? (
                  <Avatar shape="square" size={56} src={imgUrl(p.image_url)}
                    style={{ borderRadius: 8 }} />
                ) : (
                  <Avatar shape="square" size={56} icon={<PictureOutlined />}
                    style={{ borderRadius: 8, backgroundColor: '#f3f8f4' }} />
                )
              }
              title={<span style={{ fontWeight: 600 }}>{p.title}</span>}
              description={
                <div style={{ color: '#888', fontSize: 13 }}>
                  <span>{p.likes_count || 0} 赞</span>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <span>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                  {p.style_name && <><span style={{ margin: '0 8px' }}>·</span><span>{p.style_name}</span></>}
                </div>
              }
            />
          </List.Item>
        )}
        style={{ background: '#fff', borderRadius: 12, padding: '8px 20px', border: '1px solid #d8e8df' }}
      />
    )
  );

  /* ──────── Tab: 账号安全 ──────── */
  const tabSecurity = (
    <Card title="账号安全" style={{ borderRadius: 12, border: '1px solid #d8e8df' }}>
      <Descriptions column={1} size="middle" styles={{ label: { fontWeight: 500, color: '#555', width: 100 } }}>
        <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
        <Descriptions.Item label="角色">{roleLabel}</Descriptions.Item>
        <Descriptions.Item label="注册时间">
          {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="登录密码">
          <Button icon={<LockOutlined />} onClick={() => setPwdModalOpen(true)} style={{ color: '#2f6f68', borderColor: '#2f6f68' }}>
            修改密码
          </Button>
        </Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #d8e8df' }}>
        <Button
          danger
          icon={<LogoutOutlined />}
          onClick={onLogout}
          size="large"
          style={{ borderRadius: 8 }}
        >
          退出登录
        </Button>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          退出后将跳转到首页，可随时重新登录
        </div>
      </div>
    </Card>
  );

  /* ═══════════════════════════ 主布局 ═══════════════════════════ */
  const tabItems = [
    { key: 'profile',      label: '个人信息',   children: tabProfile },
    { key: 'appointments', label: '我的预约',   children: tabAppointments },
    { key: 'favorites',    label: '我的收藏',   children: tabFavorites },
    { key: 'posts',        label: '我的帖子',   children: tabPosts },
    { key: 'security',     label: '账号安全',   children: tabSecurity },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* 左侧边栏 */}
      {sidebar}

      {/* 右侧内容 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Tabs
          items={tabItems}
          size="large"
          tabBarStyle={{ marginBottom: 16, background: '#fff', borderRadius: 12, padding: '4px 16px 0', border: '1px solid #d8e8df' }}
          onChange={(key) => {
            if (key === 'appointments') loadAppointments();
            if (key === 'favorites') loadFavorites();
            if (key === 'posts') loadMyPosts();
          }}
        />
      </div>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={pwdModalOpen}
        onCancel={() => { setPwdModalOpen(false); pwdForm.resetFields(); }}
        footer={null}
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical" onFinish={onChangePassword}>
          <Form.Item
            name="old_password"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="输入原密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password placeholder="输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码输入不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={pwdChanging} block style={{ height: 40, borderRadius: 8 }}>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

