/**
 * Storage utility for non-sensitive UI preferences and local X Archive cache.
 * STRICT SECURITY POLICY: Never stores X access tokens, secrets, or passwords.
 */

const STORAGE_KEYS = {
  PREFERENCES: 'xcc_ui_preferences',
  ARCHIVE_CACHE: 'xcc_archive_data_cache',
  ACTIVE_TAB: 'xcc_active_tab',
  API_BASE_URL: 'xcc_api_base_url'
};

export const Storage = {
  getPreferences() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      return data ? JSON.parse(data) : { theme: 'dark', viewMode: 'table' };
    } catch {
      return { theme: 'dark', viewMode: 'table' };
    }
  },

  setPreferences(prefs) {
    try {
      const current = this.getPreferences();
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ ...current, ...prefs }));
    } catch (e) {
      console.warn('Storage write failed', e);
    }
  },

  getActiveTab() {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'overview';
    } catch {
      return 'overview';
    }
  },

  setActiveTab(tab) {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
    } catch {}
  },

  // Archive Cache (Stores non-sensitive follower/following list parsed from user's manual archive upload)
  getArchiveCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ARCHIVE_CACHE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveArchiveCache(data) {
    try {
      localStorage.setItem(STORAGE_KEYS.ARCHIVE_CACHE, JSON.stringify(data));
    } catch (e) {
      console.warn('Archive cache write failed (likely quota limit)', e);
    }
  },

  clearArchiveCache() {
    try {
      localStorage.removeItem(STORAGE_KEYS.ARCHIVE_CACHE);
    } catch {}
  },

  getApiBaseUrl() {
    try {
      // Check window config or localStorage
      return window.__XCC_API_BASE_URL__ || localStorage.getItem(STORAGE_KEYS.API_BASE_URL) || '';
    } catch {
      return '';
    }
  },

  setApiBaseUrl(url) {
    try {
      if (url) {
        localStorage.setItem(STORAGE_KEYS.API_BASE_URL, url.replace(/\/+$/, ''));
      } else {
        localStorage.removeItem(STORAGE_KEYS.API_BASE_URL);
      }
    } catch {}
  }
};
