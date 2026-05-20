import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ===== 试戴 =====
export interface HandInfo {
  id: string;
  name: string;
  url: string;
  type: string;
  path?: string;
}

export interface HandUploadResult {
  hand_id: string;
  image_url: string;
  db_id: number;
  message: string;
}

export const getHandImages = async (): Promise<HandInfo[]> => {
  const { data } = await api.get('/tryon/hand-images');
  return data.hands;
};

export const uploadHand = async (file: File): Promise<HandUploadResult> => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/tryon/upload-hand', form);
  return data;
};

export interface TryOnResult {
  result_url: string;
  duration_ms: number;
  style_name: string;
  source: string;
}

export const startTryOn = async (handId: string, styleId: number): Promise<TryOnResult> => {
  const form = new FormData();
  form.append('hand_id', handId);
  form.append('style_id', String(styleId));
  const { data } = await api.post('/tryon/try-on', form);
  return data;
};

export const getTryonHistory = async (limit = 20, offset = 0) => {
  const { data } = await api.get('/tryon/history', { params: { limit, offset } });
  return data;
};

// ===== 款式 =====
export interface NailStyleItem {
  id: number;
  name: string;
  local_url: string;
  original_url: string;
  enhanced_url: string;
  category: string;
  color_tone: string;
  tags: string[];
  description: string;
  popularity: number;
  today_tryons: number;
}

export const getStyles = async (params: {
  category?: string;
  search?: string;
  sort?: string;
  page?: number;
  size?: number;
} = {}) => {
  const { data } = await api.get('/styles', { params });
  return data as { items: NailStyleItem[]; total: number; page: number; size: number };
};

export const getStyleDetail = async (id: number) => {
  const { data } = await api.get(`/styles/${id}`);
  return data;
};

export const getCategories = async () => {
  const { data } = await api.get('/styles/categories');
  return data.categories as { name: string; count: number }[];
};

export const getHotRanking = async (limit = 10, days = 7) => {
  const { data } = await api.get('/styles/hot/ranking', { params: { limit, days } });
  return data.ranking;
};

// ===== 数据分析 =====
export const getOverview = async () => {
  const { data } = await api.get('/analytics/overview');
  return data;
};

export const getTrends = async (days = 7) => {
  const { data } = await api.get('/analytics/trends', { params: { days } });
  return data.trends;
};

export const getHotStylesData = async (limit = 10, days = 7) => {
  const { data } = await api.get('/analytics/hot-styles', { params: { limit, days } });
  return data.styles;
};

// ===== 智能运营 =====
export const chatWithAI = async (message: string) => {
  const { data } = await api.post('/operations/chat', { message });
  return data as { reply: string; type: string };
};

export const generateReport = async (reportType: 'daily' | 'trend' | 'strategy' = 'daily') => {
  const { data } = await api.post('/operations/reports/generate', null, { params: { report_type: reportType } });
  return data;
};

export const getReports = async (reportType = 'daily', limit = 10) => {
  const { data } = await api.get('/operations/reports', { params: { report_type: reportType, limit } });
  return data;
};
