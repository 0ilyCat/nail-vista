import { useNavigate } from 'react-router-dom';
import { RightOutlined, UserOutlined, DashboardOutlined } from '@ant-design/icons';

export default function RoleSelectPage() {
  const navigate = useNavigate();

  return (
    <div className="role-select-page">
      {/* Brand */}
      <div className="role-brand">
        <h1>NailVista</h1>
        <p>AI 驱动的美甲试戴与智能运营平台。选择你的身份，开始体验。</p>
      </div>

      {/* Role Cards */}
      <div className="role-cards">
        <div
          className="role-card user-card"
          onClick={() => navigate('/user/styles')}
        >
          <div className="role-card-icon">💅</div>
          <h2>我是用户</h2>
          <p>浏览精选美甲款式，AI 一键试戴，找到最适合你的指尖艺术。</p>
          <button className="role-enter-btn user-btn">
            进入试戴 <RightOutlined />
          </button>
        </div>

        <div
          className="role-card dashboard-card"
          onClick={() => navigate('/dashboard')}
        >
          <div className="role-card-icon">📊</div>
          <h2>我是运营</h2>
          <p>实时数据看板，AI 运营分析，洞察趋势，驱动决策。</p>
          <button className="role-enter-btn dashboard-btn">
            进入看板 <RightOutlined />
          </button>
        </div>
      </div>
    </div>
  );
}
