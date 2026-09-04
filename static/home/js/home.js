/**
 * static/home/js/home.js
 * AuthGuard — Home Module Master Script (Bundles or orchestrates sub-components)
 */
(function (window) {
  'use strict';

  // Sub-components are loaded via shell.html or modular script tags:
  // - static/home/js/components/profile.js
  // - static/home/js/components/apps.js
  // - static/home/js/components/modals.js
  // - static/home/js/pages/dashboard.js

  if (window.HomeDashboard && typeof window.HomeDashboard.init === 'function') {
    window.HomeDashboard.init();
  }
})(window);
