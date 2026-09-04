/**
 * pages/forgot.js
 * Forgot Password Page — Email input + OTP dispatch to reset flow
 *
 * Security hardening:
 * - Strict RFC-5321-aligned email validation with length cap
 * - Email normalised to lowercase before dispatch
 * - Double-submit guard prevents race-condition OTP spam
 * - No account-existence oracle: same UI response whether account found or not
 */
(function () {
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  let isSubmitting = false;

  window.onAppReady(() => {
    const forgotEmail = document.getElementById('forgot-email');
    const btnBack     = document.getElementById('btn-back-from-forgot');
    const btnSubmit   = document.getElementById('btn-submit-forgot');
    const formForgot  = document.getElementById('form-forgot');

    if (btnBack) {
      btnBack.addEventListener('click', () => {
        if (window.Router) {
          window.Router.navigate('/login');
        } else {
          window.UI.switchView(document.getElementById('view-login'));
        }
      });
    }

    if (formForgot) {
      formForgot.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Double-submit guard
        if (isSubmitting) return;

        window.UI.clearAllErrors();

        const email = forgotEmail ? forgotEmail.value.trim().toLowerCase() : '';

        // ── Email validation ─────────────────────────────────────────
        if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
          const el = document.getElementById('error-forgot-email');
          if (el) el.textContent = 'Please enter a valid email address.';
          if (forgotEmail) forgotEmail.classList.add('input-error');
          return;
        }

        isSubmitting = true;
        window.UI.setButtonLoading(btnSubmit, true, 'Send Reset Code');

        try {
          await window.dispatchRealEmailOTP(email, 'forgot');
        } finally {
          isSubmitting = false;
          window.UI.setButtonLoading(btnSubmit, false, 'Send Reset Code');
        }
      });
    }
  });
})();
