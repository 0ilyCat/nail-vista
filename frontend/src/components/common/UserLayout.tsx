import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { HomeOutlined, AppstoreOutlined, ExperimentOutlined, DashboardOutlined, MessageOutlined } from '@ant-design/icons';

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal Header */}
      <header className="minimal-header">
        <div
          onClick={() => navigate('/user/styles')}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--primary)',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          NailVista
        </div>

        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            type={isActive('/user/styles') ? 'primary' : 'text'}
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/user/styles')}
          >
            款式浏览
          </Button>
          <Button
            type={isActive('/user/tryon') ? 'primary' : 'text'}
            icon={<ExperimentOutlined />}
            onClick={() => navigate('/user/tryon')}
          >
            AI 试戴
          </Button>
          <Button
            type={isActive('/user/chat') ? 'primary' : 'text'}
            icon={<MessageOutlined />}
            onClick={() => navigate('/user/chat')}
          >
            对话小美
          </Button>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />
          <Button
            type="text"
            icon={<DashboardOutlined />}
            onClick={() => navigate('/dashboard')}
            size="small"
          >
            运营看板
          </Button>
          <Button
            type="text"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
            size="small"
          >
            首页
          </Button>
        </nav>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: '12px 16px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
