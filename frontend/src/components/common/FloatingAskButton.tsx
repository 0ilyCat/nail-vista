import { useNavigate } from 'react-router-dom';

interface FloatingAskButtonProps {
  text?: string;
}

export default function FloatingAskButton({ text = '问问小美' }: FloatingAskButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      className="floating-ask-btn"
      onClick={() => navigate('/user/chat')}
      title="和小美聊聊"
    >
      {/* 彩色变换球体 */}
      <div className="morphing-blob" aria-hidden="true" />
      <span className="floating-ask-text">{text}</span>
    </button>
  );
}
