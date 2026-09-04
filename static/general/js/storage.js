/**
 * static/js/storage.js
 * Database Client Adapter — Communicates with the backend database (PostgreSQL / SQLite)
 * and manages the client session token in localStorage.
 */
const STORAGE_KEYS = {
  CURRENT_USER: 'authguard_current_session',
  THEME: 'authguard_theme_pref'
};

window.DB = {
  /**
   * Authenticate user against the backend database
   */
  login: async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        window.DB.setCurrentUser({ ...data.user, token: data.token });
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Network error connecting to authentication database.' };
    }
  },

  /**
   * Real Google OAuth Login (Google Identity Services)
   */
  googleLogin: async (credential) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, provider: 'google' })
      });
      const data = await res.json();
      if (data.success && data.user) {
        window.DB.setCurrentUser({ ...data.user, token: data.token });
      }
      return data;
    } catch (e) {
      return { success: false, error: 'Network error verifying Google authentication.' };
    }
  },

  /**
   * OAuth Social Login (Google / GitHub / Microsoft)
   */
  socialLogin: async (provider, email, name, credential) => {
    try {
      const endpoint = provider === 'google' ? '/api/auth/google' : '/api/auth/social';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email, name, credential })
      });
      const data = await res.json();
      if (data.success && data.user) {
        window.DB.setCurrentUser({ ...data.user, token: data.token });
      }
      return data;
    } catch (e) {
      return { success: false, error: `Network error during ${provider} authentication.` };
    }
  },

  /**
   * Update password in backend database
   */
  updatePassword: async (email, newPassword) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await res.json();
      return !!(res.ok && data.success);
    } catch (e) {
      return false;
    }
  },

  /**
   * Active Session Management
   */
  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || 'null');
    } catch {
      return null;
    }
  },

  setCurrentUser: (user) => {
    try {
      if (!user) return;
      const safe = {
        id: user.id,
        name: user.name,
        email: user.email,
        token: user.token,
        permissions: user.permissions || ['body']
      };
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(safe));
      window.__USER_SESSION__ = true;
      window.__USER_PERMISSIONS__ = safe.permissions;
    } catch (e) {
      console.error('Error saving session:', e);
    }
  },

  clearCurrentUser: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (e) {
      console.error(e);
    }
  },

  logout: () => {
    window.DB.clearCurrentUser();
  }
};

// Global permission checker fallback
window.hasPermission = window.hasPermission || function (perm) {
  if (!perm) return true;
  var currentUser = (window.DB && window.DB.getCurrentUser()) || (window.__USER_SESSION__ ? window.__SERVER_USER__ : null);
  if (!currentUser) return false;
  if (perm === 'body') return true;
  var perms = window.__USER_PERMISSIONS__ || (currentUser && currentUser.permissions) || [];
  return Array.isArray(perms) && perms.includes(perm);
};
