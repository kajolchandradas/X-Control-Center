import { API } from './api.js';

export const Auth = {
  state: {
    authenticated: false,
    user: null,
    loading: true,
    error: null
  },

  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  },

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Auth listener error', e);
      }
    }
  },

  async init() {
    this.state.loading = true;
    this.notify();

    // Check for query parameters from OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      const err = params.get('auth_error');
      this.state.error = decodeURIComponent(err);
      // Clean query string
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.has('connected')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const res = await API.checkAuth();
      if (res.authenticated && res.user) {
        this.state.authenticated = true;
        this.state.user = res.user;
        this.state.error = null;
      } else {
        this.state.authenticated = false;
        this.state.user = null;
      }
    } catch {
      this.state.authenticated = false;
      this.state.user = null;
    } finally {
      this.state.loading = false;
      this.notify();
    }
  },

  async login() {
    try {
      // Try to get JSON auth URL or fallback to direct redirect
      const res = await API.getLoginUrl();
      if (res.url) {
        window.location.href = res.url;
      } else {
        window.location.href = `${API.getBaseUrl()}/api/auth/login`;
      }
    } catch {
      window.location.href = `${API.getBaseUrl()}/api/auth/login`;
    }
  },

  async logout() {
    try {
      await API.logout();
    } catch (e) {
      console.warn('Logout API warning', e);
    }
    this.state.authenticated = false;
    this.state.user = null;
    this.notify();
    window.location.reload();
  }
};
