/**
 * static/home/js/components/profile.js
 * AuthGuard — Home Profile Controller, Avatar Upload & DB Sync
 */
(function (window) {
  'use strict';

  var ProfileState = {
    isEditMode: false,
    originalName: '',
    originalUsername: '',
    originalAvatarSrc: null,
    pendingAvatarData: null
  };

  /** Resize/compress an image file into a lightweight data URL (max 256x256) */
  function compressImageFile(file, maxWidth, maxHeight, quality, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var width  = img.width;
        var height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width  = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width  = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        var dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl || dataUrl.indexOf('data:image/webp') !== 0) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        callback(null, dataUrl);
      };
      img.onerror = function () { callback(new Error('Failed to load image.')); };
      img.src = e.target.result;
    };
    reader.onerror = function () { callback(new Error('Failed to read file.')); };
    reader.readAsDataURL(file);
  }

  /** Checks if any profile field or avatar is currently edited / unsaved */
  function isProfileDirty() {
    if (!ProfileState.isEditMode) return false;
    var nameInput = document.getElementById('hd-input-name');
    var userInput = document.getElementById('hd-input-username');
    var curName   = (nameInput ? nameInput.value : '').trim();
    var curUser   = (userInput ? userInput.value : '').replace(/^@+/, '').trim();

    if (curName !== ProfileState.originalName) return true;
    if (curUser !== ProfileState.originalUsername) return true;
    if (ProfileState.pendingAvatarData !== null) return true;
    return false;
  }

  /** Enter Edit Mode (swap Email/Role with Name/Username inputs) */
  function enterEditMode() {
    var detailsView = document.getElementById('hd-view-details');
    var editForm    = document.getElementById('hd-profile-form');
    var editBtn     = document.getElementById('btn-edit-profile');
    var nameInput   = document.getElementById('hd-input-name');
    var userInput   = document.getElementById('hd-input-username');

    if (!editForm || !detailsView) return;

    ProfileState.isEditMode = true;
    detailsView.classList.add('hd-hidden');
    editForm.classList.remove('hd-hidden');

    if (editBtn) {
      editBtn.classList.add('hd-hidden');
    }

    if (nameInput) {
      nameInput.value = ProfileState.originalName;
      setTimeout(function () {
        nameInput.focus();
        nameInput.select();
      }, 50);
    }
    if (userInput) {
      userInput.value = ProfileState.originalUsername;
    }
  }

  /** Exit Edit Mode (optionally reverting any pending avatar or text edits) */
  function exitEditMode(revert) {
    var detailsView = document.getElementById('hd-view-details');
    var editForm    = document.getElementById('hd-profile-form');
    var editBtn     = document.getElementById('btn-edit-profile');
    var nameInput   = document.getElementById('hd-input-name');
    var userInput   = document.getElementById('hd-input-username');
    var avatarWrap  = document.getElementById('hd-avatar-display');

    if (revert) {
      if (nameInput) nameInput.value = ProfileState.originalName;
      if (userInput) userInput.value = ProfileState.originalUsername;

      if (ProfileState.pendingAvatarData !== null && avatarWrap) {
        var existingImg = avatarWrap.querySelector('.hd-avatar-img');
        if (ProfileState.originalAvatarSrc) {
          if (existingImg) {
            existingImg.src = ProfileState.originalAvatarSrc;
          } else {
            var newImg = document.createElement('img');
            newImg.src = ProfileState.originalAvatarSrc;
            newImg.alt = 'Avatar';
            newImg.className = 'hd-avatar-img';
            newImg.id = 'hd-avatar-img';
            avatarWrap.insertBefore(newImg, avatarWrap.firstChild);
          }
        } else {
          if (existingImg) existingImg.remove();
          var initialsEl = avatarWrap.querySelector('.hd-avatar-initials');
          if (!initialsEl) {
            var newInitials = document.createElement('span');
            newInitials.className = 'hd-avatar-initials';
            newInitials.id = 'hd-avatar-initials';
            newInitials.textContent = (ProfileState.originalName ? ProfileState.originalName.charAt(0) : 'U').toUpperCase();
            avatarWrap.insertBefore(newInitials, avatarWrap.firstChild);
          }
        }
        ProfileState.pendingAvatarData = null;
      }
    }

    if (editForm) editForm.classList.add('hd-hidden');
    if (detailsView) detailsView.classList.remove('hd-hidden');
    if (editBtn) editBtn.classList.remove('hd-hidden');

    ProfileState.isEditMode = false;
  }

  /** Save profile changes to the server */
  function saveProfile(callback) {
    var nameInput   = document.getElementById('hd-input-name');
    var userInput   = document.getElementById('hd-input-username');
    var saveBtn     = document.getElementById('btn-save-profile');
    var modalSaveBtn= document.getElementById('hd-unsaved-modal-save');
    var displayName = document.getElementById('hd-display-name');
    var displayHdl  = document.getElementById('hd-display-handle');
    var avatarWrap  = document.getElementById('hd-avatar-display');

    var nameVal = (nameInput ? nameInput.value : '').trim();
    var userVal = (userInput ? userInput.value : '').replace(/^@+/, '').trim();

    if (!nameVal) {
      if (window.showToast) window.showToast('Please enter your full name.', 'warning');
      if (nameInput) nameInput.focus();
      if (typeof callback === 'function') callback(false);
      return;
    }

    if (!userVal) {
      if (window.showToast) window.showToast('Please enter a username.', 'warning');
      if (userInput) userInput.focus();
      if (typeof callback === 'function') callback(false);
      return;
    }

    [saveBtn, modalSaveBtn].forEach(function (btn) {
      if (!btn) return;
      var spinner = btn.querySelector('.hd-spinner');
      var text = btn.querySelector('.hd-btn-text');
      if (spinner) spinner.classList.remove('hd-hidden');
      if (text) text.textContent = 'Saving…';
      btn.disabled = true;
    });

    var payload = {
      name: nameVal,
      username: userVal
    };

    if (ProfileState.pendingAvatarData) {
      payload.avatar = ProfileState.pendingAvatarData;
    }

    fetch('/home/api/profile/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data.success) {
          var user = result.data.user || {};
          ProfileState.originalName = nameVal;
          ProfileState.originalUsername = userVal;

          if (ProfileState.pendingAvatarData) {
            ProfileState.originalAvatarSrc = ProfileState.pendingAvatarData;
            ProfileState.pendingAvatarData = null;
          }

          if (displayName && user.name) displayName.textContent = user.name;
          if (displayHdl && user.username) displayHdl.textContent = '@' + user.username;
          if (userInput && user.username) userInput.value = user.username;
          if (nameInput && user.name) nameInput.value = user.name;

          var initialsEl = avatarWrap ? avatarWrap.querySelector('.hd-avatar-initials') : null;
          if (initialsEl && user.name) {
            initialsEl.textContent = user.name.charAt(0).toUpperCase();
          }

          if (window.AuthStorage && typeof window.AuthStorage.setUser === 'function') {
            window.AuthStorage.setUser(user);
          }

          exitEditMode(false);

          if (window.showToast) {
            window.showToast('Profile updated successfully!', 'success');
          }

          if (typeof callback === 'function') callback(true, user);
        } else {
          var errMsg = (result.data && result.data.error) || 'Failed to save profile changes.';
          if (window.showToast) window.showToast(errMsg, 'error');
          if (typeof callback === 'function') callback(false);
        }
      })
      .catch(function (err) {
        console.error('[Home] Profile update failed:', err);
        if (window.showToast) {
          window.showToast('Network error while saving profile.', 'error');
        }
        if (typeof callback === 'function') callback(false);
      })
      .finally(function () {
        [saveBtn, modalSaveBtn].forEach(function (btn) {
          if (!btn) return;
          var spinner = btn.querySelector('.hd-spinner');
          var text = btn.querySelector('.hd-btn-text');
          if (spinner) spinner.classList.add('hd-hidden');
          if (text) {
            text.textContent = (btn === modalSaveBtn) ? 'Save & Continue' : 'Save Changes';
          }
          btn.disabled = false;
        });
      });
  }

  /** Initialize Avatar file picker & upload */
  function initAvatarUpload() {
    var avatarWrap = document.getElementById('hd-avatar-display');
    var fileInput  = document.getElementById('hd-avatar-input');

    if (!avatarWrap || !fileInput) return;

    avatarWrap.addEventListener('click', function () {
      fileInput.click();
    });

    avatarWrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function () {
      if (!this.files || !this.files[0]) return;
      var file = this.files[0];

      if (!file.type.match(/^image\//)) {
        if (window.showToast) window.showToast('Please select a valid image file.', 'warning');
        return;
      }

      if (window.showToast) window.showToast('Processing profile photo…', 'info', 1200);

      compressImageFile(file, 256, 256, 0.85, function (err, dataUrl) {
        if (err || !dataUrl) {
          if (window.showToast) window.showToast('Could not process image.', 'error');
          return;
        }

        var initials = avatarWrap.querySelector('.hd-avatar-initials');
        var existingImg = avatarWrap.querySelector('.hd-avatar-img');
        if (initials) initials.remove();

        if (existingImg) {
          existingImg.src = dataUrl;
        } else {
          var newImg = document.createElement('img');
          newImg.src = dataUrl;
          newImg.alt = 'Avatar';
          newImg.className = 'hd-avatar-img';
          newImg.id = 'hd-avatar-img';
          avatarWrap.insertBefore(newImg, avatarWrap.firstChild);
        }

        ProfileState.pendingAvatarData = dataUrl;
        if (!ProfileState.isEditMode) {
          enterEditMode();
        }
      });
    });
  }

  /** Initialize Profile view switching & form */
  function initProfileSync() {
    var form        = document.getElementById('hd-profile-form');
    var editBtn     = document.getElementById('btn-edit-profile');
    var cancelBtn   = document.getElementById('btn-cancel-profile');
    var nameInput   = document.getElementById('hd-input-name');
    var userInput   = document.getElementById('hd-input-username');
    var avatarImg   = document.getElementById('hd-avatar-img');

    if (nameInput) ProfileState.originalName = nameInput.value.trim();
    if (userInput) ProfileState.originalUsername = userInput.value.trim().replace(/^@+/, '');
    if (avatarImg) ProfileState.originalAvatarSrc = avatarImg.src;

    if (editBtn) {
      editBtn.addEventListener('click', function (e) {
        e.preventDefault();
        enterEditMode();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        exitEditMode(true);
      });
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        saveProfile();
      });
    }
  }

  // Export module
  window.HomeProfile = {
    state: ProfileState,
    isDirty: isProfileDirty,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    saveProfile: saveProfile,
    initAvatarUpload: initAvatarUpload,
    initProfileSync: initProfileSync
  };

})(window);
