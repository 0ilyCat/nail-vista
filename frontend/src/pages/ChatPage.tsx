import ChatWidget from '../components/chat/ChatWidget';

export default function ChatPage() {
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
      </div>

      {/* 右侧：全屏对话 */}
      <div className="chat-page-main">
        <ChatWidget
          agentType="user"
          placeholder="问问小美吧，比如「推荐一款适合约会的美甲」..."
          welcomeMessage="嗨！我是小美 💅 你的 AI 时尚顾问。可以帮你：\n\n✨ 搜索和推荐美甲款式\n📸 评价试戴效果图\n💡 解答美甲搭配问题\n\n试试问我「有没有适合夏天的法式美甲？」"
        />
      </div>
    </div>
  );
}
