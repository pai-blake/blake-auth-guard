/**
 * static/template/js/components/router.js
 * AuthGuard — Template Module In-Page Routing Controller Backbone
 *
 * Developer Guide:
 *  Use TemplateRouter to manage in-page views, tab switching, URL hash synchronization,
 *  and system permission authorization guards.
 *
 * Flow:
 *  - Base URL: /template
 *  - Overview:     /template#/overview
 *  - Docs/Guide:   /template#/docs
 *  - Settings:     /template#/settings
 *  - Serious flow: /body (full server redirect)
 */
(function (window) {
  'use strict';

  class TemplateRouter {
    constructor() {
      this.routes = new Map();
      this.defaultRoute = '/overview';
      this.currentRoute = null;
    }

    /** Workspace destination route */
    getSessionRoute() {
      return '/body';
    }

    /** Register a route with permissions & handler */
    register(path, config) {
      this.routes.set(this._normalize(path), {
        authRequired: config.authRequired || false,
        permissionRequired: config.permissionRequired || null,
        viewId:       config.viewId       || null,
        onEnter:      config.onEnter      || null,
        title:        config.title        || 'AuthGuard — Template',
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
      if (!path) return this.defaultRoute;
      const clean = path.replace(/^#\/?/, '/').replace(/\/+$/, '') || '/';
      return clean.startsWith('/') ? clean : '/' + clean;
    }

    /** Core route resolution and auth guard logic */
    _handleRouteChange(targetPath, params = {}) {
      const rawHash = window.location.hash;
      const path = targetPath || (rawHash ? this._normalize(rawHash) : this.defaultRoute);
      const route = this.routes.get(path) || this.routes.get(this.defaultRoute);
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
          this.navigate(this.defaultRoute);
          return;
        }
      }

      this.currentRoute = path;

      // Update page title
      if (route && route.title) {
        document.title = `${route.title} — AuthGuard`;
      }

      // Server-side redirect (for cross-module destinations)
      if (route && route.redirect) {
        window.location.href = route.redirect;
        return;
      }

      // Switch the visible view
      if (route && route.viewId && window.TemplateUI) {
        const viewEl = document.getElementById(route.viewId);
        if (viewEl) window.TemplateUI.switchView(viewEl);
      }

      // onEnter lifecycle hook
      if (route && typeof route.onEnter === 'function') {
        try {
          route.onEnter({ path, params, user });
        } catch (err) {
          console.error(`[TemplateRouter] Error in onEnter for ${path}:`, err);
        }
      }
    }

    /** Initialize routing event listeners */
    init() {
      // Hash change listener
      window.addEventListener('hashchange', () => {
        this._handleRouteChange();
      });

      // Intercept clicks on internal data-route elements
      document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-route]');
        if (target) {
          e.preventDefault();
          const route = target.getAttribute('data-route');
          this.navigate(route);
        }
      });

      // Initial route resolution
      this._handleRouteChange();
      console.log('[TemplateRouter] Router initialized.');
    }
  }

  // Export globally
  window.TemplateRouter = new TemplateRouter();
})(window);
