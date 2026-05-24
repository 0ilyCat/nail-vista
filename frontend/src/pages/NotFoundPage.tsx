import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 'var(--space-2xl)',
    }}>
      <div style={{ fontSize: 80, marginBottom: 16, opacity: 0.6 }}>💅</div>
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 600,
        color: 'var(--text)',
        marginBottom: 8,
      }}>
        页面未找到
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        你寻找的页面不存在，可能已被移动或删除。
      </p>
      <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')} size="large">
        返回首页
      </Button>
    </div>
  );
}
