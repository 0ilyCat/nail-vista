/**
 * FloatingAskButton — "问问小美" 悬浮按钮
 * 彩色变换球 + 鼠标悬浮展开文字（默认只显示球体）
 * 支持鼠标拖拽移动位置
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FloatingAskButton() {
  const navigate = useNavigate();
  const btnRef = useRef<HTMLButtonElement>(null);

  // 拖拽状态
  const [pos, setPos] = useState({ x: 32, y: window.innerHeight - 100 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMoved = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    hasMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 80, dragStart.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragStart.current.posY + dy)),
      });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const onClick = () => {
    if (!hasMoved.current) navigate('/chat');
  };

  return (
    <button
      ref={btnRef}
      className="floating-ask-btn"
      onMouseDown={onMouseDown}
      onClick={onClick}
      title="和小美聊聊"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="morphing-blob" aria-hidden="true" />
      <span className="floating-ask-text">问问小美</span>
    </button>
  );
}
