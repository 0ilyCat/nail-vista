import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Input, Button, Dropdown, Avatar, Space, Badge } from 'antd';
import {
  HomeOutlined, CompassOutlined, ExperimentOutlined, MessageOutlined,
  ShopOutlined, UserOutlined, HeartOutlined, DashboardOutlined,
  CalendarOutlined, SearchOutlined, LogoutOutlined, LoginOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer } = Layout;

export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState<any>(null);
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) setUser(JSON.parse(u));
  }, [loc.pathname]);

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
    <Layout style={{ minHeight: '100vh', background: '#fdf2f4' }}>
      <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid #f0d6dc', height: 64, position: 'sticky', top: 0, zIndex: 100 }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: 20, color: '#c77986', marginRight: 32, whiteSpace: 'nowrap' }}>
          💅 NailVista
        </Link>
        <Menu mode="horizontal" selectedKeys={[loc.pathname]} items={menuItems} style={{ flex: 1, border: 'none' }} />
        <Space>
          <Input.Search size="middle" placeholder="搜索美甲、帖子、商家..." value={searchVal}
            onChange={e => setSearchVal(e.target.value)} onSearch={onSearch}
            style={{ width: 220 }}
          />
          {user ? (
            <>
              <Button shape="circle" icon={<HeartOutlined />} onClick={() => nav('/favorites')} />
              {user.role === 'merchant' && (
                <>
                  <Button shape="circle" icon={<DashboardOutlined />} onClick={() => nav('/dashboard')} />
                  <Button size="small" onClick={() => nav('/merchant/join')} style={{ color: '#c77986', borderColor: '#c77986' }}>入驻</Button>
                </>
              )}
              <Button shape="circle" icon={<CalendarOutlined />} onClick={() => nav('/appointments')} />
              <Dropdown menu={{ items: [
                { key: 'profile', label: '用户中心', icon: <UserOutlined />, onClick: () => nav('/profile') },
                { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: onLogout },
              ]}}>
                <Avatar style={{ backgroundColor: '#c77986', cursor: 'pointer' }}>{user.nickname?.[0]}</Avatar>
              </Dropdown>
            </>
          ) : (
            <Button type="primary" icon={<LoginOutlined />} onClick={() => nav('/login')}>登录</Button>
          )}
        </Space>
      </Header>
      <Content style={{ padding: '0 24px', minHeight: 'calc(100vh - 128px)' }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: 'center', background: '#fff', borderTop: '1px solid #f0d6dc', color: '#999' }}>
        NailVista ©2026 · AI美甲试戴平台
      </Footer>

    </Layout>
  );
}
