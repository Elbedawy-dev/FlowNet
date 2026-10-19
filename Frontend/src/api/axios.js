import axios from 'axios';
import en from '../i18n/en.js';
import ar from '../i18n/ar.js';

export function getLocalizedApiError(error) {
  const currentLang =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('flownet_lang') || document.documentElement.getAttribute('lang'))) ||
    'en';
  const dict = currentLang === 'ar' ? ar : en;

  const code = error.response?.data?.code || error.code;
  const status = error.response?.status || error.status;
  const rawMsg = error.response?.data?.message || error.message || '';

  if (code === 'BLOCKED_BY_USER' || rawMsg.includes('BLOCKED_BY_USER') || /blocked by user/i.test(rawMsg)) {
    return dict.errors?.BLOCKED_BY_USER || rawMsg;
  }
  if (code === 'USERNAME_TAKEN' || /username.*taken|already taken/i.test(rawMsg)) {
    return dict.errors?.USERNAME_TAKEN || rawMsg;
  }
  if (code === 'VALIDATION_ERROR' || status === 422 || /validation/i.test(rawMsg)) {
    return dict.errors?.VALIDATION_ERROR || rawMsg;
  }
  if (code === 'FORBIDDEN' || status === 403) {
    if (code === 'MESSAGING_RESTRICTED' || /only connections/i.test(rawMsg)) {
      return dict.messages?.connectionsOnly || dict.errors?.FORBIDDEN || rawMsg;
    }
    return dict.errors?.FORBIDDEN || rawMsg;
  }
  if (code === 'NOT_FOUND' || status === 404) {
    return dict.errors?.NOT_FOUND || rawMsg;
  }
  if (
    !error.response &&
    (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || /network/i.test(rawMsg))
  ) {
    return dict.errors?.NETWORK_ERROR || rawMsg;
  }

  return rawMsg || dict.errors?.GENERIC || 'An unexpected error occurred';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Clerk session JWT
api.interceptors.request.use(
  async (config) => {
    try {
      if (typeof window !== 'undefined' && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn('[API] Could not retrieve Clerk token:', err);
    }

    // If uploading FormData, delete Content-Type so browser sets boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: unwrap { success, data, meta } and handle 401
api.interceptors.response.use(
  (response) => {
    const resData = response.data?.data !== undefined ? response.data.data : response.data;
    if (response.data?.meta && typeof resData === 'object' && resData !== null) {
      resData.meta = response.data.meta;
      resData.next_cursor = response.data.meta.next_cursor;
      resData.has_more = response.data.meta.has_more;
    }
    return resData;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined' && window.Clerk) {
        try {
          window.Clerk.signOut();
        } catch (e) {
          console.warn('[API] Clerk signOut failed:', e);
        }
      }
    }
    const message = getLocalizedApiError(error);
    const apiError = new Error(message);
    apiError.status = error.response?.status;
    apiError.code = error.response?.data?.code;
    apiError.data = error.response?.data;
    apiError.rawMessage = error.response?.data?.message || error.message;
    return Promise.reject(apiError);
  }
);

export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  search: (q, page = 1, limit = 20) =>
    api.get('/users/search', { params: { q, page, limit } }),
  getById: (id) => api.get(`/users/${id}`),
  getPosts: (id, type = 'posts', cursor = null, limit = 20) =>
    api.get(`/users/${id}/posts`, { params: { type, cursor, limit } }),
  follow: (id) => api.post(`/users/${id}/follow`),
  unfollow: (id) => api.delete(`/users/${id}/follow`),
  block: (id) => api.post(`/users/${id}/block`),
  unblock: (id) => api.delete(`/users/${id}/block`),
  getNetwork: () => api.get('/users/me/network'),
  getBlocked: () => api.get('/users/me/blocked'),
  updateSettings: (settings) => api.put('/users/me/settings', settings),
  deactivate: () => api.put('/users/me/deactivate'),
  deleteAccount: () => api.delete('/users/me'),
};

export const connectionsApi = {
  request: (userId) => api.post(`/connections/${userId}/request`),
  accept: (userId) => api.post(`/connections/${userId}/accept`),
  reject: (userId) => api.post(`/connections/${userId}/reject`),
  remove: (userId) => api.delete(`/connections/${userId}`),
};

export const postsApi = {
  create: (data) => api.post('/posts', data),
  update: (id, data) => api.put(`/posts/${id}`, data),
  getFeed: (scope = 'global', cursor = null, limit = 20) =>
    api.get('/posts/feed', { params: { scope, cursor, limit } }),
  getById: (id) => api.get(`/posts/${id}`),
  delete: (id) => api.delete(`/posts/${id}`),
  like: (id) => api.post(`/posts/${id}/like`),
  share: (id) => api.post(`/posts/${id}/share`),
  getComments: (id) => api.get(`/posts/${id}/comments`),
  addComment: (id, text) => api.post(`/posts/${id}/comments`, { text }),
  deleteComment: (id, commentId) => api.delete(`/posts/${id}/comments/${commentId}`),
};

export const storiesApi = {
  create: (data) => api.post('/stories', data),
  update: (id, data) => api.put(`/stories/${id}`, data),
  getAll: () => api.get('/stories'),
  view: (id) => api.post(`/stories/${id}/view`),
  delete: (id) => api.delete(`/stories/${id}`),
};

export const messagesApi = {
  getRecent: () => api.get('/messages/recent'),
  getConversation: (userId, cursor = null, limit = 30) =>
    api.get(`/messages/${userId}`, { params: { cursor, limit } }),
  send: (userId, data) => api.post(`/messages/${userId}`, data),
  markSeen: (userId) => api.put(`/messages/${userId}/seen`),
};

export const notificationsApi = {
  getAll: (type = 'all', cursor = null, limit = 20) =>
    api.get('/notifications', { params: { type, cursor, limit } }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAllRead: () => api.put('/notifications/read'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

export const groupsApi = {
  getAvailable: () => api.get('/groups/available'),
  getJoined: () => api.get('/groups/joined'),
  getMine: () => api.get('/groups/mine'),
  getById: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  joinRequest: (id) => api.post(`/groups/${id}/join-request`),
  cancelJoinRequest: (id) => api.delete(`/groups/${id}/join-request`),
  getRequests: (id) => api.get(`/groups/${id}/requests`),
  acceptRequest: (id, userId) => api.post(`/groups/${id}/requests/${userId}/accept`),
  rejectRequest: (id, userId) => api.post(`/groups/${id}/requests/${userId}/reject`),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`),
  getMessages: (id, cursor = null, limit = 30) =>
    api.get(`/groups/${id}/messages`, { params: { cursor, limit } }),
  sendMessage: (id, data) => api.post(`/groups/${id}/messages`, data),
};

export default api;
