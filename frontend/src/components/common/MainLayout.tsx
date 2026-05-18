import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { ExperimentOutlined, AppstoreOutlined, DashboardOutlined } from '@ant-design/icons';

const { Header, Content, Sider } = Layout;

const menuItems = [
  { key: '/tryon', icon: <ExperimentOutlined />, label: 'AI 试戴' },
  { key: '/styles', icon: <AppstoreOutlined />, label: '款式浏览' },
  { key: '/dashboard', icon: <DashboardOutlined />, label: '运营看板' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#fff' }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 'bold', fontSize: 16, color: '#ff69b4', borderBottom: '1px solid #f0f0f0'
        }}>
          💅 美甲AI试戴
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', fontSize: 18, fontWeight: 500 }}>
          {menuItems.find(i => i.key === location.pathname)?.label || '美甲AI试戴与智能运营'}
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
