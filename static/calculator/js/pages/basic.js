/**
 * static/calculator/js/pages/basic.js
 * Basic Calculator Page Controller — Number input, operators, clear, delete, equals
 */
(function () {
  window.onAppReady(() => {
    const getCalc = () => window.calculator;

    const basicContainer = document.getElementById('view-basic');
    if (!basicContainer) return;

    // Number buttons
    basicContainer.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.appendNumber(e.currentTarget.dataset.number);
      });
    });

    // Operator buttons
    basicContainer.querySelectorAll('.operator-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.setOperation(e.currentTarget.dataset.operator);
      });
    });

    // Decimal button
    basicContainer.querySelectorAll('.decimal-btn, [data-action="decimal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.appendDecimal();
      });
    });

    // Clear button
    basicContainer.querySelectorAll('.clear-btn, [data-action="clear"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.clear();
      });
    });

    // Delete button
    basicContainer.querySelectorAll('.delete-btn, [data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.delete();
      });
    });

    // Equals button
    basicContainer.querySelectorAll('.equals-btn, [data-action="calculate"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.calculate();
      });
    });
  });
})();
