/**
 * static/contact/js/pages/main.js
 * AuthGuard — Contact Module Main Page Handlers & Event Wiring
 */
(function (window) {
  'use strict';

  function initMainPage() {
    const Core = window.ContactCore;
    const UI = window.ContactUI;
    const Router = window.ContactRouter;

    if (!Core || !UI || !Router) {
      console.error('[ContactMainPage] Dependencies not ready.');
      return;
    }

    // ── 1. Register Default Routes ──────────────────────────────────────────
    Router
      .register('/search', {
        viewId: 'ct-view-search',
        title: 'Search Contacts',
        onEnter: () => {
          const input = document.getElementById('ct-search-input');
          if (input && !input.value) input.focus();
        }
      })
      .register('/all', {
        viewId: 'ct-view-all',
        title: 'All Contacts',
        onEnter: async () => {
          await Core.loadAllContacts();
          const state = Core.getState();
          UI.renderAllContacts(state.contacts, state.filterQuery, state.sortBy);
        }
      })
      .register('/favourite', {
        viewId: 'ct-view-favourite',
        title: 'Favourite Contacts',
        onEnter: async () => {
          await Core.loadFavourites();
          const state = Core.getState();
          UI.renderFavourites(state.favourites);
        }
      })
      .register('/edit', {
        viewId: 'ct-view-edit',
        title: 'Edit Pages',
        onEnter: async () => {
          await Core.loadPages();
          const state = Core.getState();
          UI.renderPagesManager(state.customPages);
        }
      });

    // Helper to register dynamic custom page routes
    function syncCustomPageRoutes(pages) {
      pages.forEach(p => {
        const route = `/page-${p.page_id}`;
        const viewId = `ct-view-page-${p.page_id}`;
        Router.register(route, {
          viewId: viewId,
          title: p.page_name,
        });
      });
    }

    // ── 2. Reactive Event Listeners from Core ──────────────────────────────
    Core.on('searchComplete', (users) => {
      const state = Core.getState();
      UI.renderSearchResults(users, state.searchQuery);
    });

    Core.on('contactsLoaded', (contacts) => {
      const state = Core.getState();
      UI.renderAllContacts(contacts, state.filterQuery, state.sortBy);
    });

    Core.on('favouritesLoaded', (favourites) => {
      UI.renderFavourites(favourites);
    });

    Core.on('pagesLoaded', (pages) => {
      UI.renderCustomNavTabs(pages);
      UI.renderCustomPageViews(pages);
      UI.renderPagesManager(pages);
      syncCustomPageRoutes(pages);
    });

    // ── 3. Bind UI Interactions ───────────────────────────────────────────

    // Search Input with Debounce
    let searchDebounceTimer = null;
    const searchInput = document.getElementById('ct-search-input');
    const searchClear = document.getElementById('ct-search-clear');
    const searchSpinner = document.getElementById('ct-search-spinner');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchClear) searchClear.style.display = query ? 'block' : 'none';

        clearTimeout(searchDebounceTimer);
        if (!query) {
          UI.renderSearchResults([], '');
          return;
        }

        if (searchSpinner) searchSpinner.style.display = 'flex';
        searchDebounceTimer = setTimeout(() => {
          Core.searchUsers(query);
        }, 300);
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        searchClear.style.display = 'none';
        UI.renderSearchResults([], '');
      });
    }

    // Filter and Sort in All Contacts
    const filterInput = document.getElementById('ct-filter-contacts-input');
    const sortSelect = document.getElementById('ct-sort-select');

    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        const query = e.target.value;
        Core.setState({ filterQuery: query });
        const state = Core.getState();
        UI.renderAllContacts(state.contacts, query, state.sortBy);
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const sortBy = e.target.value;
        Core.setState({ sortBy: sortBy });
        const state = Core.getState();
        UI.renderAllContacts(state.contacts, state.filterQuery, sortBy);
      });
    }

    // Header buttons (e.g. Goto Search)
    const btnGotoSearch = document.getElementById('btn-goto-search');
    const btnEmptyGotoSearch = document.getElementById('btn-empty-goto-search');
    [btnGotoSearch, btnEmptyGotoSearch].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          Router.navigate('/search');
        });
      }
    });

    // Global delegation for Save / Unsave, Favourite & Detail Modal actions
    document.addEventListener('click', async (e) => {
      // 0. Card Click -> Open Detail Popup Modal (ignore if clicking action buttons)
      const cardEl = e.target.closest('.ct-card:not(.ct-card--add)');
      if (cardEl && !e.target.closest('[data-action="toggle-save"], [data-action="toggle-fav"], .ct-btn-copy')) {
        const userId = cardEl.getAttribute('data-user-id');
        if (userId) {
          const user = Core.getUserById(userId);
          if (user) {
            UI.openContactDetailModal(user);
            return;
          }
        }
      }

      // Copy text button
      const copyBtn = e.target.closest('.ct-btn-copy');
      if (copyBtn) {
        const text = copyBtn.getAttribute('data-copy');
        if (text && navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            UI.notify(`Copied "${text}" to clipboard!`, 'success');
          }).catch(() => {
            UI.notify('Copied to clipboard', 'success');
          });
        }
        return;
      }

      // Close Detail Modal
      if (e.target.closest('#btn-close-detail-modal, #btn-close-detail-modal-footer')) {
        UI.closeContactDetailModal();
        return;
      }

      // 1. Toggle Save Contact
      const saveBtn = e.target.closest('[data-action="toggle-save"]');
      if (saveBtn) {
        const contactId = saveBtn.getAttribute('data-id');
        const isSaved = saveBtn.getAttribute('data-saved') === 'true';
        saveBtn.disabled = true;

        if (isSaved) {
          const res = await Core.unsaveContact(contactId);
          if (res.ok) {
            UI.notify('Contact removed from saved list', 'info');
            // Immediately update all save buttons for this contact to "Save Contact"
            document.querySelectorAll(`[data-action="toggle-save"][data-id="${contactId}"]`).forEach(btn => {
              btn.setAttribute('data-saved', 'false');
              if (btn.classList.contains('ct-btn')) {
                btn.className = 'ct-btn ct-btn--primary';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Save Contact</span>
                `;
              } else {
                btn.className = 'ct-card-btn';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>Save Contact</span>
                `;
              }
            });
            // Update favourite buttons if active
            document.querySelectorAll(`[data-action="toggle-fav"][data-id="${contactId}"]`).forEach(btn => {
              btn.setAttribute('data-fav', 'false');
              if (btn.classList.contains('ct-btn')) {
                btn.className = 'ct-btn ct-btn--secondary';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  <span>Add Favourite</span>
                `;
              } else {
                btn.className = 'ct-card-fav-btn';
                btn.title = 'Add to Favourites';
              }
            });
          } else {
            UI.notify(res.error || 'Failed to remove contact', 'error');
          }
        } else {
          const res = await Core.saveContact(contactId);
          if (res.ok) {
            UI.notify('Contact saved successfully!', 'success');
            // Immediately update all save buttons for this contact to "Saved"
            document.querySelectorAll(`[data-action="toggle-save"][data-id="${contactId}"]`).forEach(btn => {
              btn.setAttribute('data-saved', 'true');
              if (btn.classList.contains('ct-btn')) {
                btn.className = 'ct-btn ct-btn--saved-solid';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Saved</span>
                `;
              } else {
                btn.className = 'ct-card-btn ct-card-btn--saved';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Saved</span>
                `;
              }
            });
          } else {
            UI.notify(res.error || 'Failed to save contact', 'error');
          }
        }
        saveBtn.disabled = false;
        return;
      }

      // 2. Toggle Favourite
      const favBtn = e.target.closest('[data-action="toggle-fav"]');
      if (favBtn) {
        const contactId = favBtn.getAttribute('data-id');
        const isFav = favBtn.getAttribute('data-fav') === 'true';
        favBtn.disabled = true;

        const res = await Core.toggleFavourite(contactId, !isFav);
        if (res.ok) {
          UI.notify(res.isFav ? 'Added to favourites ⭐' : 'Removed from favourites', 'success');
          document.querySelectorAll(`[data-action="toggle-fav"][data-id="${contactId}"]`).forEach(btn => {
            btn.setAttribute('data-fav', res.isFav ? 'true' : 'false');
            if (btn.classList.contains('ct-btn')) {
              btn.className = res.isFav ? 'ct-btn ct-btn--fav-active' : 'ct-btn ct-btn--secondary';
              btn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="${res.isFav ? '#f59e0b' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                <span>${res.isFav ? 'Favourite ⭐' : 'Add Favourite'}</span>
              `;
            } else {
              btn.className = res.isFav ? 'ct-card-fav-btn active' : 'ct-card-fav-btn';
              btn.title = res.isFav ? 'Remove from Favourites' : 'Add to Favourites';
            }
          });
          if (res.isFav) {
            // Also update save button to Saved
            document.querySelectorAll(`[data-action="toggle-save"][data-id="${contactId}"]`).forEach(btn => {
              btn.setAttribute('data-saved', 'true');
              if (btn.classList.contains('ct-btn')) {
                btn.className = 'ct-btn ct-btn--saved-solid';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Saved</span>
                `;
              } else {
                btn.className = 'ct-card-btn ct-card-btn--saved';
                btn.innerHTML = `
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>Saved</span>
                `;
              }
            });
          }
        } else {
          UI.notify(res.error || 'Failed to update favourites', 'error');
        }
        favBtn.disabled = false;
        return;
      }

      // 3. Click on "+ Add to Favourite" Card in favourites tab
      const addFavCard = e.target.closest('#btn-add-favourite-card');
      if (addFavCard) {
        await Core.loadAllContacts();
        await Core.loadFavourites();
        const state = Core.getState();
        UI.openFavouriteModal(state.contacts, state.favourites);
        return;
      }

      // 4. Modal Add to Fav action
      const modalAddFavBtn = e.target.closest('[data-action="modal-add-fav"]');
      if (modalAddFavBtn) {
        const contactId = modalAddFavBtn.getAttribute('data-id');
        modalAddFavBtn.disabled = true;
        const res = await Core.toggleFavourite(contactId, true);
        if (res.ok) {
          UI.notify('Added to favourites ⭐', 'success');
          // Update modal list
          const row = modalAddFavBtn.closest('.ct-modal-contact-row');
          if (row) row.remove();
        } else {
          UI.notify(res.error || 'Failed to add favourite', 'error');
          modalAddFavBtn.disabled = false;
        }
        return;
      }

      // 5. Close / Cancel modal
      if (e.target.closest('#btn-close-fav-modal, #btn-cancel-fav-modal')) {
        UI.closeFavouriteModal();
        return;
      }

      // 6. Page Rename in /edit
      const renameBtn = e.target.closest('[data-action="rename-page"]');
      if (renameBtn) {
        const pageId = renameBtn.getAttribute('data-page-id');
        const row = renameBtn.closest('.ct-page-item');
        const input = row ? row.querySelector('.ct-input-rename') : null;
        if (input) {
          const newName = input.value.trim();
          if (!newName) {
            UI.notify('Page name cannot be empty', 'error');
            return;
          }
          renameBtn.disabled = true;
          const res = await Core.renamePage(pageId, newName);
          if (res.ok) {
            UI.notify(`Page renamed to "${newName}"`, 'success');
          } else {
            UI.notify(res.error || 'Failed to rename page', 'error');
          }
          renameBtn.disabled = false;
        }
        return;
      }

      // 7. Page Delete in /edit
      const deleteBtn = e.target.closest('[data-action="delete-page"]');
      if (deleteBtn) {
        const pageId = deleteBtn.getAttribute('data-page-id');
        if (confirm('Are you sure you want to delete this page?')) {
          deleteBtn.disabled = true;
          const res = await Core.deletePage(pageId);
          if (res.ok) {
            UI.notify('Page deleted', 'info');
            Router.unregister(`/page-${pageId}`);
            if (Router.currentRoute === `/page-${pageId}`) {
              Router.navigate('/search');
            }
          } else {
            UI.notify(res.error || 'Failed to delete page', 'error');
            deleteBtn.disabled = false;
          }
        }
        return;
      }
    });

    // Close modals on outside click
    const favModal = document.getElementById('modal-add-favourite');
    if (favModal) {
      favModal.addEventListener('click', (e) => {
        if (e.target === favModal) {
          UI.closeFavouriteModal();
        }
      });
    }

    const detailModal = document.getElementById('modal-contact-detail');
    if (detailModal) {
      detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) {
          UI.closeContactDetailModal();
        }
      });
    }

    // Dismiss modals on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        UI.closeContactDetailModal();
        UI.closeFavouriteModal();
      }
    });

    // Modal contact filter
    const modalFilterInput = document.getElementById('modal-fav-filter-input');
    if (modalFilterInput) {
      modalFilterInput.addEventListener('input', (e) => {
        const ft = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('.ct-modal-contact-row');
        rows.forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(ft) ? 'flex' : 'none';
        });
      });
    }

    // Create Page Form Submit
    const createPageForm = document.getElementById('ct-create-page-form');
    if (createPageForm) {
      createPageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('ct-new-page-name');
        const iconSelect = document.getElementById('ct-new-page-icon');
        const name = (nameInput ? nameInput.value : '').trim();
        const icon = iconSelect ? iconSelect.value : '📁';

        if (!name) {
          UI.notify('Please enter a page name', 'warning');
          return;
        }

        const state = Core.getState();
        if (state.customPages.length >= 3) {
          UI.notify('Maximum 6 total pages reached. Cannot add more.', 'error');
          return;
        }

        const submitBtn = document.getElementById('btn-create-page');
        if (submitBtn) submitBtn.disabled = true;

        const res = await Core.createPage(name, icon);
        if (res.ok) {
          UI.notify(`Page "${name}" created!`, 'success');
          if (nameInput) nameInput.value = '';
          // Navigate to new page
          if (res.page && res.page.page_id) {
            Router.navigate(`/page-${res.page.page_id}`);
          }
        } else {
          UI.notify(res.error || 'Failed to create page', 'error');
        }
        if (submitBtn) submitBtn.disabled = false;
      });
    }

    // Display current logged in user in footer
    const currentUserDisplay = document.getElementById('ct-current-user-display');
    if (currentUserDisplay) {
      const user = window.__SERVER_USER__ || (window.DB && window.DB.getCurrentUser());
      if (user) {
        currentUserDisplay.textContent = user.name || user.username || user.email || 'Connected';
      }
    }

    // Load initial data
    Core.loadAllContacts();
    Core.loadFavourites();
    Core.loadPages();
  }

  // Export globally
  window.ContactMainPage = { init: initMainPage };
})(window);
