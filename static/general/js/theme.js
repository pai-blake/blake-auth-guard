/**
 * static/js/theme.js
 * Theme Module — Dark / Light Mode Switching
 *
 * Exposes window.ThemeEngine ({ get, set, toggle }) so ANY theme button can
 * drive it: the app-header toggle and the chat window's theme button.
 */
(function () {
  const THEME_KEY = 'authguard_theme_pref';

  function updateThemeIcons(theme) {
    const iconDark  = document.getElementById('theme-icon-dark');
    const iconLight = document.getElementById('theme-icon-light');
    if (!iconDark || !iconLight) return;
    if (theme === 'light') {
      iconDark.classList.add('hidden');
      iconLight.classList.remove('hidden');
    } else {
      iconDark.classList.remove('hidden');
      iconLight.classList.add('hidden');
    }
  }

  function get() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcons(theme);
  }

  function toggle() {
    const next = get() === 'dark' ? 'light' : 'dark';
    set(next);
    if (window.showToast) window.showToast(`Switched to ${next} theme`, 'info', 2000);
    return next;
  }

  // Public engine — used by the header button and the chat theme button.
  window.ThemeEngine = { get, set, toggle };

  window.initTheme = function () {
    set(localStorage.getItem(THEME_KEY) || 'light');
  };

  window.onAppReady(() => {
    window.initTheme();
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => window.ThemeEngine.toggle());
    }
  });
})();
