/**
 * static/template/js/components/app.js
 * AuthGuard — Template Module Application Bootstrapper
 */
(function (window) {
  'use strict';

  function initTemplateApp() {
    console.log('🚀 [Template Module] Initializing application components...');

    // 1. Initialize Main Page routes and event listeners
    if (window.TemplateMainPage && typeof window.TemplateMainPage.init === 'function') {
      window.TemplateMainPage.init();
    }

    // 2. Initialize in-page Router
    if (window.TemplateRouter && typeof window.TemplateRouter.init === 'function') {
      window.TemplateRouter.init();
    }

    console.log('✅ [Template Module] Application fully ready.');
  }

  // Auto-boot on DOM ready
  if (typeof window.onAppReady === 'function') {
    window.onAppReady(initTemplateApp);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTemplateApp);
  } else {
    initTemplateApp();
  }

  // Export
  window.TemplateApp = {
    init: initTemplateApp
  };

})(window);
