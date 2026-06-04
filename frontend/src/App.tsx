import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/Layout';
import HomePage from './pages/Home';
import CommunityPage from './pages/Community';
import PostDetailPage from './pages/PostDetail';
import StyleDetailPage from './pages/StyleDetail';
import MerchantsPage from './pages/Merchants';
import MerchantDetailPage from './pages/MerchantDetail';
import TryOnPage from './pages/TryOn';
import ChatPage from './pages/Chat';
import LoginPage from './pages/Login';
import FavoritesPage from './pages/Favorites';
import DashboardPage from './pages/Dashboard';
import AppointmentsPage from './pages/Appointments';
import SearchPage from './pages/Search';
import ProfilePage from './pages/Profile';
import MerchantJoinPage from './pages/MerchantJoin';

const theme = {
  token: {
    colorPrimary: '#7d9d7a',
    colorPrimaryBg: '#eef5eb',
    colorPrimaryBgHover: '#dce8d9',
    colorPrimaryBorder: '#b4c9b1',
    colorPrimaryHover: '#6b8b68',
    colorPrimaryActive: '#5a7a52',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f8f9f8',
    colorBorderSecondary: '#e8ede6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: 14,
    lineHeight: 1.6,
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 38,
      paddingContentHorizontal: 20,
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
    },
  },
};

export default function App() {
  return (
    <ConfigProvider theme={theme} locale={zhCN}>
      <AntApp>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/community/post/:id" element={<PostDetailPage />} />
            <Route path="/styles/:id" element={<StyleDetailPage />} />
            <Route path="/merchants" element={<MerchantsPage />} />
            <Route path="/merchants/:id" element={<MerchantDetailPage />} />
            <Route path="/tryon" element={<TryOnPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/merchant/join" element={<MerchantJoinPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
