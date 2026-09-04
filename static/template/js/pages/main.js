/**
 * static/template/js/pages/main.js
 * AuthGuard — Template Main Page Handler & Interactive Features
 *
 * Developer Guide:
 *  Register routes and bind page-level events here.
 *  TemplateRouter, TemplateCore, and TemplateUI load before this file.
 *
 * To add a new view/tab:
 *  1. TemplateRouter.register('/myroute', { viewId: 'tpl-view-myview', ... })
 *  2. Add <section id="tpl-view-myview" class="tpl-view"> in template.html
 *  3. Add <button data-route="/myroute" class="tpl-nav-btn"> in the left nav
 */
(function (window) {
  'use strict';

  function initMainPage() {

    // ── 1. Register In-Page Routes ─────────────────────────────────────────
    if (window.TemplateRouter) {
      window.TemplateRouter
        .register('/overview', {
          viewId: 'tpl-view-overview',
          title: 'Overview',
          onEnter: function () {
            console.log('[Template] → Overview');
          }
        })
        .register('/docs', {
          viewId: 'tpl-view-docs',
          title: 'Developer Guide',
          onEnter: function () {
            console.log('[Template] → Developer Guide');
          }
        })
        .register('/globals', {
          viewId: 'tpl-view-globals',
          title: 'Global APIs',
          onEnter: function () {
            console.log('[Template] → Globals reference');
          }
        });
    }

    // ── 2. Bind Interactive Demo Button ────────────────────────────────────
    var demoBtn        = document.getElementById('template-demo-btn');
    var counterDisplay = document.getElementById('template-counter-val');

    if (demoBtn && window.TemplateCore) {
      demoBtn.addEventListener('click', function () {
        var count = window.TemplateCore.incrementCounter();
        if (counterDisplay) counterDisplay.textContent = count;
        if (window.TemplateUI) {
          window.TemplateUI.notify('Counter is now ' + count, 'success', 2000);
        }
      });
    }

    // ── 3. React to State Changes ──────────────────────────────────────────
    if (window.TemplateCore) {
      window.TemplateCore.on('stateChange', function (state) {
        console.log('[Template] State updated:', state);
      });
    }
  }

  window.TemplateMainPage = { init: initMainPage };

})(window);
