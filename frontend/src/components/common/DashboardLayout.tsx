import { Outlet, useNavigate } from 'react-router-dom';
import { Button, Badge } from 'antd';
import { HomeOutlined, DashboardOutlined, UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { getOverview } from '../../services/api';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [todayTryons, setTodayTryons] = useState(0);

  useEffect(() => {
    getOverview().then(d => setTodayTryons(d.today_tryons)).catch(() => {});
    const t = setInterval(() => {
      getOverview().then(d => setTodayTryons(d.today_tryons)).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="minimal-header">
        <div
          onClick={() => navigate('/')}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            fontWeight: 700,
            color: 'var(--accent)',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          NailVista
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            运营中心
          </span>
        </div>

        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge count={todayTryons} overflowCount={999} size="small" offset={[-4, 4]}>
            <Button type="primary" icon={<DashboardOutlined />}>
              运营看板
            </Button>
          </Badge>
          <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 8px' }} />
          <Button type="text" icon={<UserOutlined />} onClick={() => navigate('/user/styles')} size="small">
            用户端
          </Button>
          <Button type="text" icon={<HomeOutlined />} onClick={() => navigate('/')} size="small">
            首页
          </Button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: 'var(--space-xl)', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
