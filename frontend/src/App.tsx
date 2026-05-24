import { Routes, Route, Navigate } from 'react-router-dom';
import UserLayout from './components/common/UserLayout';
import DashboardLayout from './components/common/DashboardLayout';
import RoleSelectPage from './pages/RoleSelectPage';
import TryOnPage from './pages/TryOnPage';
import StyleBrowsePage from './pages/StyleBrowsePage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Routes>
      {/* Role Selection */}
      <Route path="/" element={<RoleSelectPage />} />

      {/* User Perspective */}
      <Route path="/user" element={<UserLayout />}>
        <Route index element={<Navigate to="/user/styles" replace />} />
        <Route path="styles" element={<StyleBrowsePage />} />
        <Route path="tryon" element={<TryOnPage />} />
        <Route path="chat" element={<ChatPage />} />
      </Route>

      {/* Dashboard Perspective */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
