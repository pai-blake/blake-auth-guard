/**
 * static/auth/js/app.js
 * Auth Module Bootstrapper
 */
(function () {
  window.onAppReady(() => {
    console.log('🚀 [Auth Module] Initializing application...');
    if (window.Theme && typeof window.Theme.init === 'function') {
      window.Theme.init();
    }
    if (window.Router && typeof window.Router.init === 'function') {
      window.Router.init();
    }
  });
})();
