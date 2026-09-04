/**
 * static/home/js/components/apps.js
 * AuthGuard — Home Modules Grid, Search, Sort & Launch Tracking
 */
(function (window) {
  'use strict';

  var RECENT_KEY = 'hd_module_recent';

  /** Return map of { moduleId -> timestamp } from localStorage */
  function getRecentMap() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  /** Record that a module was launched now */
  function recordLaunch(moduleId) {
    var map = getRecentMap();
    map[moduleId] = Date.now();
    localStorage.setItem(RECENT_KEY, JSON.stringify(map));
  }

  /** Initialize live search filtering for module cards */
  function initSearch() {
    var searchInput = document.getElementById('hd-search-input');
    var appCards    = document.querySelectorAll('.hd-apps-grid .hd-app-card');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      var query = this.value.trim().toLowerCase();
      appCards.forEach(function (card) {
        if (card.classList.contains('hd-app-card--add')) return;
        var name = (card.dataset.name || '').toLowerCase();
        card.classList.toggle('hd-hidden', query.length > 0 && !name.includes(query));
      });
    });
  }

  /** Sort module cards in DOM */
  function sortCards(order) {
    var appsGrid = document.getElementById('hd-apps-grid');
    if (!appsGrid) return;

    var addCard = appsGrid.querySelector('.hd-app-card--add');
    var cards   = Array.from(appsGrid.querySelectorAll('.hd-app-card:not(.hd-app-card--add)'));
    var recent  = getRecentMap();

    if (order === 'recent') {
      cards.sort(function (a, b) {
        var ta = recent[a.id] || 0;
        var tb = recent[b.id] || 0;
        if (tb !== ta) return tb - ta;
        return parseInt(a.dataset.index || 99, 10) - parseInt(b.dataset.index || 99, 10);
      });
    } else {
      cards.sort(function (a, b) {
        return (a.dataset.name || '').localeCompare(b.dataset.name || '');
      });
    }

    cards.forEach(function (c) { appsGrid.insertBefore(c, addCard); });
  }

  /** Initialize sort select dropdown */
  function initSort() {
    var sortSelect = document.getElementById('hd-sort-select');
    if (!sortSelect) return;

    sortCards(sortSelect.value);

    sortSelect.addEventListener('change', function () {
      sortCards(this.value);
    });
  }

  /** Track launches on card clicks */
  function initLaunchTracking() {
    var appsGrid = document.getElementById('hd-apps-grid');
    if (!appsGrid) return;

    appsGrid.addEventListener('click', function (e) {
      var card = e.target.closest('.hd-app-card:not(.hd-app-card--add)');
      if (card && card.id) {
        recordLaunch(card.id);
      }
    });
  }

  // Export module
  window.HomeApps = {
    initSearch: initSearch,
    initSort: initSort,
    initLaunchTracking: initLaunchTracking,
    sortCards: sortCards,
    recordLaunch: recordLaunch
  };

})(window);
