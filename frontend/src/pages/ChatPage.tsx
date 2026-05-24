import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';
import ChatWidget from '../components/chat/ChatWidget';

export default function ChatPage() {
  const navigate = useNavigate();

  const templateQuestions = [
    { label: '🌸 推荐春季美甲', message: '推荐几款适合春天约会的美甲' },
    { label: '💎 有什么爆款', message: '最近什么款式最受欢迎' },
    { label: '🎨 红色系推荐', message: '有没有好看的红色系美甲' },
    { label: '✨ 法式推荐', message: '推荐一些经典法式美甲款式' },
    { label: '💡 搭配建议', message: '我皮肤偏黄适合什么颜色' },
    { label: '🌟 渐变推荐', message: '有没有简约渐变风格的美甲' },
  ];

  return (
    <div className="chat-page-layout">
      {/* 左侧：小美形象区域 */}
      <div className="chat-page-sidebar">
        <div className="chat-page-sidebar-bg" />
        <div className="chat-page-blob" />
        <div className="chat-page-xiaomei-name">小美</div>
        <div className="chat-page-xiaomei-tagline">
          AI 时尚顾问<br />
          帮你发现最适合的美甲
        </div>
        <Button
          className="btn-gradient"
          icon={<ExperimentOutlined />}
          onClick={() => navigate('/user/tryon')}
          style={{ marginTop: 16, width: '100%', borderRadius: 20, height: 36 }}
        >
          AI 试戴
        </Button>
      </div>

      {/* 右侧：全屏对话 */}
      <div className="chat-page-main">
        <ChatWidget
          agentType="user"
          placeholder="问问小美吧，比如「推荐一款适合约会的美甲」..."
          welcomeMessage={`嗨！我是小美 💅 你的 AI 时尚顾问。可以帮你：

- ✨ 搜索和推荐美甲款式
- 📸 评价试戴效果图
- 💡 解答美甲搭配问题

试试问我「有没有适合夏天的法式美甲？」`}
          quickActions={templateQuestions}
        />
      </div>
    </div>
  );
}
