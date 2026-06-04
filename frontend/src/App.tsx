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
    colorPrimary: '#2f6f68',
    colorPrimaryBg: '#edf6f1',
    colorLink: '#2f6f68',
    colorText: '#1f2b29',
    colorTextSecondary: '#667572',
    colorBorder: 'rgba(47, 111, 104, 0.16)',
    borderRadius: 8,
    colorBgContainer: '#ffffff',
    boxShadowSecondary: '0 18px 50px rgba(24, 62, 57, 0.11)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: {
      controlHeight: 38,
      borderRadius: 8,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Tabs: {
      inkBarColor: '#2f6f68',
      itemSelectedColor: '#2f6f68',
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

