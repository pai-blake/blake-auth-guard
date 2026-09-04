/**
 * static/js/loader.js
 * Ready-state coordinator.
 *
 * In v2 the HTML partials are server-rendered into the page shell by Jinja
 * includes, so there is nothing to fetch. This module only provides the
 * `onAppReady` hook that every view handler and app.js rely on.
 */
(function () {
  window.__partialsLoaded = false;

  window.onAppReady = function (callback) {
    if (window.__partialsLoaded) {
      callback();
    } else {
      document.addEventListener('partials:ready', callback);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.__partialsLoaded = true;
    document.dispatchEvent(new CustomEvent('partials:ready'));
  });
})();
