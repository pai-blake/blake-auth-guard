/**
 * static/calculator/js/components/ui.js
 * Calculator UI Manager — View switching, dynamic typography, and history rendering.
 */
window.UI = {
  /**
   * Switch active calculator view (Basic vs Scientific)
   * @param {HTMLElement} targetView
   */
  switchView(targetView) {
    // Deactivate all calculator views
    document.querySelectorAll('.calculator-view, .calculator-buttons').forEach(el => {
      el.classList.remove('active');
    });

    if (targetView) {
      targetView.classList.add('active');
    }

    const card = document.getElementById('calculator-card');
    const viewId = targetView ? targetView.id : '';

    // Update active state on toggle buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      const mode = btn.getAttribute('data-mode') || btn.getAttribute('data-route');
      const isBasic      = (mode === 'basic'      || mode === '/basic')      && viewId === 'view-basic';
      const isScientific = (mode === 'scientific' || mode === '/scientific') && viewId === 'view-scientific';
      const isAdvanced   = (mode === 'advanced'   || mode === '/advanced')   && viewId === 'view-advanced';
      btn.classList.toggle('active', Boolean(isBasic || isScientific || isAdvanced));
    });

    // Update card width for scientific and advanced modes
    if (card) {
      card.classList.remove('mode-basic', 'mode-scientific', 'mode-advanced');
      if (viewId === 'view-advanced') {
        card.classList.add('mode-advanced');
      } else if (viewId === 'view-scientific') {
        card.classList.add('mode-scientific');
      } else {
        card.classList.add('mode-basic');
      }
    }
  },

  /**
   * Update the active expression display (middle/main)
   * @param {string} text
   */
  updateExpression(text) {
    const el = document.getElementById('display-expression');
    if (!el) return;

    if (el.tagName === 'INPUT') {
      if (el.value !== (text || '')) {
        el.value = text || '';
      }
    } else {
      el.textContent = text || '0';
    }

    // Auto-shrink font size if text is very long
    const len = (text || '').length;
    if (len > 18) {
      el.style.fontSize = '1.15rem';
    } else if (len > 13) {
      el.style.fontSize = '1.4rem';
    } else if (len > 9) {
      el.style.fontSize = '1.65rem';
    } else {
      el.style.fontSize = '1.85rem';
    }
  },

  /**
   * Update result preview line (e.g. "= 1,972,800,000")
   * @param {string} resultText
   */
  updateResult(resultText) {
    const el = document.getElementById('display-result');
    if (!el) return;

    if (resultText && resultText.trim() !== '') {
      el.textContent = resultText.startsWith('=') ? resultText : `= ${resultText}`;
      el.classList.add('has-result');
    } else {
      el.textContent = '\u00a0'; // non-breaking space
      el.classList.remove('has-result');
    }
  },

  /**
   * Render history items into the top scrollable history container
   * @param {Array<{expression: string, result: string, full: string}>} items
   * @param {Function} onSelect
   */
  renderHistory(items, onSelect) {
    const container = document.getElementById('display-history');
    if (!container) return;

    container.innerHTML = '';

    if (!items || items.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'display-history-empty';
      emptyEl.textContent = 'No past calculations';
      container.appendChild(emptyEl);
      return;
    }

    items.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'display-history-item';
      el.textContent = item.full || `${item.expression} = ${item.result}`;
      el.title = 'Click to use this result';
      el.setAttribute('data-index', String(index));
      el.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(item);
        }
      });
      container.appendChild(el);
    });

    // Auto-scroll history to bottom so most recent is visible
    container.scrollTop = container.scrollHeight;
  }
};
