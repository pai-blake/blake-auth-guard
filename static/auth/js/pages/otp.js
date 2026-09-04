/**
 * pages/otp.js
 * OTP Page — Real email OTP dispatch, 6-digit input grid, countdown timers, verification
 */
(function () {
  const API_BASE = window.location.protocol.startsWith('http') ? '' : 'http://localhost:3000';
  const RESEND_COOLDOWN_SECONDS = 30;

  let activeSession    = null;
  let resendInterval   = null;
  let expiryInterval   = null;
  let isSendingOtp     = false;
  let isSubmittingOtp  = false;

  // ── Public: dispatch OTP email ────────────────────────────────────────────
  window.dispatchRealEmailOTP = async function (email, purpose, pendingData = {}) {
    if (isSendingOtp) return false;
    isSendingOtp = true;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res  = await fetch(`${API_BASE}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, purpose, pendingData })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        activeSession = { email: normalizedEmail, purpose, pendingData, expiresAt: Date.now() + 5 * 60 * 1000 };
        if (window.showToast) window.showToast(`📬 Email sent! Check your inbox (${normalizedEmail}) for the 6-digit code.`, 'success', 6000);
        setupOtpView(normalizedEmail, purpose);
        isSendingOtp = false;
        return true;
      } else {
        if (window.showToast) window.showToast(`❌ ${data.error || 'Could not deliver email.'}`, 'error', 7000);
        isSendingOtp = false;
        return false;
      }
    } catch (err) {
      if (window.showToast) window.showToast(`❌ Connection Error: Is the server running? (${err.message})`, 'error', 6000);
      isSendingOtp = false;
      return false;
    }
  };

  // ── Public: session accessors ─────────────────────────────────────────────
  window.getActiveSession   = () => activeSession;
  window.clearActiveSession = () => { activeSession = null; };

  // ── Private helpers ───────────────────────────────────────────────────────
  function setupOtpView(email, purpose) {
    const display = document.getElementById('otp-target-display');
    const title   = document.getElementById('otp-title');
    if (display) display.textContent = email;
    if (title) {
      const titles = { signup: 'Verify your email', login: 'Sign-in verification', forgot: 'Password reset OTP' };
      title.textContent = titles[purpose] || 'Verify your email';
    }
    clearOtpInputs();
    window.UI.switchView(document.getElementById('view-otp'));
    const digits = document.querySelectorAll('.otp-digit');
    setTimeout(() => { if (digits[0]) digits[0].focus(); }, 150);
    startResendCountdown();
    startExpiryCountdown();
  }

  function clearOtpInputs() {
    document.querySelectorAll('.otp-digit').forEach(d => {
      d.value = '';
      d.classList.remove('filled', 'error');
    });
    const errEl = document.getElementById('error-otp-code');
    if (errEl) errEl.textContent = '';
  }

  function startResendCountdown() {
    clearInterval(resendInterval);
    let secs = RESEND_COOLDOWN_SECONDS;
    const cooldownText  = document.getElementById('resend-cooldown-text');
    const btnResend     = document.getElementById('btn-resend-otp');
    const countdownEl   = document.getElementById('resend-countdown-seconds');
    if (cooldownText) cooldownText.classList.remove('hidden');
    if (btnResend)    btnResend.classList.add('hidden');
    if (countdownEl)  countdownEl.textContent = secs;
    resendInterval = setInterval(() => {
      secs--;
      if (countdownEl) countdownEl.textContent = secs;
      if (secs <= 0) {
        clearInterval(resendInterval);
        if (cooldownText) cooldownText.classList.add('hidden');
        if (btnResend)    btnResend.classList.remove('hidden');
      }
    }, 1000);
  }

  function startExpiryCountdown() {
    clearInterval(expiryInterval);
    function update() {
      if (!activeSession) return;
      const remaining = activeSession.expiresAt - Date.now();
      const timerText = document.getElementById('otp-timer-text');
      const errEl     = document.getElementById('error-otp-code');
      if (remaining <= 0) {
        clearInterval(expiryInterval);
        if (timerText) { timerText.textContent = '00:00 (Expired)'; timerText.style.color = 'var(--error)'; }
        if (errEl) errEl.textContent = 'This OTP code has expired. Please click "Resend Code".';
        return;
      }
      const s = Math.floor(remaining / 1000);
      if (timerText) {
        timerText.textContent = `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
        timerText.style.color = '';
      }
    }
    update();
    expiryInterval = setInterval(update, 1000);
  }

  function triggerOtpErrorAnimation() {
    document.querySelectorAll('.otp-digit').forEach(d => {
      d.classList.add('error');
      setTimeout(() => d.classList.remove('error'), 500);
    });
  }

  async function handleOtpSubmission() {
    if (isSubmittingOtp) return;
    const errEl     = document.getElementById('error-otp-code');
    if (errEl) errEl.textContent = '';
    const digits    = Array.from(document.querySelectorAll('.otp-digit'));
    const entered   = digits.map(d => d.value.trim()).join('');

    if (entered.length !== 6) {
      if (errEl) errEl.textContent = 'Please enter all 6 digits.';
      triggerOtpErrorAnimation();
      return;
    }

    if (!activeSession) {
      if (errEl) errEl.textContent = 'No active verification session. Please request a new code.';
      return;
    }

    isSubmittingOtp = true;
    const btnSubmit = document.getElementById('btn-submit-otp');
    window.UI.setButtonLoading(btnSubmit, true, 'Verifying...');

    try {
      const res  = await fetch(`${API_BASE}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: activeSession.email, code: entered })
      });
      const data = await res.json();
      window.UI.setButtonLoading(btnSubmit, false, 'Verify & Continue');
      isSubmittingOtp = false;

      if (res.ok && data.success) {
        clearInterval(resendInterval);
        clearInterval(expiryInterval);
        if (window.showToast) window.showToast('🎉 OTP verified successfully!', 'success', 3000);

        const { purpose, email, pendingData } = activeSession;
        const userObj = data.user || { id: 'usr_' + Date.now(), name: (pendingData && pendingData.name) || email.split('@')[0], email, token: data.token };

        if (purpose === 'signup' || purpose === 'login') {
          window.DB.setCurrentUser(userObj);
          activeSession = null;
          window.Router.navigate(window.Router.getSessionRoute());
        } else if (purpose === 'forgot') {
          // Store reset email for the reset-password page
          window.__resetPasswordEmail = email;
          activeSession = null;
          window.Router.navigate('/reset-password');
        }
      } else {
        if (errEl) errEl.textContent = data.error || 'Incorrect OTP code.';
        triggerOtpErrorAnimation();
      }
    } catch (err) {
      window.UI.setButtonLoading(btnSubmit, false, 'Verify & Continue');
      isSubmittingOtp = false;
      if (errEl) errEl.textContent = 'Server connection error: ' + err.message;
      triggerOtpErrorAnimation();
    }
  }

  // ── DOM event wiring ──────────────────────────────────────────────────────
  window.onAppReady(() => {
    const digits = Array.from(document.querySelectorAll('.otp-digit'));

    digits.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (!/^\d*$/.test(e.target.value)) { e.target.value = ''; return; }
        if (e.target.value.length === 1) {
          input.classList.add('filled');
          if (index < digits.length - 1) digits[index + 1].focus();
          else handleOtpSubmission();
        } else {
          input.classList.remove('filled');
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!input.value && index > 0) {
            digits[index - 1].focus();
            digits[index - 1].value = '';
            digits[index - 1].classList.remove('filled');
          } else {
            input.value = '';
            input.classList.remove('filled');
          }
        } else if (e.key === 'ArrowLeft'  && index > 0)               digits[index - 1].focus();
          else if (e.key === 'ArrowRight' && index < digits.length - 1) digits[index + 1].focus();
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(pasted)) {
          digits.forEach((d, i) => { d.value = pasted[i] || ''; d.classList.add('filled'); });
          if (digits[5]) digits[5].focus();
          setTimeout(() => handleOtpSubmission(), 300);
        } else {
          if (window.showToast) window.showToast('Please paste a valid 6-digit numeric OTP code.', 'error');
        }
      });
    });

    const formOtp = document.getElementById('form-otp');
    if (formOtp) formOtp.addEventListener('submit', (e) => { e.preventDefault(); handleOtpSubmission(); });

    const btnResend = document.getElementById('btn-resend-otp');
    if (btnResend) {
      btnResend.addEventListener('click', () => {
        if (activeSession) window.dispatchRealEmailOTP(activeSession.email, activeSession.purpose, activeSession.pendingData);
      });
    }

    function handleBack() {
      clearInterval(resendInterval);
      clearInterval(expiryInterval);
      if (!activeSession) { 
        if (window.Router) window.Router.navigate('/login');
        else window.UI.switchView(document.getElementById('view-login')); 
        return; 
      }
      const dest = { signup: '/signup', forgot: '/forgot' }[activeSession.purpose] || '/login';
      if (window.Router) window.Router.navigate(dest);
      else window.UI.switchView(document.getElementById(dest === '/signup' ? 'view-signup' : dest === '/forgot' ? 'view-forgot' : 'view-login'));
    }

    const btnBackOtp   = document.getElementById('btn-back-from-otp');
    const btnEditEmail = document.getElementById('btn-edit-target-email');
    if (btnBackOtp)   btnBackOtp.addEventListener('click', handleBack);
    if (btnEditEmail) btnEditEmail.addEventListener('click', handleBack);
  });
})();
