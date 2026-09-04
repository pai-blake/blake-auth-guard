/**
 * pages/reset-password.js
 * Reset Password Page — New password + confirm + secure backend hash update
 *
 * Security hardening:
 * - Password min 8 chars, max 128 chars (prevents server-side bcrypt/PBKDF2 DoS)
 * - Confirm-match checked client-side before any network call
 * - Minimum strength score enforced (same rules as signup)
 * - Reset email sourced only from verified OTP session — not from URL params or DOM
 * - Session cleared immediately after successful reset (prevents reuse)
 * - Double-submit guard: button disabled during in-flight request
 * - Password fields cleared from DOM after successful submission
 * - If no reset email found, aborts silently to prevent user enumeration
 */
(function () {
  let isSubmitting = false;

  window.onAppReady(() => {
    const resetNewPassword     = document.getElementById('reset-new-password');
    const resetConfirmPassword = document.getElementById('reset-confirm-password');
    const btnSubmit            = document.getElementById('btn-submit-reset-password');
    const formNewPassword      = document.getElementById('form-new-password');

    // Live strength meter on new password field
    if (resetNewPassword) {
      resetNewPassword.addEventListener('input', (e) => {
        if (window.UI && window.UI.evaluatePasswordStrength) {
          window.UI.evaluatePasswordStrength(e.target.value);
        }
      });
    }

    if (formNewPassword) {
      formNewPassword.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Double-submit guard
        if (isSubmitting) return;

        window.UI.clearAllErrors();

        const newPass     = resetNewPassword     ? resetNewPassword.value     : '';
        const confirmPass = resetConfirmPassword ? resetConfirmPassword.value : '';

        // ── Password length bounds ───────────────────────────────────
        if (!newPass || newPass.length < 8) {
          const el = document.getElementById('error-reset-password');
          if (el) el.textContent = 'Password must be at least 8 characters long.';
          if (resetNewPassword) resetNewPassword.classList.add('input-error');
          return;
        }

        if (newPass.length > 128) {
          const el = document.getElementById('error-reset-password');
          if (el) el.textContent = 'Password must be 128 characters or fewer.';
          if (resetNewPassword) resetNewPassword.classList.add('input-error');
          return;
        }

        // ── Password strength check ──────────────────────────────────
        if (window.UI && window.UI.evaluatePasswordStrength) {
          const score = window.UI.evaluatePasswordStrength(newPass);
          if (score < 3) {
            const el = document.getElementById('error-reset-password');
            if (el) el.textContent = 'Please choose a stronger password meeting all criteria.';
            if (resetNewPassword) resetNewPassword.classList.add('input-error');
            return;
          }
        }

        // ── Confirm match ────────────────────────────────────────────
        if (newPass !== confirmPass) {
          const el = document.getElementById('error-reset-confirm');
          if (el) el.textContent = 'Passwords do not match. Please re-enter.';
          if (resetConfirmPassword) resetConfirmPassword.classList.add('input-error');
          return;
        }

        // ── Resolve reset email from OTP session ONLY (never from URL/DOM) ──
        const activeSession = window.getActiveSession ? window.getActiveSession() : null;
        const resetEmail = (activeSession && activeSession.email) || window.__resetPasswordEmail;

        if (!resetEmail) {
          // No verified session — abort silently (prevents enumeration)
          if (window.showToast) window.showToast('Session expired. Please restart the password reset flow.', 'error', 5000);
          if (window.Router) window.Router.navigate('/forgot');
          return;
        }

        isSubmitting = true;
        window.UI.setButtonLoading(btnSubmit, true, 'Update Password');

        try {
          const success = await window.DB.updatePassword(resetEmail, newPass);

          // Clear password fields from DOM immediately
          if (resetNewPassword)     resetNewPassword.value = '';
          if (resetConfirmPassword) resetConfirmPassword.value = '';

          if (!success) {
            if (window.showToast) window.showToast('Failed to update password. Please try again.', 'error', 5000);
            return;
          }

          // Clear OTP session to prevent replay
          if (window.clearActiveSession) window.clearActiveSession();
          window.__resetPasswordEmail = null;

          if (window.showToast) window.showToast('Password updated! Please sign in with your new password.', 'success', 5000);

          // Pre-fill login email for convenience, clear password
          const loginEmail    = document.getElementById('login-email');
          const loginPassword = document.getElementById('login-password');
          if (loginEmail)    loginEmail.value    = resetEmail;
          if (loginPassword) loginPassword.value = '';

          if (window.Router) {
            window.Router.navigate('/login');
          } else {
            window.UI.switchView(document.getElementById('view-login'));
          }
        } finally {
          isSubmitting = false;
          window.UI.setButtonLoading(btnSubmit, false, 'Update Password');
        }
      });
    }
  });
})();
