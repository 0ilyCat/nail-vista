import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// 请求拦截器 — 自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 — 401 自动跳转登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(err);
  }
);

// ============ 认证 ============
export const authAPI = {
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  register: (data: { username: string; password: string; nickname?: string; role?: string }) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: any) => api.put('/auth/me', data),
  getStats: () => api.get('/auth/stats'),
  changePassword: (data: { old_password: string; new_password: string }) => api.post('/auth/change-password', data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/auth/upload-avatar', fd);
  },
};

// ============ 美甲款式 ============
export const stylesAPI = {
  list: (params?: any) => api.get('/styles', { params }),
  getDetail: (id: number) => api.get(`/styles/${id}`),
  categories: () => api.get('/styles/categories'),
  hotRanking: (limit = 10) => api.get('/styles/hot/ranking', { params: { limit } }),
  related: (id: number) => api.get(`/styles/${id}/related`),
};

// ============ 帖子 ============
export const postsAPI = {
  list: (params?: any) => api.get('/posts', { params }),
  getDetail: (id: number) => api.get(`/posts/${id}`),
  create: (data: any) => api.post('/posts', data),
  delete: (id: number) => api.delete(`/posts/${id}`),
  toggleLike: (id: number) => api.post(`/posts/${id}/like`),
  toggleFavorite: (id: number) => api.post(`/posts/${id}/favorite`),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/posts/upload-image', fd);
  },
};

// ============ 商家 ============
export const merchantsAPI = {
  list: (params?: any) => api.get('/merchants', { params }),
  getDetail: (id: number) => api.get(`/merchants/${id}`),
  cities: () => api.get('/merchants/cities'),
  styles: (id: number, params?: any) => api.get(`/merchants/${id}/styles`, { params }),
  getSlots: (id: number, date?: string) => api.get(`/merchants/${id}/slots`, { params: date ? { date } : {} }),
  getTags: () => api.get('/tags'),
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/merchants/upload-image', fd);
  },
  join: (data: any) => api.post('/merchants/join', data),
};

// ============ 预约 ============
export const appointmentsAPI = {
  create: (data: any) => api.post('/appointments', data),
  list: (params?: any) => api.get('/appointments', { params }),
  getDetail: (id: number) => api.get(`/appointments/${id}`),
  update: (id: number, status: string) => api.put(`/appointments/${id}?status=${status}`),
  cancel: (id: number) => api.delete(`/appointments/${id}`),
};

// ============ AI对话 ============
export const chatAPI = {
  send: (data: { message: string; session_key?: string }) => api.post('/chat/user', data),
  getSessions: () => api.get('/chat/sessions'),
  getMessages: (key: string) => api.get(`/chat/sessions/${key}`),
  deleteSession: (key: string) => api.delete(`/chat/sessions/${key}`),
};

// ============ 试戴 ============
export const tryonAPI = {
  getHands: () => api.get('/tryon/hand-images'),
  uploadHand: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/tryon/upload-hand', fd);
  },
  tryOn: (data: { hand_image_id: number; style_id: number; force_regenerate?: boolean }) =>
    api.post('/tryon/try-on', data, { timeout: 310000 }),
  history: (params?: any) => api.get('/tryon/history', { params }),
  deleteHand: (id: number) => api.delete(`/tryon/hand-images/${id}`),
  deleteHistory: (id: number) => api.delete(`/tryon/history/${id}`),
};

// ============ 收藏 ============
export const favoritesAPI = {
  toggleMerchant: (id: number) => api.post(`/favorites/merchants/${id}`),
  listMerchants: (params?: any) => api.get('/favorites/merchants', { params }),
  toggleStyle: (id: number) => api.post(`/favorites/styles/${id}`),
  listStyles: (params?: any) => api.get('/favorites/styles', { params }),
};

// ============ 搜索 ============
export const searchAPI = {
  all: (q: string, type = 'all') => api.get('/search', { params: { q, type } }),
};

// ============ 商家仪表盘 ============
export const dashboardAPI = {
  overview: () => api.get('/dashboard/overview'),
  appointments: (params?: any) => api.get('/dashboard/appointments', { params }),
  revenue: () => api.get('/dashboard/revenue'),
};

// ============ 商家管理（款式 + 预约） ============
export const adminAPI = {
  // 款式
  listStyles: (params?: any) => api.get('/admin/styles', { params }),
  createStyle: (data: any) => api.post('/admin/styles', data),
  updateStyle: (id: number, data: any) => api.put(`/admin/styles/${id}`, data),
  deleteStyle: (id: number) => api.delete(`/admin/styles/${id}`),
  uploadStyleImage: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/admin/styles/upload-image', fd);
  },
  setStyleImage: (id: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/styles/${id}/image`, fd);
  },
  // 预约管理
  listAppointments: (params?: any) => api.get('/admin/appointments', { params }),
  updateAppointment: (id: number, status: string) =>
    api.put(`/admin/appointments/${id}`, { status }),
  // 店铺信息（含时段配置）
  getProfile: () => api.get('/admin/merchant-profile'),
  updateProfile: (data: any) => api.put('/admin/merchant-profile', data),
};

export default api;
