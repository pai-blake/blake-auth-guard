/**
 * static/calculator/js/components/router.js
 * Calculator Module In-Page Routing Controller
 *
 * Flow:
 *  - Base URL: /calculator
 *  - Basic Mode:      /calculator#/basic
 *  - Scientific Mode: /calculator#/scientific
 *  - Legacy Aliases:  /calculator#/mini, /calculator#/maxi
 *  - Post-calc flow:  /body or /auth (server redirect)
 */
(function () {
  class AppRouter {
    constructor() {
      this.routes = new Map();
      this.defaultPublicRoute = '/basic';
      this.currentRoute = null;
    }

    /** Workspace post-calculation destination */
    getSessionRoute() {
      return '/body';
    }

    /** Register a route with permissions & handler */
    register(path, config) {
      this.routes.set(this._normalize(path), {
        authRequired: config.authRequired || false,
        viewId:       config.viewId       || null,
        onEnter:      config.onEnter      || null,
        title:        config.title        || 'AuthGuard — Calculator',
        redirect:     config.redirect     || null,
      });
      return this;
    }

    /** Navigate to a route path with hash update */
    navigate(path, params = {}) {
      const cleanPath = this._normalize(path);
      window.location.hash = '#' + cleanPath;
      this._handleRouteChange(cleanPath, params);
    }

    /** Normalize a path string */
    _normalize(path) {
      if (!path) return this.defaultPublicRoute;
      const clean = path.replace(/^#\/?/, '/').replace(/\/+$/, '') || '/';
      return clean.startsWith('/') ? clean : '/' + clean;
    }

    /** Core route resolution and view switching */
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
        btnLogout.classList.toggle('hidden', !user);
      }

      // Server-side redirect for serious cross-module routes
      if (route && route.redirect) {
        window.location.href = route.redirect;
        return;
      }

      // Switch the visible calculator view
      if (route && route.viewId && window.UI) {
        const viewEl = document.getElementById(route.viewId);
        if (viewEl) window.UI.switchView(viewEl);
      }

      // onEnter lifecycle hook
      if (route && typeof route.onEnter === 'function') {
        route.onEnter({ user, path, params });
      }
    }

    /** Initialize router and wire up toggle button listeners */
    init() {
      // Header logout button
      const btnLogout = document.getElementById('btn-header-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          if (window.DB) window.DB.clearCurrentUser();
          if (window.showToast) window.showToast('Signed out successfully.', 'info', 2500);
          window.location.href = '/auth';
        });
      }

      // ── Small In-Module Routes (freely routed by user) ───────────────
      this.register('/basic', {
        authRequired: false,
        viewId: 'view-basic',
        title:  'Basic Calculator',
      });

      this.register('/scientific', {
        authRequired: false,
        viewId: 'view-scientific',
        title:  'Scientific Calculator',
      });

      this.register('/advanced', {
        authRequired: false,
        viewId: 'view-advanced',
        title:  'Advanced Mathematics Calculator',
      });

      // ── Serious Cross-Module Routes (require system permission) ─────
      this.register('/body', {
        authRequired: true,
        permissionRequired: 'body',
        redirect:     '/body',
        title:        'Workspace',
      });

      this.register('/auth', {
        authRequired: false,
        redirect:     '/auth',
        title:        'Sign In',
      });

      // ── Wire up toggle buttons to Router ───────────────────────────
      const btnBasic = document.getElementById('btn-mode-basic');
      const btnScientific = document.getElementById('btn-mode-scientific');
      const btnAdvanced = document.getElementById('btn-mode-advanced');

      if (btnBasic) {
        btnBasic.addEventListener('click', () => this.navigate('/basic'));
      }
      if (btnScientific) {
        btnScientific.addEventListener('click', () => this.navigate('/scientific'));
      }
      if (btnAdvanced) {
        btnAdvanced.addEventListener('click', () => this.navigate('/advanced'));
      }

      // Also wire any generic [data-mode] buttons
      document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const mode = e.currentTarget.getAttribute('data-mode');
          if (mode === 'advanced') {
            this.navigate('/advanced');
          } else if (mode === 'scientific') {
            this.navigate('/scientific');
          } else if (mode === 'basic') {
            this.navigate('/basic');
          }
        });
      });

      // ── Listen for browser back / forward navigation ──────────────
      window.addEventListener('hashchange', () => this._handleRouteChange());

      // ── Initial route resolution ──────────────────────────────────
      const initialHash = window.location.hash ? this._normalize(window.location.hash) : null;
      let targetRoute = this.defaultPublicRoute;

      if (initialHash && this.routes.has(initialHash)) {
        targetRoute = initialHash;
      } else if (window.__SERVER_ROUTE__ && window.__SERVER_ROUTE__.includes('advanced')) {
        targetRoute = '/advanced';
      } else if (window.__SERVER_ROUTE__ && window.__SERVER_ROUTE__.includes('scientific')) {
        targetRoute = '/scientific';
      }

      this._handleRouteChange(targetRoute);
    }
  }

  window.Router = new AppRouter();
})();
