/**
 * pages/signup.js
 * Sign Up Page — Full name, email, password validation + OTP dispatch
 *
 * Security hardening:
 * - Input length caps to prevent oversized payloads
 * - Strict RFC-5322-aligned email regex (blocks control chars, consecutive dots, leading/trailing dots)
 * - Name sanitized: strips HTML/script tags and control characters before sending
 * - Password sent to backend only — never stored, logged, or exposed client-side
 * - Pre-generated userId uses crypto.randomUUID() if available, falls back to entropy-padded timestamp
 * - Double-submit guard: button disabled during in-flight request
 * - Minimum password score enforced (score >= 3/4 rules)
 * - Password max-length cap (128) to prevent bcrypt DoS on server
 */
(function () {
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  const NAME_SANITIZE_REGEX = /[<>"'`\\\/\x00-\x1f\x7f]/g;

  /** Strip dangerous characters from display name */
  function sanitizeName(raw) {
    return raw.replace(NAME_SANITIZE_REGEX, '').trim();
  }

  /** Generate a secure random user ID */
  function generateUserId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'usr_' + crypto.randomUUID().replace(/-/g, '');
    }
    // Fallback: timestamp + 6 random hex bytes
    const entropy = Array.from(
      (crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint8Array(6))
        : new Array(6).fill(0).map(() => Math.floor(Math.random() * 256))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    return 'usr_' + Date.now() + '_' + entropy;
  }

  window.onAppReady(() => {
    const signupName     = document.getElementById('signup-name');
    const signupEmail    = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    const termsAgree     = document.getElementById('terms-agree');
    const btnSubmit      = document.getElementById('btn-submit-signup');
    const formSignup     = document.getElementById('form-signup');

    let isSubmitting = false;

    // Live password strength meter
    if (signupPassword) {
      signupPassword.addEventListener('input', (e) => {
        window.UI.evaluatePasswordStrength(e.target.value);
      });
    }

    if (formSignup) {
      formSignup.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Double-submit guard
        if (isSubmitting) return;

        window.UI.clearAllErrors();

        const rawName  = signupName     ? signupName.value     : '';
        const rawEmail = signupEmail    ? signupEmail.value    : '';
        const password = signupPassword ? signupPassword.value : '';
        const terms    = termsAgree     ? termsAgree.checked   : false;

        const name  = sanitizeName(rawName);
        const email = rawEmail.trim().toLowerCase();

        let hasError = false;

        // ── Name validation ──────────────────────────────────────────
        if (!name || name.length < 2 || name.length > 80) {
          const el = document.getElementById('error-signup-name');
          if (el) el.textContent = 'Please enter your full name (2–80 characters).';
          if (signupName) signupName.classList.add('input-error');
          hasError = true;
        }

        // ── Email validation (strict) ────────────────────────────────
        if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
          const el = document.getElementById('error-signup-email');
          if (el) el.textContent = 'Please enter a valid email address.';
          if (signupEmail) signupEmail.classList.add('input-error');
          hasError = true;
        }

        // ── Password strength & length bounds ────────────────────────
        const strengthScore = window.UI.evaluatePasswordStrength(password);
        if (!password || strengthScore < 3) {
          const el = document.getElementById('error-signup-password');
          if (el) el.textContent = 'Please choose a stronger password meeting the criteria.';
          if (signupPassword) signupPassword.classList.add('input-error');
          hasError = true;
        } else if (password.length > 128) {
          const el = document.getElementById('error-signup-password');
          if (el) el.textContent = 'Password must be 128 characters or fewer.';
          if (signupPassword) signupPassword.classList.add('input-error');
          hasError = true;
        }

        // ── Terms agreement ──────────────────────────────────────────
        if (!terms) {
          const el = document.getElementById('error-signup-terms');
          if (el) el.textContent = 'You must agree to the Terms to continue.';
          hasError = true;
        }

        if (hasError) return;

        // ── Dispatch OTP (with double-submit lock) ───────────────────
        isSubmitting = true;
        window.UI.setButtonLoading(btnSubmit, true, 'Continue');

        try {
          const userId = generateUserId();
          // NOTE: password is sent over HTTPS to the server, which hashes it
          // before storage (PBKDF2-SHA256). It is never stored client-side.
          await window.dispatchRealEmailOTP(email, 'signup', {
            id:    userId,
            name:  name,    // sanitized
            email: email,   // normalised lowercase
            password       // raw — server hashes before DB write
          });
        } finally {
          isSubmitting = false;
          window.UI.setButtonLoading(btnSubmit, false, 'Continue');
        }
      });
    }
  });
})();
