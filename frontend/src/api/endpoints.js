import { api } from './client';

const data = (res) => res.data;

export const authApi = {
  async me() {
    try {
      return (await api.get('/auth/me')).data.user;
    } catch (err) {
      if (err.response?.status === 401) return null;
      throw err;
    }
  },
  login: (body) => api.post('/auth/login', body).then((r) => r.data.user),
  logout: () => api.post('/auth/logout'),
  changePassword: (body) => api.post('/auth/change-password', body).then((r) => r.data.user),
  forgotPassword: (body) => api.post('/auth/forgot-password', body).then(data),
  resetPassword: (body) => api.post('/auth/reset-password', body).then(data),
};

export const reportApi = {
  indicators: () => api.get('/indicators').then((r) => r.data.indicators),
  periods: () => api.get('/reports/periods').then(data),
  mine: ({ year, month, week }) => api.get('/reports/me', { params: { year, month, week } }).then((r) => r.data.report),
  history: (limit = 52) => api.get('/reports/me/history', { params: { limit } }).then((r) => r.data.reports),
  save: (body) => api.put('/reports', body).then((r) => r.data.report),
};
