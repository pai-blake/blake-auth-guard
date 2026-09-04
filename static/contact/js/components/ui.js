/**
 * static/contact/js/components/ui.js
 * AuthGuard — Contact Module Executive UI Helpers & DOM Renderers
 */
(function (window) {
  'use strict';

  // SVG Icon definitions for consistent, crisp rendering
  const ICONS = {
    folder: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
    briefcase: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    home: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    rocket: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>`,
    target: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
    bookmark: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    globe: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    diamond: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"></path></svg>`,
    star: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  };

  class ContactUI {
    constructor() {
      this.activeViewId = null;
    }

    /** Get SVG string for icon slug */
    getIconSvg(slug) {
      const clean = (slug || 'folder').replace(/[^a-z]/gi, '').toLowerCase();
      return ICONS[clean] || ICONS.folder;
    }

    /** Switch active view panel */
    switchView(targetViewEl) {
      if (!targetViewEl) return;

      const views = document.querySelectorAll('.ct-view');
      views.forEach(v => v.classList.remove('active'));

      targetViewEl.classList.add('active');
      this.activeViewId = targetViewEl.id;

      const navBtns = document.querySelectorAll('.ct-nav-btn');
      navBtns.forEach(btn => {
        const route = btn.getAttribute('data-route') || '';
        const viewSuffix = targetViewEl.id.replace('ct-view-', '');
        const isMatch = (route === '/' + viewSuffix) || (route === '#' + viewSuffix);
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });
    }

    /** Display toast notification */
    notify(message, type = 'info', duration = 3000) {
      if (typeof window.showToast === 'function') {
        window.showToast(message, type, duration);
      } else {
        console.log(`[ContactUI] ${type.toUpperCase()}: ${message}`);
      }
    }

    /** Get avatar markup with initials or image and online pulse dot */
    getAvatarMarkup(user) {
      const name = user.name || user.username || 'User';
      const initial = name.charAt(0).toUpperCase();
      const isOnline = Boolean(user.online);
      const dotClass = isOnline ? 'ct-card-online-dot' : 'ct-card-online-dot offline';
      const title = isOnline ? 'Online' : 'Offline';

      let inner = initial;
      if (user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:') || user.avatar.startsWith('/'))) {
        inner = `<img src="${user.avatar}" alt="${name}" onerror="this.parentElement.textContent='${initial}'">`;
      }

      return `
        <div class="ct-card-avatar-wrap">
          <div class="ct-card-avatar">${inner}</div>
          <span class="${dotClass}" title="${title}"></span>
        </div>
      `;
    }

    /** Render a single contact card HTML */
    createCardHtml(user) {
      const isSaved = Boolean(user.is_saved);
      const isFav = Boolean(user.is_favourite);
      const uname = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '@user';
      const email = user.email ? user.email : '';

      const saveBtnHtml = isSaved 
        ? `${ICONS.check} <span>Saved</span>` 
        : `${ICONS.plus} <span>Save Contact</span>`;
      const saveBtnClass = isSaved ? 'ct-card-btn ct-card-btn--saved' : 'ct-card-btn';
      const favClass = isFav ? 'ct-card-fav-btn active' : 'ct-card-fav-btn';
      const favTitle = isFav ? 'Remove from Favourites' : 'Add to Favourites';

      return `
        <div class="ct-card" data-user-id="${user.id}" data-email="${user.email || ''}">
          ${this.getAvatarMarkup(user)}
          <h4 class="ct-card-name" title="${user.name || ''}">${user.name || user.username || 'User'}</h4>
          <span class="ct-card-username">${uname}</span>
          ${email ? `<span class="ct-card-email" title="${email}">${email}</span>` : '<span class="ct-card-email">&nbsp;</span>'}
          <div class="ct-card-actions">
            <button type="button" class="${saveBtnClass}" data-action="toggle-save" data-id="${user.id}" data-saved="${isSaved}">
              ${saveBtnHtml}
            </button>
            <button type="button" class="${favClass}" data-action="toggle-fav" data-id="${user.id}" data-fav="${isFav}" title="${favTitle}">
              ${ICONS.star}
            </button>
          </div>
        </div>
      `;
    }

    /** Render search results grid */
    renderSearchResults(users, query) {
      const grid = document.getElementById('ct-search-results-grid');
      const emptyPrompt = document.getElementById('ct-search-empty-prompt');
      const spinner = document.getElementById('ct-search-spinner');
      if (spinner) spinner.style.display = 'none';

      if (!query) {
        if (grid) grid.style.display = 'none';
        if (emptyPrompt) {
          emptyPrompt.style.display = 'flex';
          emptyPrompt.querySelector('.ct-empty-title').textContent = 'Discover Connections';
          emptyPrompt.querySelector('.ct-empty-text').textContent = 'Enter a handle with @ or type any portion of a name to search verified accounts in the database.';
        }
        return;
      }

      if (!users || users.length === 0) {
        if (grid) grid.style.display = 'none';
        if (emptyPrompt) {
          emptyPrompt.style.display = 'flex';
          emptyPrompt.querySelector('.ct-empty-title').textContent = 'No Accounts Found';
          emptyPrompt.querySelector('.ct-empty-text').textContent = query.startsWith('@')
            ? `No registered user with exact handle "${query}" was found.`
            : `No registered users matching name "${query}" were found.`;
        }
        return;
      }

      if (emptyPrompt) emptyPrompt.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = users.map(u => this.createCardHtml(u)).join('');
      }
    }

    /** Render all saved contacts grid */
    renderAllContacts(contacts, filterText = '', sortBy = 'recent') {
      const grid = document.getElementById('ct-all-contacts-grid');
      const emptyState = document.getElementById('ct-all-empty-state');
      const badge = document.getElementById('badge-all-count');

      if (badge) badge.textContent = contacts.length;

      let list = [...contacts];

      if (filterText) {
        const ft = filterText.toLowerCase();
        list = list.filter(c => 
          (c.name && c.name.toLowerCase().includes(ft)) ||
          (c.username && c.username.toLowerCase().includes(ft)) ||
          (c.email && c.email.toLowerCase().includes(ft))
        );
      }

      if (sortBy === 'name-asc') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } else if (sortBy === 'name-desc') {
        list.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      } else if (sortBy === 'online') {
        list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
      }

      if (contacts.length === 0) {
        if (grid) grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (grid) {
        grid.style.display = 'grid';
        if (list.length === 0) {
          grid.innerHTML = `<div class="ct-empty-state" style="grid-column: 1 / -1;"><p class="ct-empty-text">No contacts match filter "${filterText}".</p></div>`;
        } else {
          grid.innerHTML = list.map(u => this.createCardHtml(u)).join('');
        }
      }
    }

    /** Render favourite contacts grid */
    renderFavourites(favourites) {
      const grid = document.getElementById('ct-favourites-grid');
      const badge = document.getElementById('badge-fav-count');

      if (badge) badge.textContent = favourites.length;
      if (!grid) return;

      const addCardHtml = `
        <div class="ct-card ct-card--add" id="btn-add-favourite-card" role="button" tabindex="0" title="Add contact to favourites">
          <div class="ct-card-add-icon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
          <span class="ct-card-add-label">Add to Favourite</span>
        </div>
      `;

      const favCards = favourites.map(u => this.createCardHtml(u)).join('');
      grid.innerHTML = favCards + addCardHtml;
    }

    /** Render custom page tabs in left navigation */
    renderCustomNavTabs(pages) {
      const container = document.getElementById('ct-custom-tabs-container');
      if (!container) return;

      container.innerHTML = pages.map(p => {
        const route = `/page-${p.page_id}`;
        const iconSvg = this.getIconSvg(p.page_icon);
        return `
          <button class="ct-nav-btn" data-route="${route}" id="tab-page-${p.page_id}" role="tab" aria-controls="ct-view-page-${p.page_id}">
            <span class="ct-nav-icon">${iconSvg}</span>
            <span class="ct-nav-label">${p.page_name}</span>
          </button>
        `;
      }).join('');
    }

    /** Render dynamic custom view containers in right panel */
    renderCustomPageViews(pages) {
      const container = document.getElementById('ct-dynamic-views-container');
      if (!container) return;

      container.innerHTML = pages.map(p => {
        const viewId = `ct-view-page-${p.page_id}`;
        const iconSvg = this.getIconSvg(p.page_icon);
        return `
          <section class="ct-view" id="${viewId}" role="tabpanel" aria-labelledby="tab-page-${p.page_id}">
            <header class="ct-view-header">
              <div>
                <h2 class="ct-view-heading">${p.page_name}</h2>
                <p class="ct-view-subheading">Custom Category Collection</p>
              </div>
            </header>
            <div class="ct-results-container">
              <div class="ct-empty-state">
                <div class="ct-empty-icon-wrap">${iconSvg}</div>
                <h3 class="ct-empty-title">${p.page_name} Category</h3>
                <p class="ct-empty-text">This is your custom category view. You can organize, rename, or manage it in <a href="#/edit" class="ct-kbd">Manage Pages</a>.</p>
              </div>
            </div>
          </section>
        `;
      }).join('');
    }

    /** Render page manager list in /edit view */
    renderPagesManager(pages) {
      const container = document.getElementById('ct-custom-pages-list-container');
      const count = 3 + pages.length;
      const isMax = count >= 6;

      const counterText = document.getElementById('ct-counter-text');
      const badgeCountText = document.getElementById('ct-badge-count-text');
      const limitNotice = document.getElementById('ct-limit-notice');
      const createBtn = document.getElementById('btn-create-page');
      const nameInput = document.getElementById('ct-new-page-name');

      if (counterText) counterText.textContent = `${count} / 6 Pages`;
      if (badgeCountText) badgeCountText.textContent = `${count} / 6 Pages Used`;

      if (limitNotice) limitNotice.style.display = isMax ? 'flex' : 'none';
      if (createBtn) createBtn.disabled = isMax;
      if (nameInput) nameInput.disabled = isMax;

      if (!container) return;

      if (pages.length === 0) {
        container.innerHTML = `
          <div class="ct-page-item" style="border-style: dashed; justify-content: center; padding: 1.25rem;">
            <span class="ct-empty-text" style="margin: 0; font-size: 0.82rem;">No custom categories created yet. Use the form above to add up to 3 custom pages.</span>
          </div>
        `;
        return;
      }

      container.innerHTML = pages.map(p => {
        const iconSvg = this.getIconSvg(p.page_icon);
        return `
          <div class="ct-page-item" data-page-id="${p.page_id}">
            <div class="ct-page-item-info">
              <div class="ct-page-icon-badge">${iconSvg}</div>
              <input type="text" class="ct-input-rename" value="${p.page_name}" data-page-id="${p.page_id}" maxlength="24">
            </div>
            <div class="ct-page-item-actions">
              <button type="button" class="ct-btn ct-btn--secondary" data-action="rename-page" data-page-id="${p.page_id}">Save</button>
              <button type="button" class="ct-btn ct-btn--danger" data-action="delete-page" data-page-id="${p.page_id}" title="Delete category">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    /** Open Favourite contact picker modal */
    openFavouriteModal(contacts, currentFavourites = []) {
      const modal = document.getElementById('modal-add-favourite');
      const listEl = document.getElementById('modal-fav-contacts-list');
      const favIds = new Set(currentFavourites.map(f => f.id));

      if (listEl) {
        const nonFavs = contacts.filter(c => !favIds.has(c.id));
        if (nonFavs.length === 0) {
          listEl.innerHTML = `
            <div class="ct-empty-state" style="padding: 1.5rem;">
              <p class="ct-empty-text">All your saved contacts are already marked as favourite.</p>
            </div>
          `;
        } else {
          listEl.innerHTML = nonFavs.map(c => `
            <div class="ct-modal-contact-row" data-id="${c.id}">
              <div class="ct-modal-contact-info">
                <div class="ct-modal-avatar">${c.name ? c.name.charAt(0).toUpperCase() : 'U'}</div>
                <div>
                  <div class="ct-modal-name">${c.name || c.username || 'User'}</div>
                  <div class="ct-modal-uname">@${c.username || 'user'}</div>
                </div>
              </div>
              <button type="button" class="ct-btn ct-btn--primary" data-action="modal-add-fav" data-id="${c.id}">
                ${ICONS.plus} Add
              </button>
            </div>
          `).join('');
        }
      }

      if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
      }
    }

    /** Close Favourite modal */
    closeFavouriteModal() {
      const modal = document.getElementById('modal-add-favourite');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    /** Open Contact Detail Popup Modal */
    openContactDetailModal(user) {
      if (!user) return;
      const modal = document.getElementById('modal-contact-detail');
      const body = document.getElementById('modal-detail-body');
      const footer = document.getElementById('modal-detail-footer');
      if (!modal || !body || !footer) return;

      const name = user.name || user.username || 'User';
      const initial = name.charAt(0).toUpperCase();
      const isOnline = Boolean(user.online);
      const dotClass = isOnline ? 'ct-card-online-dot' : 'ct-card-online-dot offline';
      const isSaved = Boolean(user.is_saved);
      const isFav = Boolean(user.is_favourite);
      const uname = user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : '@user';
      const email = user.email || '';

      let avatarInner = initial;
      if (user.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('data:') || user.avatar.startsWith('/'))) {
        avatarInner = `<img src="${user.avatar}" alt="${name}" onerror="this.parentElement.textContent='${initial}'">`;
      }

      body.innerHTML = `
        <div class="ct-detail-profile-hero">
          <div class="ct-detail-avatar-wrap">
            <div class="ct-detail-avatar">${avatarInner}</div>
            <span class="${dotClass}" title="${isOnline ? 'Online' : 'Offline'}"></span>
          </div>
          <h3 class="ct-detail-name" id="modal-detail-name">${name}</h3>
          <div class="ct-detail-uname-pill">${uname}</div>
          <div class="ct-detail-badges">
            <span class="ct-pill ${isOnline ? 'ct-pill--online' : 'ct-pill--offline'}">
              <span class="ct-status-dot ${isOnline ? 'online' : 'offline'}"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </span>
            ${isSaved ? '<span class="ct-pill ct-pill--saved">✓ In Contacts</span>' : '<span class="ct-pill ct-pill--muted">Unsaved</span>'}
            ${isFav ? '<span class="ct-pill ct-pill--fav">⭐ Favourite</span>' : ''}
          </div>
        </div>

        <div class="ct-detail-info-list">
          <div class="ct-detail-info-item">
            <div class="ct-detail-info-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <div class="ct-detail-info-content">
              <span class="ct-detail-info-label">Email Address</span>
              <span class="ct-detail-info-value">${email || 'Private'}</span>
            </div>
            ${email ? `
              <button type="button" class="ct-btn-copy" data-copy="${email}" title="Copy Email">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            ` : ''}
          </div>

          <div class="ct-detail-info-item">
            <div class="ct-detail-info-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="ct-detail-info-content">
              <span class="ct-detail-info-label">Handle / Username</span>
              <span class="ct-detail-info-value">${uname}</span>
            </div>
          </div>
        </div>
      `;

      const saveBtnText = isSaved ? 'Saved' : 'Save Contact';
      const saveBtnClass = isSaved ? 'ct-btn ct-btn--saved-solid' : 'ct-btn ct-btn--primary';
      const favBtnText = isFav ? 'Favourite ⭐' : 'Add Favourite';
      const favBtnClass = isFav ? 'ct-btn ct-btn--fav-active' : 'ct-btn ct-btn--secondary';

      footer.innerHTML = `
        <button type="button" class="${saveBtnClass}" data-action="toggle-save" data-id="${user.id}" data-saved="${isSaved}">
          ${isSaved ? ICONS.check : ICONS.plus}
          <span>${saveBtnText}</span>
        </button>
        <button type="button" class="${favBtnClass}" data-action="toggle-fav" data-id="${user.id}" data-fav="${isFav}">
          ${ICONS.star}
          <span>${favBtnText}</span>
        </button>
        <button type="button" class="ct-btn ct-btn--secondary" id="btn-close-detail-modal-footer">Close</button>
      `;

      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }

    /** Close Contact Detail Popup Modal */
    closeContactDetailModal() {
      const modal = document.getElementById('modal-contact-detail');
      if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    }
  }

  // Export globally
  window.ContactUI = new ContactUI();
})(window);
