import { Storage } from './storage.js';

export const API = {
  getBaseUrl() {
    return Storage.getApiBaseUrl();
  },

  async request(path, options = {}) {
    const base = this.getBaseUrl();
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    const defaultOptions = {
      credentials: 'include', // Include HTTP-only session cookies
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      defaultOptions.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      let data = {};
      try {
        data = await response.json();
      } catch {
        data = { raw: await response.text().catch(() => '') };
      }

      if (!response.ok) {
        let errorType = data.errorType || 'API_ERROR';
        let message = data.error || data.detail || `Request failed with status ${response.status}`;

        if (response.status === 401) {
          errorType = 'UNAUTHORIZED';
        } else if (response.status === 402) {
          errorType = 'CREDITS_UNAVAILABLE';
          message = 'X API credits are unavailable for this request. Official X API requires a paid Developer tier with active credits. No fake accounts will be displayed. You can import your X Data Archive below.';
        } else if (response.status === 403) {
          if (message.toLowerCase().includes('credit') || message.toLowerCase().includes('tier')) {
            errorType = 'CREDITS_UNAVAILABLE';
            message = 'X API credits are unavailable for this request. No fake accounts will be displayed. You can import your official X Data Archive below.';
          } else {
            errorType = 'FORBIDDEN';
          }
        } else if (response.status === 429) {
          errorType = 'RATE_LIMITED';
          message = 'X API rate limit reached. Please wait before retrying.';
        }

        const err = new Error(message);
        err.status = response.status;
        err.errorType = errorType;
        err.data = data;
        err.rateLimit = data.rateLimit || null;
        throw err;
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Network error: Unable to reach X Control Center backend API.');
        netErr.errorType = 'NETWORK_ERROR';
        throw netErr;
      }
      throw err;
    }
  },

  // Auth endpoints
  async checkAuth(refresh = false) {
    return this.request(`/api/auth/me${refresh ? '?refresh=true' : ''}`);
  },

  async getLoginUrl() {
    return this.request('/api/auth/login?json=true');
  },

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' });
  },

  // X Data endpoints
  async getProfile(userId = null) {
    return this.request(`/api/x/profile${userId ? `?id=${userId}` : ''}`);
  },

  async getFollowing(maxResults = 100, paginationToken = null) {
    let q = `?max_results=${maxResults}`;
    if (paginationToken) q += `&pagination_token=${paginationToken}`;
    return this.request(`/api/x/following${q}`);
  },

  async getFollowers(maxResults = 100, paginationToken = null) {
    let q = `?max_results=${maxResults}`;
    if (paginationToken) q += `&pagination_token=${paginationToken}`;
    return this.request(`/api/x/followers${q}`);
  },

  async getPosts(userId = null, maxResults = 10) {
    let q = `?max_results=${maxResults}`;
    if (userId) q += `&id=${userId}`;
    return this.request(`/api/x/posts${q}`);
  },

  async unfollow(targetUserId) {
    return this.request('/api/x/unfollow', {
      method: 'POST',
      body: { target_user_id: targetUserId }
    });
  },

  async follow(targetUserId) {
    return this.request('/api/x/follow', {
      method: 'POST',
      body: { target_user_id: targetUserId }
    });
  },

  async getAnalysis() {
    return this.request('/api/x/analysis');
  }
};
