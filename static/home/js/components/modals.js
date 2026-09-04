/**
 * static/home/js/components/modals.js
 * AuthGuard — Home Modals (Account Deletion & Unsaved Navigation Guard)
 */
(function (window) {
  'use strict';

  var pendingNavigationUrl = null;

  /* ── Unsaved Changes Navigation Guard ──────────────────────────────────── */
  function initUnsavedChangesGuard() {
    var unsavedModal   = document.getElementById('hd-unsaved-modal');
    var cancelModalBtn = document.getElementById('hd-unsaved-modal-cancel');
    var discardBtn     = document.getElementById('hd-unsaved-modal-discard');
    var saveModalBtn   = document.getElementById('hd-unsaved-modal-save');

    function openUnsavedModal(targetUrl) {
      pendingNavigationUrl = targetUrl;
      if (unsavedModal) {
        unsavedModal.classList.remove('hd-hidden');
        unsavedModal.setAttribute('aria-hidden', 'false');
      }
    }

    function closeUnsavedModal() {
      if (unsavedModal) {
        unsavedModal.classList.add('hd-hidden');
        unsavedModal.setAttribute('aria-hidden', 'true');
      }
      pendingNavigationUrl = null;
    }

    if (cancelModalBtn) {
      cancelModalBtn.addEventListener('click', function () {
        closeUnsavedModal();
      });
    }

    if (discardBtn) {
      discardBtn.addEventListener('click', function () {
        var targetUrl = pendingNavigationUrl;
        closeUnsavedModal();
        if (window.HomeProfile && typeof window.HomeProfile.exitEditMode === 'function') {
          window.HomeProfile.exitEditMode(true);
        }
        if (targetUrl) {
          window.location.href = targetUrl;
        }
      });
    }

    if (saveModalBtn) {
      saveModalBtn.addEventListener('click', function () {
        var targetUrl = pendingNavigationUrl;
        if (window.HomeProfile && typeof window.HomeProfile.saveProfile === 'function') {
          window.HomeProfile.saveProfile(function (success) {
            if (success) {
              closeUnsavedModal();
              if (targetUrl) {
                window.location.href = targetUrl;
              }
            }
          });
        }
      });
    }

    if (unsavedModal) {
      unsavedModal.addEventListener('click', function (e) {
        if (e.target === unsavedModal) {
          closeUnsavedModal();
        }
      });
    }

    // Global Click Interception
    document.addEventListener('click', function (e) {
      if (!window.HomeProfile || !window.HomeProfile.isDirty()) return;

      if (e.target.closest('#hd-unsaved-modal') || e.target.closest('#hd-profile-form') || e.target.closest('#hd-avatar-display') || e.target.closest('#hd-avatar-input')) {
        return;
      }

      var link = e.target.closest('a[href], #btn-header-logout, .btn-logout, #btn-open-calculator, #btn-open-template, #btn-open-contact, .hd-app-card');
      if (link) {
        var href = link.getAttribute('href');
        if (link.id === 'btn-header-logout' || link.classList.contains('btn-logout')) {
          href = href || '/logout';
        }

        if (href && href !== '#' && href.indexOf('javascript:') !== 0) {
          e.preventDefault();
          e.stopPropagation();
          openUnsavedModal(href);
        }
      }
    }, true);

    // Native browser reload/close prompt if dirty
    window.addEventListener('beforeunload', function (e) {
      if (window.HomeProfile && window.HomeProfile.isDirty()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
  }

  /* ── Account Deletion Modal & API ─────────────────────────────────────── */
  function initAccountDeletion() {
    var deleteBtn    = document.getElementById('btn-delete-account');
    var modal        = document.getElementById('hd-delete-modal');
    var cancelBtn    = document.getElementById('hd-delete-modal-cancel');
    var confirmBtn   = document.getElementById('hd-delete-modal-confirm');
    var pwdInput     = document.getElementById('hd-delete-password-input');
    var errorBox     = document.getElementById('hd-delete-modal-error');

    if (!deleteBtn || !modal || !confirmBtn) return;

    function openModal() {
      modal.classList.remove('hd-hidden');
      modal.setAttribute('aria-hidden', 'false');
      if (pwdInput) {
        pwdInput.value = '';
        setTimeout(function () { pwdInput.focus(); }, 100);
      }
      if (errorBox) {
        errorBox.textContent = '';
        errorBox.classList.add('hd-hidden');
      }
    }

    function closeModal() {
      modal.classList.add('hd-hidden');
      modal.setAttribute('aria-hidden', 'true');
      if (pwdInput) pwdInput.value = '';
    }

    deleteBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.classList.contains('hd-hidden')) {
        closeModal();
      }
    });

    confirmBtn.addEventListener('click', function () {
      var password = (pwdInput ? pwdInput.value : '');

      if (!password) {
        if (errorBox) {
          errorBox.textContent = 'Please enter your password to confirm deletion.';
          errorBox.classList.remove('hd-hidden');
        }
        if (pwdInput) pwdInput.focus();
        return;
      }

      var btnText = confirmBtn.querySelector('.hd-btn-text');
      var spinner = confirmBtn.querySelector('.hd-spinner');
      if (spinner) spinner.classList.remove('hd-hidden');
      if (btnText) btnText.textContent = 'Deleting…';
      confirmBtn.disabled = true;
      if (errorBox) errorBox.classList.add('hd-hidden');

      fetch('/home/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ password: password })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            if (window.showToast) {
              window.showToast('Account permanently deleted. Redirecting…', 'info');
            }
            if (window.AuthStorage && typeof window.AuthStorage.clearSession === 'function') {
              window.AuthStorage.clearSession();
            }
            setTimeout(function () {
              window.location.href = '/auth';
            }, 800);
          } else {
            var errMsg = (result.data && result.data.error) || 'Failed to delete account.';
            if (errorBox) {
              errorBox.textContent = errMsg;
              errorBox.classList.remove('hd-hidden');
            }
            if (window.showToast) window.showToast(errMsg, 'error');
            if (spinner) spinner.classList.add('hd-hidden');
            if (btnText) btnText.textContent = 'Permanently Delete';
            confirmBtn.disabled = false;
          }
        })
        .catch(function (err) {
          console.error('[Home] Account deletion error:', err);
          if (errorBox) {
            errorBox.textContent = 'Network error while attempting account deletion.';
            errorBox.classList.remove('hd-hidden');
          }
          if (spinner) spinner.classList.add('hd-hidden');
          if (btnText) btnText.textContent = 'Permanently Delete';
          confirmBtn.disabled = false;
        });
    });
  }

  // Export module
  window.HomeModals = {
    initUnsavedChangesGuard: initUnsavedChangesGuard,
    initAccountDeletion: initAccountDeletion
  };

})(window);
