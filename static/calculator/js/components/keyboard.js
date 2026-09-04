/**
 * static/calculator/js/components/keyboard.js
 * Calculator Keyboard Support
 */
(function () {
  class KeyboardHandler {
    constructor(calculator) {
      this.calculator = calculator;
      this._boundHandler = null;
    }

    getCalc() {
      return this.calculator || window.calculator;
    }

    init() {
      if (this._boundHandler) return;
      this._boundHandler = (e) => this.handleKeyboard(e);
      document.addEventListener('keydown', this._boundHandler);
    }

    destroy() {
      if (this._boundHandler) {
        document.removeEventListener('keydown', this._boundHandler);
        this._boundHandler = null;
      }
    }

    handleKeyboard(e) {
      const calc = this.getCalc();
      if (!calc) return;

      // Do not capture keys if active element is an input inside a modal or outside calculator
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'display-expression') {
        return;
      }

      // If user is already typing inside display-expression, let standard typing happen naturally
      if (document.activeElement && document.activeElement.id === 'display-expression') {
        if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          calc.calculate();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          calc.clear();
        }
        return;
      }

      // Hardware keyboard captured globally when not focused in another input
      // Numbers
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        calc.appendNumber(e.key);
      }
      // Decimal
      else if (e.key === '.') {
        e.preventDefault();
        calc.appendDecimal();
      }
      // Operations
      else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        calc.setOperation(e.key);
      }
      else if (e.key === '*') {
        e.preventDefault();
        calc.setOperation('*');
      }
      else if (e.key === '/') {
        e.preventDefault();
        calc.setOperation('/');
      }
      else if (e.key === '^') {
        e.preventDefault();
        calc.setOperation('^');
      }
      // Parentheses
      else if (e.key === '(' || e.key === ')') {
        e.preventDefault();
        calc.appendParenthesis(e.key);
      }
      // Percent & Factorial
      else if (e.key === '%') {
        e.preventDefault();
        calc.appendFunction('percent');
      }
      else if (e.key === '!') {
        e.preventDefault();
        calc.appendFunction('factorial');
      }
      // Enter or equals
      else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calc.calculate();
      }
      // Backspace for delete
      else if (e.key === 'Backspace') {
        e.preventDefault();
        calc.delete();
      }
      // Escape for clear
      else if (e.key === 'Escape') {
        e.preventDefault();
        calc.clear();
      }
    }
  }

  window.KeyboardHandler = KeyboardHandler;
})();
