/**
 * static/calendar/js/components/app.js
 * AuthGuard — Calendar Module Bootstrap Entry Point
 */
(function (window) {
  'use strict';

  async function initCalendarApp() {
    console.log('[Calendar Module] Initializing application...');

    // 1. Initialize view router
    if (window.CalendarRouter && typeof window.CalendarRouter.init === 'function') {
      window.CalendarRouter.init();
    }

    // 2. Initialize page handlers, listeners & modals
    if (window.CalendarMainPage && typeof window.CalendarMainPage.init === 'function') {
      window.CalendarMainPage.init();
    }

    // 3. Trigger initial view render
    if (window.CalendarRouter && typeof window.CalendarRouter.refreshCurrentView === 'function') {
      window.CalendarRouter.refreshCurrentView();
    }

    // 4. Fetch events from server
    if (window.CalendarCore && typeof window.CalendarCore.fetchEvents === 'function') {
      await window.CalendarCore.fetchEvents();
    }

    console.log('✅ [Calendar Module] Application fully initialized and ready.');
  }

  // Auto-boot on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendarApp);
  } else {
    initCalendarApp();
  }

  // Export globally
  window.CalendarApp = { init: initCalendarApp };
})(window);
