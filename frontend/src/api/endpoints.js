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
  options: () => api.get('/auth/options').then(data),
};

export const reportApi = {
  indicators: () => api.get('/indicators').then((r) => r.data.indicators),
  periods: () => api.get('/reports/periods').then(data),
  mine: ({ year, month, week }) => api.get('/reports/me', { params: { year, month, week } }).then((r) => r.data.report),
  history: (limit = 52) => api.get('/reports/me/history', { params: { limit } }).then((r) => r.data.reports),
  save: (body) => api.put('/reports', body).then((r) => r.data.report),
};

export const dashboardApi = {
  overview: (filter) => api.get('/dashboard', { params: filter }).then(data),
  filters: () => api.get('/dashboard/filters').then(data),
  member: (id) => api.get(`/dashboard/members/${id}`).then(data),
  memberReport: (id, { year, month, week }) =>
    api.get(`/dashboard/members/${id}/reports/${year}/${month}/${week}`).then((r) => r.data.report),
  trend: (params) => api.get('/dashboard/trend', { params }).then((r) => r.data.trend),
  exportUrl: (filter) => `/api/dashboard/export.csv?${new URLSearchParams(filter)}`,
};

const indicators = (r) => r.data.indicators;

export const adminApi = {
  users: () => api.get('/admin/users').then((r) => r.data.users),
  createUser: (body) => api.post('/admin/users', body).then(data),
  updateUser: (id, body) => api.patch(`/admin/users/${id}`, body).then((r) => r.data.user),
  sendPasswordLink: (id) => api.post(`/admin/users/${id}/password-link`).then(data),
  indicators: () => api.get('/admin/indicators').then(indicators),
  createIndicator: (body) => api.post('/admin/indicators', body).then(indicators),
  updateIndicator: (id, body) => api.patch(`/admin/indicators/${id}`, body).then(indicators),
  updateOption: (id, body) => api.patch(`/admin/options/${id}`, body).then(indicators),
};
