/**
 * static/home/js/pages/dashboard.js
 * AuthGuard — Home Dashboard Page Initializer & Component Coordinator
 */
(function (window) {
  'use strict';

  function initDashboard() {
    console.log('🚀 [Home Dashboard] Initialized modular components (Profile, Apps, Modals).');

    // 1. Initialize Apps Panel (Search, Sort, Launch Tracker)
    if (window.HomeApps) {
      window.HomeApps.initSearch();
      window.HomeApps.initSort();
      window.HomeApps.initLaunchTracking();
    }

    // 2. Initialize Profile Panel (Avatar Upload, View Mode / Edit Mode Swap, DB Sync)
    if (window.HomeProfile) {
      window.HomeProfile.initAvatarUpload();
      window.HomeProfile.initProfileSync();
    }

    // 3. Initialize Modals (Unsaved Navigation Guard & Account Deletion)
    if (window.HomeModals) {
      window.HomeModals.initUnsavedChangesGuard();
      window.HomeModals.initAccountDeletion();
    }
  }

  // Auto-boot on DOM ready
  if (typeof window.onAppReady === 'function') {
    window.onAppReady(initDashboard);
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }

  // Export
  window.HomeDashboard = {
    init: initDashboard
  };

})(window);
