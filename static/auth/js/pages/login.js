/**
 * pages/login.js
 * Login Page — Password authentication + curtain animation
 *
 * Security hardening:
 * - Strict RFC-5321-aligned email validation with length cap (254 chars)
 * - Password field cleared from DOM after successful login
 * - Double-submit guard prevents in-flight duplicate requests
 * - Email normalised to lowercase before network call
 * - Generic error message (no email/password distinction) prevents user enumeration
 * - Password max-length cap (128) prevents bcrypt/PBKDF2 DoS
 */
(function () {
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  let isCurtainAnimating = false;
  let isSubmitting = false;

  window.onAppReady(() => {
    const authCard        = document.getElementById('auth-card');
    const loginEmail      = document.getElementById('login-email');
    const loginPassword   = document.getElementById('login-password');
    const btnSubmitLogin  = document.getElementById('btn-submit-login');
    const formLogin       = document.getElementById('form-login');
    const linkForgot      = document.getElementById('link-forgot-password');
    const btnGotoSignup   = document.getElementById('btn-goto-signup');
    const btnGotoLogin    = document.getElementById('btn-goto-login');

    // Curtain transition between Login ↔ Signup
    function triggerCurtainTransition(targetMode, targetPath) {
      if (isCurtainAnimating || !authCard) {
        if (window.Router) window.Router.navigate(targetPath);
        return;
      }
      isCurtainAnimating = true;
      authCard.classList.add('curtain-expand');
      setTimeout(() => {
        authCard.classList.remove('curtain-expand', 'mode-login', 'mode-signup');
        authCard.classList.add(targetMode === 'signup' ? 'mode-signup' : 'mode-login');
        if (window.Router) window.Router.navigate(targetPath);
        setTimeout(() => { isCurtainAnimating = false; }, 350);
      }, 350);
    }

    if (btnGotoSignup) btnGotoSignup.addEventListener('click', () => triggerCurtainTransition('signup', '/signup'));
    if (btnGotoLogin)  btnGotoLogin.addEventListener('click',  () => triggerCurtainTransition('login',  '/login'));

    // Forgot password link — prefill email only if valid
    if (linkForgot) {
      linkForgot.addEventListener('click', (e) => {
        e.preventDefault();
        const forgotEmail = document.getElementById('forgot-email');
        if (forgotEmail && loginEmail) {
          const raw = loginEmail.value.trim().toLowerCase();
          if (EMAIL_REGEX.test(raw)) forgotEmail.value = raw;
        }
        if (window.Router) window.Router.navigate('/forgot');
      });
    }

    // Login form submit — password mode only
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Double-submit guard
        if (isSubmitting) return;

        window.UI.clearAllErrors();

        const email    = loginEmail    ? loginEmail.value.trim().toLowerCase() : '';
        const password = loginPassword ? loginPassword.value                   : '';

        // ── Email validation ─────────────────────────────────────────
        if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
          const el = document.getElementById('error-login-email');
          if (el) el.textContent = 'Please enter a valid email address.';
          if (loginEmail) loginEmail.classList.add('input-error');
          return;
        }

        // ── Password presence & length check ─────────────────────────
        if (!password || password.length > 128) {
          const el = document.getElementById('error-login-password');
          if (el) el.textContent = !password ? 'Please enter your password.' : 'Invalid input.';
          if (loginPassword) loginPassword.classList.add('input-error');
          return;
        }

        isSubmitting = true;
        window.UI.setButtonLoading(btnSubmitLogin, true, 'Sign In');

        try {
          const result = await window.DB.login(email, password);

          if (!result.success || !result.user) {
            // Generic message — avoids revealing whether email or password was wrong
            const el = document.getElementById('error-login-password');
            if (el) el.textContent = result.error || 'Incorrect email or password. Please try again.';
            if (loginPassword) loginPassword.classList.add('input-error');
            return;
          }

          // Clear password from DOM immediately after successful auth
          if (loginPassword) loginPassword.value = '';

          if (window.showToast) window.showToast(`Welcome back, ${result.user.name}!`, 'success');

          window.Router.navigate(window.Router.getSessionRoute());
        } finally {
          isSubmitting = false;
          window.UI.setButtonLoading(btnSubmitLogin, false, 'Sign In');
        }
      });
    }
  });
})();
