import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Input, Button, Dropdown, Avatar, Space } from 'antd';
import {
  HomeOutlined, CompassOutlined, ExperimentOutlined, MessageOutlined,
  ShopOutlined, UserOutlined, HeartOutlined, DashboardOutlined,
  CalendarOutlined, SearchOutlined, LogoutOutlined, LoginOutlined,
} from '@ant-design/icons';
import { imgUrl } from '../services/image';

const { Header, Content, Footer } = Layout;

export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [user, setUser] = useState<any>(null);
  const [searchVal, setSearchVal] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

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
    <Layout style={{ minHeight: '100vh', background: '#FAFAFA' }}>
      <Header style={{
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        borderBottom: '1px solid rgba(240, 240, 240, 0.6)',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}>
        <Link to="/" className="logo-brand">
          NailVista
        </Link>

        <Menu
          mode="horizontal"
          selectedKeys={[loc.pathname]}
          items={menuItems}
          className="main-nav-menu"
          style={{
            flex: 1,
            border: 'none',
            fontSize: 15,
            fontWeight: 500,
            background: 'transparent',
          }}
        />

        <Space size={12}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: searchFocused ? '#fff' : '#f5f5f5',
            borderRadius: 24,
            padding: '2px 2px 2px 16px',
            border: searchFocused ? '1.5px solid #E8708D' : '1.5px solid transparent',
            transition: 'all .25s cubic-bezier(0.4, 0, 0.2, 1)',
            width: searchFocused ? 280 : 220,
          }}>
            <SearchOutlined style={{ color: '#999', fontSize: 15 }} />
            <Input
                size="middle"
                placeholder="搜索美甲、帖子、商家..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onPressEnter={onSearch}
                variant="borderless"
                style={{ background: 'transparent' }}
              />
          </div>

          {user ? (
            <>
              <Button
                shape="circle"
                icon={<HeartOutlined />}
                onClick={() => nav('/favorites')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#666',
                  transition: 'all .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              />
              {user.role === 'merchant' && (
                <Button
                  shape="circle"
                  icon={<DashboardOutlined />}
                  onClick={() => nav('/dashboard')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#666',
                    transition: 'all .2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                />
              )}
              <Button
                shape="circle"
                icon={<CalendarOutlined />}
                onClick={() => nav('/appointments')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#666',
                  transition: 'all .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              />
              <Dropdown menu={{ items: [
                { key: 'profile', label: '用户中心', icon: <UserOutlined />, onClick: () => nav('/profile') },
                { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, onClick: onLogout },
              ]}}>
              <div className="avatar-hover" style={{ display: 'inline-block', cursor: 'pointer', transition: 'transform .2s' }}>
                <Avatar src={user.avatar_url ? imgUrl(user.avatar_url) : undefined} icon={<UserOutlined />} style={{ backgroundColor: '#e0e0e0', color: '#999' }} />
              </div>
              </Dropdown>
            </>
          ) : (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={() => nav('/login')}
              style={{ borderRadius: 20, paddingInline: 20 }}
            >
              登录
            </Button>
          )}
        </Space>
      </Header>

      <Content style={{ padding: '0 28px', minHeight: 'calc(100vh - 128px)' }}>
        <Outlet />
      </Content>

      <Footer style={{
        textAlign: 'center',
        background: '#fff',
        borderTop: '1px solid #F0F0F0',
        color: '#999',
        fontSize: 13,
        padding: '20px 0',
      }}>
        NailVista ©2026 · AI美甲试戴平台
      </Footer>
    </Layout>
  );
}
