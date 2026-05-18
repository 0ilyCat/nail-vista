import { Routes, Route } from 'react-router-dom';
import MainLayout from './components/common/MainLayout';
import HomePage from './pages/HomePage';
import TryOnPage from './pages/TryOnPage';
import StyleBrowsePage from './pages/StyleBrowsePage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="tryon" element={<TryOnPage />} />
        <Route path="styles" element={<StyleBrowsePage />} />
        <Route path="dashboard" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}

export default App;
