import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Input, Button, Dropdown, Avatar, Space } from 'antd';
import {
  HomeOutlined, CompassOutlined, ExperimentOutlined, MessageOutlined,
  ShopOutlined, UserOutlined, HeartOutlined, DashboardOutlined,
  CalendarOutlined, LogoutOutlined, LoginOutlined, HighlightOutlined,
} from '@ant-design/icons';
import { imgUrl } from '../services/image';

const { Header, Content, Footer } = Layout;

export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState<any>(null);
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => {
    const syncUser = () => {
      const u = localStorage.getItem('user');
      setUser(u ? JSON.parse(u) : null);
    };
    syncUser();
    // 监听其他标签页 / 组件对 localStorage 的修改
    window.addEventListener('storage', syncUser);
    // Profile 等页面更新头像后手动触发自定义事件
    window.addEventListener('userUpdated', syncUser);
    return () => {
      window.removeEventListener('storage', syncUser);
      window.removeEventListener('userUpdated', syncUser);
    };
  }, []);

  const onLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    nav('/');
  };

  const onSearch = () => {
    if (searchVal.trim()) nav(`/search?q=${encodeURIComponent(searchVal.trim())}`);
  };

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
    { key: '/tryon', icon: <ExperimentOutlined />, label: <Link to="/tryon">AI美甲试戴</Link> },
    { key: '/chat', icon: <MessageOutlined />, label: <Link to="/chat">小美对话</Link> },
    { key: '/community', icon: <CompassOutlined />, label: <Link to="/community">灵感广场</Link> },
    { key: '/merchants', icon: <ShopOutlined />, label: <Link to="/merchants">店家专区</Link> },
  ];

  return (
    <Layout className="nv-shell">
      <Header className="nv-header">
        <Link to="/" className="nv-brand">
          <span className="nv-brand-mark"><HighlightOutlined /></span>
          <span>NailVista</span>
        </Link>

        <Menu
          mode="horizontal"
          selectedKeys={[loc.pathname]}
          items={menuItems}
          style={{ flex: 1, border: 'none' }}
        />

        <Space>
          <Input.Search
            className="nv-search"
            size="middle"
            placeholder="搜索美甲、帖子、商家..."
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onSearch={onSearch}
          />

          {user ? (
            <>
              <Button shape="circle" icon={<HeartOutlined />} onClick={() => nav('/favorites')} />
              {user.role === 'merchant' && (
                <>
                  <Button shape="circle" icon={<DashboardOutlined />} onClick={() => nav('/dashboard')} />
                  <Button size="small" onClick={() => nav('/merchant/join')}>
                    入驻
                  </Button>
                </>
              )}
              <Button shape="circle" icon={<CalendarOutlined />} onClick={() => nav('/appointments')} />
              <Dropdown menu={{ items: [
                { key: 'profile', label: '用户中心', icon: <UserOutlined />, onClick: () => nav('/profile') },
                { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: onLogout },
              ]}}>
                <Avatar
                  src={imgUrl(user.avatar_url)}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#d9d9d9', cursor: 'pointer', color: '#999' }}
                />
              </Dropdown>
            </>
          ) : (
            <Button type="primary" icon={<LoginOutlined />} onClick={() => nav('/login')}>
              登录
            </Button>
          )}
        </Space>
      </Header>

      <Content className="nv-content">
        <Outlet />
      </Content>

      <Footer className="nv-footer">
        NailVista 2026 | AI 美甲试戴平台
      </Footer>
    </Layout>
  );
}

