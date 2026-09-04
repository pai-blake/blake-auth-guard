/**
 * static/calculator/js/components/core.js
 * Calculator Core Operations Engine (Formula Expression Builder + Symbol Parser)
 * 
 * Rules:
 * 1. Continuous expression typing without premature evaluation (e.g. (9+9)-6/9...).
 * 2. Mathematical symbols throughout display and history: √(5), 5², 5³, 5!, ×, ÷, −, π, e.
 * 3. Evaluates and displays result only when the user presses Equal (=).
 * 4. Temporary session history saved in browser's sessionStorage.
 */
(function () {
  const STORAGE_KEY = 'calc_session_history';

  // Math symbol dictionary for function keywords
  const FUNC_SYMBOLS = {
    'sqrt': '√(',
    'cbrt': '∛(',
    'power': '²',
    'cube': '³',
    'power-n': '^',
    'reciprocal': '⁻¹',
    'abs': '|',
    'factorial': '!',
    'percent': '%',
    'sin': 'sin(',
    'cos': 'cos(',
    'tan': 'tan(',
    'asin': 'asin(',
    'acos': 'acos(',
    'atan': 'atan(',
    'sinh': 'sinh(',
    'cosh': 'cosh(',
    'tanh': 'tanh(',
    'log': 'log(',
    'log2': 'log₂(',
    'ln': 'ln(',
    'exp': 'e^('
  };

  const CONST_SYMBOLS = {
    'pi': 'π',
    'euler': 'e'
  };

  const OP_SYMBOLS = {
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷',
    '^': '^',
    'mod': ' mod ',
    'gcd': ' gcd ',
    'lcm': ' lcm ',
    'nPr': ' P ',
    'nCr': ' C '
  };

  // Helper: Factorial
  function factorial(n) {
    if (n < 0 || n > 170) return NaN;
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Helper: GCD
  function gcd(a, b) {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  // Helper: LCM
  function lcm(a, b) {
    if (a === 0 || b === 0) return 0;
    return Math.abs((a * b) / gcd(a, b));
  }

  // Helper: nPr
  function nPr(n, r) {
    n = Math.round(n);
    r = Math.round(r);
    if (r < 0 || r > n) return 0;
    return factorial(n) / factorial(n - r);
  }

  // Helper: nCr
  function nCr(n, r) {
    n = Math.round(n);
    r = Math.round(r);
    if (r < 0 || r > n) return 0;
    return factorial(n) / (factorial(r) * factorial(n - r));
  }

  class CalculatorCore {
    constructor() {
      this.expression = '';        // Active raw formula string being typed
      this.isEvaluated = false;    // True right after = is clicked
      this.lastResult = null;      // Last numeric result
      this.angleMode = 'RAD';      // 'RAD' or 'DEG'

      // Session history stored in browser sessionStorage
      this.history = this.loadHistoryFromSession();

      this.initHistoryUI();
      this.initHardwareInput();
      this.updateDisplay();
    }

    // ── Direct Hardware Input Synchronization ────────────────────────────
    initHardwareInput() {
      const inputEl = document.getElementById('display-expression');
      const displayContainer = document.getElementById('calculator-display');

      if (displayContainer && inputEl) {
        displayContainer.addEventListener('click', (e) => {
          // If user clicks on display, focus input at end
          if (e.target !== inputEl && !e.target.closest('#display-history')) {
            inputEl.focus();
          }
        });
      }

      if (inputEl && inputEl.tagName === 'INPUT') {
        inputEl.addEventListener('input', (e) => {
          this.expression = e.target.value;
          this.isEvaluated = false;
          this.lastResult = null;
          if (window.UI && typeof window.UI.updateResult === 'function') {
            window.UI.updateResult('');
          }
        });

        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.calculate();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            this.clear();
          }
        });
      }
    }

    // ── Angle Mode (RAD / DEG) ────────────────────────────────────────────
    toggleAngleMode() {
      this.angleMode = this.angleMode === 'RAD' ? 'DEG' : 'RAD';
      const btn = document.getElementById('btn-angle-mode');
      if (btn) btn.textContent = this.angleMode;
      this.showToast(`Trig angle mode: ${this.angleMode}`, 'info');
    }

    // ── Session Storage History ───────────────────────────────────────────
    loadHistoryFromSession() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('Could not load session history', e);
      }
      return [];
    }

    saveHistoryToSession() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
      } catch (e) {
        console.warn('Could not save session history', e);
      }
    }

    addHistoryEntry(exprStr, resultStr) {
      const full = `${exprStr} = ${resultStr}`;
      const entry = {
        expression: exprStr,
        result: resultStr,
        full: full,
        timestamp: Date.now()
      };

      this.history.push(entry);
      if (this.history.length > 30) {
        this.history.shift();
      }

      this.saveHistoryToSession();
      this.renderHistoryUI();
    }

    clearSessionHistory() {
      this.history = [];
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      this.renderHistoryUI();
      this.showToast('Calculation history cleared', 'info');
    }

    initHistoryUI() {
      const clearBtn = document.getElementById('btn-clear-history');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearSessionHistory());
      }
      this.renderHistoryUI();
    }

    renderHistoryUI() {
      if (window.UI && typeof window.UI.renderHistory === 'function') {
        window.UI.renderHistory(this.history, (item) => {
          // When clicking a past history entry, reuse its result or expression
          this.expression = item.result !== 'Error' ? String(item.result) : '';
          this.isEvaluated = false;
          this.lastResult = null;
          this.updateDisplay();
        });
      }
    }

    // ── Formula Writing & Token Appending ─────────────────────────────────

    appendNumber(num) {
      const digit = String(num);

      if (this.isEvaluated) {
        // Start fresh calculation after an equals evaluation
        this.expression = digit;
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (this.expression === '0') {
          this.expression = digit;
        } else {
          this.expression += digit;
        }
      }

      this.updateDisplay();
    }

    appendDecimal() {
      if (this.isEvaluated) {
        this.expression = '0.';
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (!this.expression) {
          this.expression = '0.';
        } else {
          // Check if current number chunk already has a decimal
          const lastToken = this.expression.split(/[\+\−\×\÷\^\(\)\s]/).pop();
          if (!lastToken.includes('.')) {
            this.expression += '.';
          }
        }
      }

      this.updateDisplay();
    }

    setOperation(op) {
      const symbol = OP_SYMBOLS[op] || op;

      if (this.isEvaluated && this.lastResult !== null) {
        // Continue from previous result: e.g. "18 + "
        this.expression = String(this.lastResult) + symbol;
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (this.expression === '' && (symbol === '+' || symbol === '−' || symbol === '-')) {
          this.expression = symbol;
        } else if (this.expression !== '') {
          // Replace trailing operator if any
          const trailingOps = ['+', '−', '×', '÷', '^'];
          const lastChar = this.expression[this.expression.length - 1];
          if (trailingOps.includes(lastChar)) {
            this.expression = this.expression.slice(0, -1) + symbol;
          } else {
            this.expression += symbol;
          }
        }
      }

      this.updateDisplay();
    }

    appendFunction(func) {
      const symbol = FUNC_SYMBOLS[func] || `${func}(`;

      if (this.isEvaluated) {
        if (symbol === '²' || symbol === '³' || symbol === '⁻¹' || symbol === '!' || symbol === '%') {
          this.expression = String(this.lastResult) + symbol;
        } else if (symbol === '√(' || symbol === '∛(') {
          // If continuing from evaluated result: wrap it, e.g. √(16)
          this.expression = symbol + String(this.lastResult) + ')';
        } else {
          this.expression = symbol;
        }
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (this.expression === '0') {
          this.expression = symbol;
        } else if ((symbol === '√(' || symbol === '∛(') && /[\d.)]$/.test(this.expression)) {
          // If preceded by a number or closing paren, wrap the preceding operand e.g. 9 -> √(9)
          const match = this.expression.match(/(\([^()]*\)|[\d.]+)$/);
          if (match) {
            const prefix = this.expression.slice(0, match.index);
            this.expression = prefix + symbol + match[0] + ')';
          } else {
            this.expression += symbol;
          }
        } else {
          this.expression += symbol;
        }
      }

      this.updateDisplay();
    }

    appendParenthesis(paren) {
      if (this.isEvaluated) {
        this.expression = paren;
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (this.expression === '0') {
          this.expression = paren;
        } else {
          this.expression += paren;
        }
      }

      this.updateDisplay();
    }

    insertConstant(name) {
      const symbol = CONST_SYMBOLS[name] || name;

      if (this.isEvaluated) {
        this.expression = symbol;
        this.isEvaluated = false;
        this.lastResult = null;
      } else {
        if (this.expression === '0') {
          this.expression = symbol;
        } else {
          this.expression += symbol;
        }
      }

      this.updateDisplay();
    }

    // ── Delete & Clear ────────────────────────────────────────────────────

    delete() {
      if (this.isEvaluated) {
        this.clear();
        return;
      }

      if (!this.expression) return;

      // Check multi-character keyword tokens to delete at once (e.g. "sin(", "log₂(", " mod ")
      const multiTokens = [
        'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
        'sinh(', 'cosh(', 'tanh(', 'log(', 'log₂(', 'ln(',
        'e^(', '√(', '∛(', ' mod ', ' gcd ', ' lcm ', ' P ', ' C '
      ];

      for (const tok of multiTokens) {
        if (this.expression.endsWith(tok)) {
          this.expression = this.expression.slice(0, -tok.length);
          this.updateDisplay();
          return;
        }
      }

      this.expression = this.expression.slice(0, -1);
      this.updateDisplay();
    }

    clear() {
      this.expression = '';
      this.isEvaluated = false;
      this.lastResult = null;
      this.updateDisplay();
    }

    // ── Evaluation on Equal (=) ───────────────────────────────────────────

    calculate() {
      if (!this.expression || this.expression.trim() === '') return;

      const rawFormula = this.expression.trim();
      const evaluated = this.evaluateFormula(rawFormula);

      if (evaluated === null || isNaN(evaluated) || !isFinite(evaluated)) {
        this.showToast('Syntax / Math Error in formula', 'error');
        if (window.UI && typeof window.UI.updateResult === 'function') {
          window.UI.updateResult('Error');
        }
        return;
      }

      const formattedResult = this.formatResult(evaluated);

      // Add to session history with true mathematical symbols!
      this.addHistoryEntry(rawFormula, formattedResult);

      this.lastResult = formattedResult;
      this.isEvaluated = true;

      // Update UI: Display final result on the result line
      if (window.UI) {
        if (typeof window.UI.updateExpression === 'function') {
          window.UI.updateExpression(rawFormula);
        }
        if (typeof window.UI.updateResult === 'function') {
          window.UI.updateResult(formattedResult);
        }
      }
    }

    // ── Robust Mathematical Formula Evaluator ─────────────────────────────

    evaluateFormula(expr) {
      try {
        let code = expr;

        // Auto-close unclosed parentheses
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        if (openParens > closeParens) {
          code += ')'.repeat(openParens - closeParens);
        }

        // 1. Transform symbols & powers
        code = code
          .replace(/²/g, '**2')
          .replace(/³/g, '**3')
          .replace(/⁻¹/g, '**(-1)')
          .replace(/\^/g, '**')
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/−/g, '-');

        // 2. Constants
        code = code
          .replace(/π/g, '(Math.PI)')
          .replace(/\be\b/g, '(Math.E)');

        // 3. Percent: e.g. 50% -> (50*0.01)
        code = code.replace(/(\d+(\.\d+)?)%/g, '($1*0.01)');

        // 4. Factorial: e.g. 5! -> factorial(5)
        code = code.replace(/(\d+|\([^)]+\))!/g, 'factorial($1)');

        // 5. Roots:
        // a) Postfix roots (e.g. "9√" or "(4+5)√" when not followed by digits or opening paren)
        code = code
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s*√(?!\s*[\d(])/g, 'Math.sqrt($1)')
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s*∛(?!\s*[\d(])/g, 'Math.cbrt($1)');
        // b) Prefix roots: √(x), √x, sqrt(x)
        code = code
          .replace(/√\s*\(/g, 'Math.sqrt(')
          .replace(/∛\s*\(/g, 'Math.cbrt(')
          .replace(/√\s*(\d+(\.\d+)?)/g, 'Math.sqrt($1)')
          .replace(/∛\s*(\d+(\.\d+)?)/g, 'Math.cbrt($1)')
          .replace(/(?<!Math\.)\bsqrt\s*\(/gi, 'Math.sqrt(')
          .replace(/(?<!Math\.)\bcbrt\s*\(/gi, 'Math.cbrt(');

        // 6. Implicit multiplication: 2(3), (2)(3), 2Math.sqrt(9), 2sin(30), (2)cos(60)
        code = code
          .replace(/(\d)\s*(\()/g, '$1*$2')
          .replace(/(\))\s*(\d)/g, '$1*$2')
          .replace(/(\))\s*(\()/g, '$1*$2')
          .replace(/(\d)\s*(\(Math\.PI\)|\(Math\.E\))/g, '$1*$2')
          .replace(/(\(Math\.PI\)|\(Math\.E\))\s*(\d)/g, '$1*$2')
          .replace(/(\d)\s*([a-zA-Zπ]|Math\.)/g, '$1*$2')
          .replace(/(\))\s*([a-zA-Zπ]|Math\.)/g, '$1*$2');

        // 7. Absolute value: |x| -> Math.abs(x)
        code = code.replace(/\|([^|]+)\|/g, 'Math.abs($1)');

        // 8. Logarithms & Exponential
        code = code
          .replace(/log₂\(/g, 'Math.log2(')
          .replace(/log\(/g, 'Math.log10(')
          .replace(/ln\(/g, 'Math.log(')
          .replace(/e\^\(/g, 'Math.exp(');

        // 9. Trigonometry (handling RAD vs DEG)
        // NOTE: We replace only the function-name prefix (e.g. sin( -> Math.sin() 
        // and inject angle-conversion multipliers inside the argument.
        if (this.angleMode === 'DEG') {
          code = code
            .replace(/\basin\(/g, '__asin_deg(')
            .replace(/\bacos\(/g, '__acos_deg(')
            .replace(/\batan\(/g, '__atan_deg(')
            .replace(/\bsinh\(/g, 'Math.sinh(')
            .replace(/\bcosh\(/g, 'Math.cosh(')
            .replace(/\btanh\(/g, 'Math.tanh(')
            .replace(/\bsin\(/g, '__sin_deg(')
            .replace(/\bcos\(/g, '__cos_deg(')
            .replace(/\btan\(/g, '__tan_deg(');
        } else {
          code = code
            .replace(/\basin\(/g, 'Math.asin(')
            .replace(/\bacos\(/g, 'Math.acos(')
            .replace(/\batan\(/g, 'Math.atan(')
            .replace(/\bsinh\(/g, 'Math.sinh(')
            .replace(/\bcosh\(/g, 'Math.cosh(')
            .replace(/\btanh\(/g, 'Math.tanh(')
            .replace(/\bsin\(/g, 'Math.sin(')
            .replace(/\bcos\(/g, 'Math.cos(')
            .replace(/\btan\(/g, 'Math.tan(');
        }

        // 10. Binary functions: gcd, lcm, mod, nPr, nCr
        code = code
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s+gcd\s+(\d+(\.\d+)?|\([^)]+\))/g, 'gcd($1, $3)')
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s+lcm\s+(\d+(\.\d+)?|\([^)]+\))/g, 'lcm($1, $3)')
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s+mod\s+(\d+(\.\d+)?|\([^)]+\))/g, '($1 % $3)')
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s+P\s+(\d+(\.\d+)?|\([^)]+\))/g, 'nPr($1, $3)')
          .replace(/(\d+(\.\d+)?|\([^)]+\))\s+C\s+(\d+(\.\d+)?|\([^)]+\))/g, 'nCr($1, $3)');

        // Evaluate inside a safe sandbox with math helpers in scope.
        // DEG-mode trig wrappers (__sin_deg, etc.) are injected as extra args.
        const __sin_deg = (x) => Math.sin(x * Math.PI / 180);
        const __cos_deg = (x) => Math.cos(x * Math.PI / 180);
        const __tan_deg = (x) => Math.tan(x * Math.PI / 180);
        const __asin_deg = (x) => Math.asin(x) * 180 / Math.PI;
        const __acos_deg = (x) => Math.acos(x) * 180 / Math.PI;
        const __atan_deg = (x) => Math.atan(x) * 180 / Math.PI;

        const runner = new Function(
          'Math', 'factorial', 'gcd', 'lcm', 'nPr', 'nCr',
          '__sin_deg', '__cos_deg', '__tan_deg', '__asin_deg', '__acos_deg', '__atan_deg',
          `"use strict"; return (${code});`
        );

        const result = runner(
          Math, factorial, gcd, lcm, nPr, nCr,
          __sin_deg, __cos_deg, __tan_deg, __asin_deg, __acos_deg, __atan_deg
        );
        return isFinite(result) ? result : null;
      } catch (err) {
        console.warn('Evaluation parse error:', err, 'for expression:', expr);
        return null;
      }
    }

    // ── Advanced Calculus Helpers ─────────────────────────────────────────

    differentiate(formula, x0) {
      const h = 1e-6;
      const x = Number(x0);
      const evalAt = (val) => {
        const subbed = formula.replace(/\bx\b/gi, `(${val})`);
        return this.evaluateFormula(subbed);
      };

      const fPlus = evalAt(x + h);
      const fMinus = evalAt(x - h);

      if (fPlus === null || fMinus === null) {
        this.showToast('Invalid math formula for differentiation', 'error');
        return;
      }

      const deriv = (fPlus - fMinus) / (2 * h);
      const formattedRes = this.formatResult(deriv);
      const label = `d/dx(${formula}) at x=${x0}`;

      this.expression = label;
      this.lastResult = formattedRes;
      this.isEvaluated = true;
      this.addHistoryEntry(label, formattedRes);
      this.updateDisplay();
      if (window.UI) window.UI.updateResult(formattedRes);
    }

    integrate(formula, a, b) {
      const n = 1000;
      const start = Number(a);
      const end = Number(b);

      if (isNaN(start) || isNaN(end)) {
        this.showToast('Invalid integration limits', 'error');
        return;
      }

      const evalAt = (val) => {
        const subbed = formula.replace(/\bx\b/gi, `(${val})`);
        return this.evaluateFormula(subbed);
      };

      const h = (end - start) / n;
      const f0 = evalAt(start);
      const fn = evalAt(end);
      if (f0 === null || fn === null) {
        this.showToast('Invalid formula for integration', 'error');
        return;
      }

      let sum = f0 + fn;
      for (let i = 1; i < n; i++) {
        const x = start + i * h;
        const fx = evalAt(x);
        if (fx === null) {
          this.showToast('Integration evaluation failed', 'error');
          return;
        }
        sum += (i % 2 === 0 ? 2 : 4) * fx;
      }

      const integral = (h / 3) * sum;
      const formattedRes = this.formatResult(integral);
      const label = `∫(${formula}) dx [${a}, ${b}]`;

      this.expression = label;
      this.lastResult = formattedRes;
      this.isEvaluated = true;
      this.addHistoryEntry(label, formattedRes);
      this.updateDisplay();
      if (window.UI) window.UI.updateResult(formattedRes);
    }

    summation(formula, a, b) {
      const start = Math.round(Number(a));
      const end = Math.round(Number(b));

      if (isNaN(start) || isNaN(end) || end < start) {
        this.showToast('Invalid summation range', 'error');
        return;
      }

      if (end - start > 100000) {
        this.showToast('Summation range too large (max 100,000 steps)', 'error');
        return;
      }

      let total = 0;
      for (let n = start; n <= end; n++) {
        // Support n, x, i, or k as index variable
        const subbed = formula.replace(/\b(n|x|i|k)\b/gi, `(${n})`);
        const val = this.evaluateFormula(subbed);
        if (val === null) {
          this.showToast('Error in summation formula', 'error');
          return;
        }
        total += val;
      }

      const formattedRes = this.formatResult(total);
      const label = `Σ(${formula}) [${start}..${end}]`;

      this.expression = label;
      this.lastResult = formattedRes;
      this.isEvaluated = true;
      this.addHistoryEntry(label, formattedRes);
      this.updateDisplay();
      if (window.UI) window.UI.updateResult(formattedRes);
    }

    limit(formula, a) {
      const target = Number(a);
      const h1 = 1e-5;
      const evalAt = (val) => {
        const subbed = formula.replace(/\bx\b/gi, `(${val})`);
        return this.evaluateFormula(subbed);
      };

      const f1 = evalAt(target + h1);
      const f2 = evalAt(target - h1);

      if (f1 === null && f2 === null) {
        this.showToast('Limit does not exist or invalid formula', 'error');
        return;
      }

      const limVal = f1 !== null && f2 !== null ? (f1 + f2) / 2 : (f1 !== null ? f1 : f2);
      const formattedRes = this.formatResult(limVal);
      const label = `lim x→${a} (${formula})`;

      this.expression = label;
      this.lastResult = formattedRes;
      this.isEvaluated = true;
      this.addHistoryEntry(label, formattedRes);
      this.updateDisplay();
      if (window.UI) window.UI.updateResult(formattedRes);
    }

    matrixDeterminant(matrix) {
      let det;
      if (matrix.length === 2 && matrix[0].length === 2) {
        det = (matrix[0][0] * matrix[1][1]) - (matrix[0][1] * matrix[1][0]);
      } else if (matrix.length === 3 && matrix[0].length === 3) {
        const m = matrix;
        det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
            - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
            + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
      } else {
        this.showToast('Matrix size must be 2x2 or 3x3', 'error');
        return;
      }

      const formattedRes = this.formatResult(det);
      const label = `det(${matrix.length}x${matrix.length})`;

      this.expression = label;
      this.lastResult = formattedRes;
      this.isEvaluated = true;
      this.addHistoryEntry(label, formattedRes);
      this.updateDisplay();
      if (window.UI) window.UI.updateResult(formattedRes);
    }

    // ── Display & Helpers ─────────────────────────────────────────────────

    formatResult(num) {
      if (isNaN(num) || !isFinite(num)) return 'Error';
      const n = Number(num);
      // Clean scientific notation for very large or tiny numbers
      if (Math.abs(n) >= 1e14 || (Math.abs(n) < 1e-7 && n !== 0)) {
        return n.toPrecision(10).replace(/\.?0+e/, 'e');
      }
      const rounded = parseFloat(n.toFixed(10));
      return String(rounded);
    }

    updateDisplay() {
      if (window.UI) {
        if (typeof window.UI.updateExpression === 'function') {
          window.UI.updateExpression(this.expression || '0');
        }
        if (typeof window.UI.updateResult === 'function') {
          // Result preview line stays empty while typing, only shown after equals
          if (this.isEvaluated && this.lastResult !== null) {
            window.UI.updateResult(this.lastResult);
          } else {
            window.UI.updateResult('');
          }
        }
      }
    }

    showToast(message, type = 'info') {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type);
      }
    }
  }

  window.CalculatorCore = CalculatorCore;
})();
