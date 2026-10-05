import api from './api';

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/update-password', data),
};

// Users
export const userAPI = {
  getParticipants: () => api.get('/users/participants'),
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  resetPassword: (id, data) => api.put(`/users/${id}/reset-password`, data),
  resetEmergencyTokens: (id, data) => api.put(`/users/${id}/reset-emergency-tokens`, data),
  resetAllEmergencyTokens: (data) => api.post('/users/reset-emergency-tokens', data),
  getTokenHistory: () => api.get('/users/me/token-history'),
  getDepartments: () => api.get('/users/departments/list'),
  toggleStatus: (id) => api.put(`/users/${id}/toggle-status`),
  delete: (id) => api.delete(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
};

// Meetings
export const meetingAPI = {
  create: (data, config) => api.post('/meetings', data, config),
  getAll: (params) => api.get('/meetings', { params }),
  getMy: (params) => api.get('/meetings/my', { params }),
  getOne: (id) => api.get(`/meetings/${id}`),
  approve: (id, data) => api.put(`/meetings/${id}/approve`, data),
  reject: (id, data) => api.put(`/meetings/${id}/reject`, data),
  complete: (id, data) => api.put(`/meetings/${id}/complete`, data),
  getAnalytics: () => api.get('/meetings/analytics'),
  uploadAttachments: (id, formData) =>
    api.post(`/meetings/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  downloadAttachment: async (requestId, attachmentId, filename) => {
    const res = await api.get(`/meetings/${requestId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'attachment';
    link.click();
    window.URL.revokeObjectURL(url);
  },
  deleteAttachment: (requestId, attachmentId) =>
    api.delete(`/meetings/${requestId}/attachments/${attachmentId}`),
};

// Messages (meeting-request threads — keep separate from private chat)
export const messageAPI = {
  send: (requestId, data) => api.post(`/messages/${requestId}`, data),
  get: (requestId) => api.get(`/messages/${requestId}`),
};

// Private 1-to-1 chat
export const chatAPI = {
  getContacts: (params) => api.get('/chat/contacts', { params }),
  getConversations: () => api.get('/chat/conversations'),
  findOrCreate: (participantId) => api.post('/chat/conversations', { participantId }),
  getMessages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, content) =>
    api.post(`/chat/conversations/${conversationId}/messages`, { content }),
  markRead: (conversationId) => api.put(`/chat/conversations/${conversationId}/read`),
  getUnreadCount: () => api.get('/chat/unread-count'),
};

// Notifications
export const notificationAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// Availability
export const availabilityAPI = {
  get: () => api.get('/availability'),
  update: (data) => api.put('/availability', data),
  addFocusBlock: (data) => api.post('/availability/focus-block', data),
  removeFocusBlock: (blockId, params) =>
    api.delete(`/availability/focus-block/${blockId}`, { params }),
};

// Meetings (Video)
export const meetAPI = {
  create: (data) => api.post('/meet/create', data),
  getAll: (params) => api.get('/meet', { params }),
  getOne: (id) => api.get(`/meet/${id}`),
  update: (id, data) => api.put(`/meet/${id}`, data),
  updateStatus: (id, data) => api.put(`/meet/${id}/status`, data),
  restore: (id) => api.put(`/meet/${id}/restore`),
  delete: (id, params) => api.delete(`/meet/${id}`, { params }),
  emptyTrash: () => api.delete('/meet/trash'),
  bulkDeleteTrash: (ids) => api.post('/meet/trash/bulk-delete', { ids }),
  getStats: () => api.get('/meet/stats'),
};

// Codeo — AI assistant
export const codeoAPI = {
  send: (message) => api.post('/codeo/message', { message }),
  history: () => api.get('/codeo/history'),
};

// Tasks
export const taskAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  create: (data) => api.post('/tasks', data),
  updateStatus: (id, data) => api.put(`/tasks/${id}/status`, data),
  reorder: (taskIds) => api.put('/tasks/reorder', { taskIds }),
  delete: (id) => api.delete(`/tasks/${id}`),
};

// Audit log (admin)
export const auditAPI = {
  getAll: (params) => api.get('/audit', { params }),
};

// Team / department views
export const teamAPI = {
  getDepartments: () => api.get('/teams/departments'),
  getSummary: (department) => api.get(`/teams/${encodeURIComponent(department)}/summary`),
  getRequests: (department, params) =>
    api.get(`/teams/${encodeURIComponent(department)}/requests`, { params }),
  getTasks: (department) => api.get(`/teams/${encodeURIComponent(department)}/tasks`),
};
