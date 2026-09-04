/**
 * static/contact/js/components/router.js
 * AuthGuard — Contact Module In-Page Routing Controller
 */
(function (window) {
  'use strict';

  class ContactRouter {
    constructor() {
      this.routes = new Map();
      this.defaultRoute = '/search';
      this.currentRoute = null;
    }

    /** Register route handler */
    register(path, config) {
      this.routes.set(this._normalize(path), {
        authRequired: config.authRequired || false,
        permissionRequired: config.permissionRequired || null,
        viewId: config.viewId || null,
        onEnter: config.onEnter || null,
        title: config.title || 'Contacts',
      });
      return this;
    }

    /** Unregister route */
    unregister(path) {
      this.routes.delete(this._normalize(path));
      return this;
    }

    /** Navigate to a route */
    navigate(path, params = {}) {
      const cleanPath = this._normalize(path);
      window.location.hash = '#' + cleanPath;
      this._handleRouteChange(cleanPath, params);
    }

    /** Normalize route path */
    _normalize(path) {
      if (!path) return this.defaultRoute;
      const clean = path.replace(/^#\/?/, '/').replace(/\/+$/, '') || '/';
      return clean.startsWith('/') ? clean : '/' + clean;
    }

    /** Resolve route and update DOM */
    _handleRouteChange(targetPath, params = {}) {
      const rawHash = window.location.hash;
      const path = targetPath || (rawHash ? this._normalize(rawHash) : this.defaultRoute);
      const route = this.routes.get(path) || this.routes.get(this.defaultRoute);
      const user = window.DB ? window.DB.getCurrentUser() : null;

      this.currentRoute = path;

      // Update page title
      if (route && route.title) {
        document.title = `AuthGuard — ${route.title}`;
      }

      // Switch view
      if (route && route.viewId && window.ContactUI) {
        const viewEl = document.getElementById(route.viewId);
        if (viewEl) window.ContactUI.switchView(viewEl);
      }

      // onEnter hook
      if (route && typeof route.onEnter === 'function') {
        try {
          route.onEnter({ path, params, user });
        } catch (err) {
          console.error(`[ContactRouter] Error in onEnter for ${path}:`, err);
        }
      }
    }

    /** Initialize routing */
    init() {
      window.addEventListener('hashchange', () => {
        this._handleRouteChange();
      });

      document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-route]');
        if (target) {
          e.preventDefault();
          const route = target.getAttribute('data-route');
          this.navigate(route);
        }
      });

      this._handleRouteChange();
      console.log('[ContactRouter] Router initialized.');
    }
  }

  // Export globally
  window.ContactRouter = new ContactRouter();
})(window);
