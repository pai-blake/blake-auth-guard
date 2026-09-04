/**
 * static/calculator/js/components/app.js
 * Calculator Module Bootstrapper
 */
(function () {
  window.onAppReady(() => {
    console.log('🚀 [Calculator Module] Initializing application...');

    // 1. Theme initialization
    if (window.Theme && typeof window.Theme.init === 'function') {
      window.Theme.init();
    }

    // 2. Initialize Calculator Core engine (display is now a div)
    const display = document.getElementById('display');
    window.calculator = new window.CalculatorCore(display);

    // 3. Initialize Keyboard shortcuts handler
    if (window.KeyboardHandler) {
      window.keyboard = new window.KeyboardHandler(window.calculator);
      window.keyboard.init();
    }

    // 4. In-page Router initialization (page-to-page navigation)
    if (window.Router && typeof window.Router.init === 'function') {
      window.Router.init();
    }
  });
})();
