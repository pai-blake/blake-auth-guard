/**
 * static/auth/js/router.js
 * Auth Module In-Page Routing Controller
 *
 * Flow:
 *  - Base URL: /auth
 *  - Sign In:        /auth#/login
 *  - Sign Up:        /auth#/signup
 *  - Forgot:         /auth#/forgot
 *  - OTP Verify:     /auth#/otp
 *  - Reset Password: /auth#/reset-password
 *  - Post-login:     /body (full server redirect)
 */
(function () {
  class AppRouter {
    constructor() {
      this.routes = new Map();
      this.defaultPublicRoute = '/login';
      this.currentRoute = null;
    }

    /** Post-login destination route */
    getSessionRoute() {
      return '/body';
    }

    /** Register a route with permissions & handler */
    register(path, config) {
      this.routes.set(this._normalize(path), {
        authRequired: config.authRequired || false,
        viewId:       config.viewId       || null,
        onEnter:      config.onEnter      || null,
        title:        config.title        || 'AuthGuard',
        redirect:     config.redirect     || null,
      });
      return this;
    }

    /** Navigate to a route path */
    navigate(path, params = {}) {
      const cleanPath = this._normalize(path);
      window.location.hash = '#' + cleanPath;
      this._handleRouteChange(cleanPath, params);
    }

    /** Normalize a path string */
    _normalize(path) {
      if (!path) return '/login';
      const clean = path.replace(/^#\/?/, '/').replace(/\/+$/, '') || '/';
      return clean.startsWith('/') ? clean : '/' + clean;
    }

    /** Core route resolution and auth guard logic */
    _handleRouteChange(targetPath, params = {}) {
      const rawHash = window.location.hash;
      const path = targetPath || (rawHash ? this._normalize(rawHash) : this.defaultPublicRoute);
      const route = this.routes.get(path) || this.routes.get(this.defaultPublicRoute);
      const user = window.DB ? window.DB.getCurrentUser() : null;

      // Serious Route Guard: Cannot move to serious route without system permission
      if (route && (route.authRequired || route.permissionRequired)) {
        const requiredPerm = route.permissionRequired || 'body';
        const permitted = (requiredPerm === 'body' && Boolean(user)) ||
                          (window.hasPermission ? window.hasPermission(requiredPerm) : Boolean(user));
        if (!permitted) {
          if (window.showToast) {
            window.showToast(`Access Denied: System permission required to navigate to ${route.title || 'this route'}.`, 'error');
          }
          this.navigate(this.defaultPublicRoute);
          return;
        }
      }

      this.currentRoute = path;

      // Update page title
      if (route && route.title) {
        document.title = `${route.title} — AuthGuard`;
      }

      // Show/hide header logout button
      const btnLogout = document.getElementById('btn-header-logout');
      if (btnLogout) {
        btnLogout.classList.toggle('hidden', !(route && route.authRequired && user));
      }

      // Server-side redirect (for serious cross-module destinations)
      if (route && route.redirect) {
        window.location.href = route.redirect;
        return;
      }

      // Switch the visible view
      if (route && route.viewId && window.UI) {
        const viewEl = document.getElementById(route.viewId);
        if (viewEl) window.UI.switchView(viewEl);
      }

      // onEnter lifecycle hook
      if (route && typeof route.onEnter === 'function') {
        route.onEnter({ user, path, params });
      }
    }

    /** Initialize the router */
    init() {
      // Header logout button
      const btnLogout = document.getElementById('btn-header-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          if (window.DB) window.DB.clearCurrentUser();
          if (window.showToast) window.showToast('Signed out successfully.', 'info', 2500);
          this.navigate(this.defaultPublicRoute);
        });
      }

      // ── Small In-Module Routes (freely routed by user) ───────────────
      this.register('/login', {
        authRequired: false,
        viewId: 'view-login',
        title:  'Sign In',
      });

      this.register('/signup', {
        authRequired: false,
        viewId: 'view-signup',
        title:  'Create Account',
      });

      this.register('/forgot', {
        authRequired: false,
        viewId: 'view-forgot',
        title:  'Reset Password',
      });

      this.register('/otp', {
        authRequired: false,
        viewId: 'view-otp',
        title:  'Verify OTP',
      });

      this.register('/reset-password', {
        authRequired: false,
        viewId: 'view-new-password',
        title:  'Set New Password',
      });

      // ── Serious Cross-Module Routes (require system permission) ─────
      this.register('/body', {
        authRequired: true,
        permissionRequired: 'body',
        redirect:     '/body',
        title:        'Workspace',
      });

      this.register('/calculator', {
        authRequired: true,
        permissionRequired: 'calculator',
        redirect:     '/calculator',
        title:        'Calculator',
      });

      // ── Initial route resolution ──────────────────────────────────────
      window.addEventListener('hashchange', () => this._handleRouteChange());

      const initialHash = window.location.hash ? this._normalize(window.location.hash) : null;
      const user = window.DB ? window.DB.getCurrentUser() : null;

      if (initialHash && this.routes.has(initialHash)) {
        const target = this.routes.get(initialHash);
        if (target.authRequired && !user) {
          this.navigate(this.defaultPublicRoute);
        } else {
          this._handleRouteChange(initialHash);
        }
      } else {
        this.navigate(this.defaultPublicRoute);
      }
    }
  }

  window.Router = new AppRouter();
})();
