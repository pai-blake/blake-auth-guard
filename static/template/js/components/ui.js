/**
 * static/template/js/components/ui.js
 * AuthGuard — Template Module UI Helpers & View Switcher Backbone
 *
 * Developer Guide:
 *  Use TemplateUI to manage DOM updates, toggle views, show notifications,
 *  and bind interactive UI elements.
 */
(function (window) {
  'use strict';

  class TemplateUI {
    constructor() {
      this.activeViewId = null;
    }

    /** Switch the active view container */
    switchView(targetViewEl) {
      if (!targetViewEl) return;

      // Hide all views
      const views = document.querySelectorAll('.tpl-view');
      views.forEach(v => v.classList.remove('active'));

      // Show the target
      targetViewEl.classList.add('active');
      this.activeViewId = targetViewEl.id;

      // Sync active state on nav buttons
      const navBtns = document.querySelectorAll('.tpl-nav-btn');
      navBtns.forEach(btn => {
        const route = btn.getAttribute('data-route') || '';
        const viewSuffix = targetViewEl.id.replace('tpl-view-', '');
        btn.classList.toggle('active', route === '/' + viewSuffix);
        btn.setAttribute('aria-selected', route === '/' + viewSuffix ? 'true' : 'false');
      });
    }

    /** Trigger a toast notification */
    notify(message, type = 'info', duration = 3000) {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
      } else {
        console.log(`[TemplateUI] ${type.toUpperCase()}: ${message}`);
      }
    }

    /** Update a text node safely */
    setText(elementId, text) {
      const el = document.getElementById(elementId);
      if (el) el.textContent = text;
    }
  }

  // Export globally
  window.TemplateUI = new TemplateUI();
})(window);
