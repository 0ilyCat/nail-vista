import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Tag, Badge } from 'antd';
import {
  ExperimentOutlined, AppstoreOutlined, DashboardOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getOverview } from '../../services/api';

const { Header, Content, Sider } = Layout;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [todayTryons, setTodayTryons] = useState(0);

  useEffect(() => {
    getOverview().then(d => setTodayTryons(d.today_tryons)).catch(() => {});
    const timer = setInterval(() => {
      getOverview().then(d => setTodayTryons(d.today_tryons)).catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const menuItems: NavItem[] = [
    { key: '/', icon: <HomeOutlined />, label: '首页' },
    { key: '/tryon', icon: <ExperimentOutlined />, label: 'AI 试戴' },
    { key: '/styles', icon: <AppstoreOutlined />, label: '款式浏览' },
    { key: '/dashboard', icon: <DashboardOutlined />, label: '运营看板', badge: todayTryons },
  ];

  const currentLabel = menuItems.find(i => i.key === location.pathname)?.label || '';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
        breakpoint="lg"
        collapsedWidth={0}
      >
        <div
          onClick={() => navigate('/')}
          style={{
            height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 17, color: 'var(--primary)',
            borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          <span style={{ marginRight: 6, fontSize: 20 }}>💅</span>
          美甲AI试戴
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{ borderRight: 0, paddingTop: 8 }}
          onClick={({ key }) => navigate(key)}
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: (
              <span>
                {item.label}
                {item.badge ? (
                  <Tag color="pink" style={{ marginLeft: 8, fontSize: 11, lineHeight: '16px' }}>
                    {item.badge}
                  </Tag>
                ) : null}
              </span>
            ),
          }))}
        />
        <div style={{
          position: 'absolute', bottom: 16, left: 16, right: 16,
          padding: 12, background: '#fafafa', borderRadius: 8, fontSize: 12, color: '#999',
        }}>
          <div style={{ marginBottom: 4, fontWeight: 600, color: '#666' }}>MiMo AI 驱动</div>
          <div>mimo-v2.5 · Token Plan</div>
        </div>
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid #f0f0f0', height: 56,
        }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#333' }}>
            {currentLabel}
          </span>
          {location.pathname !== '/' && (
            <span style={{ marginLeft: 16, fontSize: 12, color: '#bbb' }}>
              / {currentLabel}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge status="processing" text="系统运行中" />
          </div>
        </Header>
        <Content style={{ margin: 16, minHeight: 360 }}>
          <div className="page-enter">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
