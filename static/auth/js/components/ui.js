/**
 * static/js/ui.js
 * Shared UI Helpers — Dynamic view switching, error clearing, button loading,
 * password toggle, and password strength meter.
 */
window.UI = {
  clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => (el.textContent = ''));
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  },

  switchView(targetView) {
    // Dynamically deactivate all auth views
    document.querySelectorAll('.auth-view').forEach(el => el.classList.remove('active'));

    if (targetView) targetView.classList.add('active');

    const authCard = document.getElementById('auth-card');
    if (!authCard) return;

    const viewId = targetView ? targetView.id : '';

    if (viewId === 'view-login') {
      authCard.classList.remove('mode-full', 'mode-one', 'mode-signup');
      authCard.classList.add('mode-login');
    } else if (viewId === 'view-signup') {
      authCard.classList.remove('mode-full', 'mode-one', 'mode-login');
      authCard.classList.add('mode-signup');
    } else {
      // Other auth views (Forgot, OTP, Reset) use mode-full
      authCard.classList.remove('mode-login', 'mode-signup', 'mode-one');
      authCard.classList.add('mode-full');
    }

    window.UI.clearAllErrors();
  },

  setButtonLoading(button, isLoading, normalText) {
    if (!button) return;
    const textSpan = button.querySelector('.btn-text');
    const spinner  = button.querySelector('.btn-spinner');
    button.disabled = isLoading;
    if (isLoading) {
      if (textSpan) textSpan.textContent = 'Sending email...';
      if (spinner)  spinner.classList.remove('hidden');
    } else {
      if (textSpan && normalText) textSpan.textContent = normalText;
      if (spinner)  spinner.classList.add('hidden');
    }
  },

  evaluatePasswordStrength(password) {
    const rules = {
      length:  password.length >= 8,
      upper:   /[A-Z]/.test(password),
      number:  /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };

    ['length', 'upper', 'number', 'special'].forEach(key => {
      const el = document.getElementById(`rule-${key}`);
      if (el) el.classList.toggle('passed', rules[key]);
    });

    const fill = document.getElementById('strength-fill');
    const text = document.getElementById('strength-text');
    if (fill) fill.className = 'strength-fill';

    if (!password) {
      if (text) text.textContent = 'Empty';
      if (fill) fill.style.width = '0%';
      return 0;
    }

    const count = Object.values(rules).filter(Boolean).length;
    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Very Strong'];
    if (fill) fill.classList.add(levels[count] || 'weak');
    if (text) text.textContent = labels[count] || 'Weak';
    return count;
  }
};

// Password visibility toggle — shared across login, signup, and reset pages
window.onAppReady(() => {
  document.querySelectorAll('.btn-toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId  = btn.getAttribute('data-target');
      const input     = document.getElementById(targetId);
      if (!input) return;
      const eyeOn     = btn.querySelector('.icon-eye');
      const eyeOff    = btn.querySelector('.icon-eye-off');
      const isHidden  = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      if (eyeOn)  eyeOn.classList.toggle('hidden', isHidden);
      if (eyeOff) eyeOff.classList.toggle('hidden', !isHidden);
    });
  });
});
