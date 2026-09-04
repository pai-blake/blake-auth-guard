/**
 * static/contact/js/components/app.js
 * AuthGuard — Contact Module Bootstrap Entry Point
 */
(function (window) {
  'use strict';

  function initContactApp() {
    console.log('[Contact Module] Initializing application...');

    // 1. Initialize page logic & event bindings
    if (window.ContactMainPage && typeof window.ContactMainPage.init === 'function') {
      window.ContactMainPage.init();
    }

    // 2. Initialize in-page router (switches to active hash route)
    if (window.ContactRouter && typeof window.ContactRouter.init === 'function') {
      window.ContactRouter.init();
    }

    console.log('✅ [Contact Module] Application fully initialized and ready.');
  }

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactApp);
  } else {
    initContactApp();
  }

  // Export globally
  window.ContactApp = { init: initContactApp };
})(window);
