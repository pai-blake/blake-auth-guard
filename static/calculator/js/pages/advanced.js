/**
 * static/calculator/js/pages/advanced.js
 * Advanced Mathematics Page Controller
 * Handles Calculus (Differentiation, Integration, Limits, Summation), Matrices, and Advanced Operators.
 */
(function () {
  window.onAppReady(() => {
    const getCalc = () => window.calculator;
    const advContainer = document.getElementById('view-advanced');
    if (!advContainer) return;

    // ── Standard Keypad wiring ──────────────────────────────────────────
    // Numbers
    advContainer.querySelectorAll('.number-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.appendNumber(e.currentTarget.dataset.number);
      });
    });

    // Operators (+, -, *, /, ^)
    advContainer.querySelectorAll('.operator-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        if (calc) calc.setOperation(e.currentTarget.dataset.operator);
      });
    });

    // Advanced 2-operand operations (gcd, lcm, mod, nPr, nCr)
    advContainer.querySelectorAll('[data-adv-op]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        const op = e.currentTarget.dataset.advOp;
        if (calc && op) calc.setOperation(op);
      });
    });

    // Decimal
    advContainer.querySelectorAll('.decimal-btn, [data-action="decimal"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.appendDecimal();
      });
    });

    // Clear
    advContainer.querySelectorAll('.clear-btn, [data-action="clear"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.clear();
      });
    });

    // Delete
    advContainer.querySelectorAll('.delete-btn, [data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.delete();
      });
    });

    // Equals
    advContainer.querySelectorAll('.equals-btn, [data-action="calculate"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.calculate();
      });
    });

    // Parentheses ( ( and ) )
    advContainer.querySelectorAll('[data-action="paren-open"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.appendParenthesis('(');
      });
    });

    advContainer.querySelectorAll('[data-action="paren-close"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.appendParenthesis(')');
      });
    });

    // Standard & Scientific Single-Argument Functions (sinh, cosh, sqrt, cbrt, log2, etc.)
    advContainer.querySelectorAll('[data-func]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        const func = e.currentTarget.dataset.func;
        if (calc && func) calc.appendFunction(func);
      });
    });

    // Constants (π, e)
    advContainer.querySelectorAll('[data-const]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const calc = getCalc();
        const name = e.currentTarget.dataset.const;
        if (calc && name) calc.insertConstant(name);
      });
    });

    // RAD / DEG Angle Mode Button
    const angleBtn = document.getElementById('btn-angle-mode');
    if (angleBtn) {
      angleBtn.addEventListener('click', () => {
        const calc = getCalc();
        if (calc) calc.toggleAngleMode();
      });
    }

    // ── Interactive Calculus & Higher Math Modal Dialog ──────────────────
    const dialog = document.getElementById('adv-math-dialog');
    const dialogTitle = document.getElementById('adv-dialog-title');
    const dialogBody = document.getElementById('adv-dialog-body');
    const dialogForm = document.getElementById('adv-dialog-form');
    const dialogCancel = document.getElementById('adv-dialog-cancel');
    const dialogCloseBtn = document.getElementById('adv-dialog-close-btn');

    let currentAction = null;

    function openDialog(action) {
      if (!dialog) return;
      currentAction = action;

      if (action === 'diff') {
        dialogTitle.textContent = 'Numerical Differentiation (d/dx)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-diff-formula">Function f(x):</label>
            <input type="text" id="adv-diff-formula" value="x^3 + 2*x" placeholder="e.g. x^2, sin(x), exp(x)" required autofocus />
          </div>
          <div class="adv-form-group">
            <label for="adv-diff-x0">Point x₀:</label>
            <input type="number" step="any" id="adv-diff-x0" value="2" required />
          </div>
        `;
      } else if (action === 'integral') {
        dialogTitle.textContent = 'Definite Integration (∫ dx)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-int-formula">Function f(x):</label>
            <input type="text" id="adv-int-formula" value="x^2" placeholder="e.g. x^2, sin(x), 1/x" required autofocus />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div class="adv-form-group">
              <label for="adv-int-a">Lower Bound (a):</label>
              <input type="number" step="any" id="adv-int-a" value="0" required />
            </div>
            <div class="adv-form-group">
              <label for="adv-int-b">Upper Bound (b):</label>
              <input type="number" step="any" id="adv-int-b" value="3" required />
            </div>
          </div>
        `;
      } else if (action === 'sum') {
        dialogTitle.textContent = 'Summation (Σ)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-sum-formula">Expression f(n):</label>
            <input type="text" id="adv-sum-formula" value="n^2" placeholder="e.g. 1/n, 2^n" required autofocus />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <div class="adv-form-group">
              <label for="adv-sum-a">Start n=a:</label>
              <input type="number" id="adv-sum-a" value="1" required />
            </div>
            <div class="adv-form-group">
              <label for="adv-sum-b">End n=b:</label>
              <input type="number" id="adv-sum-b" value="10" required />
            </div>
          </div>
        `;
      } else if (action === 'lim') {
        dialogTitle.textContent = 'Limit (lim x→a)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-lim-formula">Function f(x):</label>
            <input type="text" id="adv-lim-formula" value="sin(x)/x" placeholder="e.g. sin(x)/x" required autofocus />
          </div>
          <div class="adv-form-group">
            <label for="adv-lim-a">Approach Point a:</label>
            <input type="number" step="any" id="adv-lim-a" value="0" required />
          </div>
        `;
      } else if (action === 'det') {
        dialogTitle.textContent = 'Matrix Determinant (det)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-matrix-size">Matrix Dimension:</label>
            <select id="adv-matrix-size">
              <option value="2">2 × 2 Matrix</option>
              <option value="3">3 × 3 Matrix</option>
            </select>
          </div>
          <div class="adv-matrix-grid" id="adv-matrix-inputs">
            <input type="number" step="any" value="4" required />
            <input type="number" step="any" value="2" required />
            <input type="number" step="any" value="1" required />
            <input type="number" step="any" value="3" required />
          </div>
        `;

        const sizeSelect = dialogBody.querySelector('#adv-matrix-size');
        const matrixGrid = dialogBody.querySelector('#adv-matrix-inputs');

        sizeSelect.addEventListener('change', (e) => {
          const s = Number(e.target.value);
          if (s === 2) {
            matrixGrid.className = 'adv-matrix-grid';
            matrixGrid.innerHTML = `
              <input type="number" step="any" value="4" required />
              <input type="number" step="any" value="2" required />
              <input type="number" step="any" value="1" required />
              <input type="number" step="any" value="3" required />
            `;
          } else {
            matrixGrid.className = 'adv-matrix-grid grid-3x3';
            matrixGrid.innerHTML = `
              <input type="number" step="any" value="1" required />
              <input type="number" step="any" value="2" required />
              <input type="number" step="any" value="3" required />
              <input type="number" step="any" value="0" required />
              <input type="number" step="any" value="1" required />
              <input type="number" step="any" value="4" required />
              <input type="number" step="any" value="5" required />
              <input type="number" step="any" value="6" required />
              <input type="number" step="any" value="0" required />
            `;
          }
        });
      } else if (action === 'eval') {
        dialogTitle.textContent = 'Evaluate Function f(x)';
        dialogBody.innerHTML = `
          <div class="adv-form-group">
            <label for="adv-eval-formula">Function f(x):</label>
            <input type="text" id="adv-eval-formula" value="3*x^2 + 5*x - 2" required autofocus />
          </div>
          <div class="adv-form-group">
            <label for="adv-eval-x">Value of x:</label>
            <input type="number" step="any" id="adv-eval-x" value="4" required />
          </div>
        `;
      }

      dialog.showModal();
    }

    // Bind Advanced buttons with modal actions
    advContainer.querySelectorAll('[data-adv]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.adv;
        if (action) openDialog(action);
      });
    });

    if (dialogCancel) dialogCancel.addEventListener('click', () => dialog.close());
    if (dialogCloseBtn) dialogCloseBtn.addEventListener('click', () => dialog.close());

    if (dialogForm) {
      dialogForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const calc = getCalc();
        if (!calc) return;

        if (currentAction === 'diff') {
          const formula = document.getElementById('adv-diff-formula').value;
          const x0 = document.getElementById('adv-diff-x0').value;
          calc.differentiate(formula, x0);
        } else if (currentAction === 'integral') {
          const formula = document.getElementById('adv-int-formula').value;
          const a = document.getElementById('adv-int-a').value;
          const b = document.getElementById('adv-int-b').value;
          calc.integrate(formula, a, b);
        } else if (currentAction === 'sum') {
          const formula = document.getElementById('adv-sum-formula').value;
          const a = document.getElementById('adv-sum-a').value;
          const b = document.getElementById('adv-sum-b').value;
          calc.summation(formula, a, b);
        } else if (currentAction === 'lim') {
          const formula = document.getElementById('adv-lim-formula').value;
          const a = document.getElementById('adv-lim-a').value;
          calc.limit(formula, a);
        } else if (currentAction === 'det') {
          const inputs = Array.from(dialogBody.querySelectorAll('#adv-matrix-inputs input')).map(inp => parseFloat(inp.value) || 0);
          const size = Math.sqrt(inputs.length);
          const matrix = [];
          for (let i = 0; i < size; i++) {
            matrix.push(inputs.slice(i * size, (i + 1) * size));
          }
          calc.matrixDeterminant(matrix);
        } else if (currentAction === 'eval') {
          const formula = document.getElementById('adv-eval-formula').value;
          const x = parseFloat(document.getElementById('adv-eval-x').value);
          // Substitute x into the formula and evaluate
          const subbed = formula.replace(/\bx\b/gi, `(${x})`);
          const result = calc.evaluateFormula(subbed);
          if (result === null || isNaN(result) || !isFinite(result)) {
            calc.showToast('Invalid formula or value for f(x)', 'error');
          } else {
            const formatted = calc.formatResult(result);
            const label = `f(${x}) = ${formula}`;
            calc.expression = label;
            calc.lastResult = formatted;
            calc.isEvaluated = true;
            calc.addHistoryEntry(label, formatted);
            calc.updateDisplay();
            if (window.UI) window.UI.updateResult(formatted);
          }

        }

        dialog.close();
      });
    }
  });
})();
