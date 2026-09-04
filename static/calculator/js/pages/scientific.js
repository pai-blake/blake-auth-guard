/**
 * static/calculator/js/pages/scientific.js
 * Scientific Calculator Page Controller
 */
(function () {
  window.onAppReady(() => {
    const getCalc = () => window.calculator;
    const sciContainer = document.getElementById('view-scientific');
    if (!sciContainer) return;

    // Number buttons
    sciContainer.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.appendNumber(e.currentTarget.dataset.number);
      });
    });

    // Operator buttons
    sciContainer.querySelectorAll('.operator-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.setOperation(e.currentTarget.dataset.operator);
      });
    });

    // Decimal button
    sciContainer.querySelectorAll('.decimal-btn, [data-action="decimal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.appendDecimal();
      });
    });

    // Clear button
    sciContainer.querySelectorAll('.clear-btn, [data-action="clear"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.clear();
      });
    });

    // Delete button
    sciContainer.querySelectorAll('.delete-btn, [data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.delete();
      });
    });

    // Equals button
    sciContainer.querySelectorAll('.equals-btn, [data-action="calculate"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.calculate();
      });
    });

    // Function buttons (sin, cos, tan, sqrt, log, ln, factorial, percent, power, power-n)
    sciContainer.querySelectorAll('[data-func]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        const func = e.currentTarget.dataset.func;
        if (calc && func) calc.appendFunction(func);
      });
    });

    // Constant buttons (π, e)
    sciContainer.querySelectorAll('[data-const]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        const name = e.currentTarget.dataset.const;
        if (calc && name) calc.insertConstant(name);
      });
    });
  });
})();
