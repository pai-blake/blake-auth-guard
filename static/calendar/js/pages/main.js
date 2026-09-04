/**
 * static/calendar/js/pages/main.js
 * AuthGuard — Calendar Module Event Listeners, Modals & Delegation
 */
(function (window) {
  'use strict';

  class CalendarMainPage {
    constructor() {
      this.selectedAttendees = [];
      this.attendeeSearchDebounce = null;
    }

    init() {
      this.bindToolbarEvents();
      this.bindSidebarEvents();
      this.bindGridDelegation();
      this.bindModalEvents();
      this.bindKeyboardShortcuts();
    }

    // =========================================================================
    // Toolbar Buttons
    // =========================================================================

    bindToolbarEvents() {
      const btnToday = document.getElementById('cal-btn-today');
      if (btnToday) {
        btnToday.addEventListener('click', () => window.CalendarCore.today());
      }

      const btnPrev = document.getElementById('cal-btn-prev');
      if (btnPrev) {
        btnPrev.addEventListener('click', () => window.CalendarCore.prevPeriod());
      }

      const btnNext = document.getElementById('cal-btn-next');
      if (btnNext) {
        btnNext.addEventListener('click', () => window.CalendarCore.nextPeriod());
      }

      // View selector buttons
      document.querySelectorAll('.calendar-view-selector .view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.dataset.view;
          if (view) window.CalendarCore.setCurrentView(view);
        });
      });

      // Create Event button
      const btnOpenCreate = document.getElementById('btn-open-create-event');
      if (btnOpenCreate) {
        btnOpenCreate.addEventListener('click', () => this.openCreateModal());
      }
    }

    // =========================================================================
    // Sidebar Controls & Mini-Calendar
    // =========================================================================

    bindSidebarEvents() {
      // Mini calendar prev/next
      const miniPrev = document.getElementById('mini-cal-prev');
      const miniNext = document.getElementById('mini-cal-next');

      if (miniPrev) {
        miniPrev.addEventListener('click', () => {
          const d = new Date(window.CalendarCore.getState().currentDate);
          d.setMonth(d.getMonth() - 1);
          window.CalendarCore.setCurrentDate(d);
        });
      }

      if (miniNext) {
        miniNext.addEventListener('click', () => {
          const d = new Date(window.CalendarCore.getState().currentDate);
          d.setMonth(d.getMonth() + 1);
          window.CalendarCore.setCurrentDate(d);
        });
      }

      // Category filter clicks
      const categoryList = document.getElementById('category-filter-list');
      if (categoryList) {
        categoryList.addEventListener('click', (e) => {
          const item = e.target.closest('.category-item');
          if (!item) return;

          const category = item.dataset.category || 'all';
          document.querySelectorAll('.category-item').forEach(it => it.classList.remove('active'));
          item.classList.add('active');

          const label = document.getElementById('active-category-label');
          if (label) label.textContent = item.querySelector('.cat-name').textContent.split(' ')[0];

          window.CalendarCore.setActiveCategory(category);
        });
      }

      // Agenda search input
      const searchInput = document.getElementById('agenda-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          window.CalendarCore.setSearchQuery(e.target.value);
        });
      }
    }

    // =========================================================================
    // Main Grid Click Delegation
    // =========================================================================

    bindGridDelegation() {
      document.addEventListener('click', (e) => {
        // 1. Click on an event pill or card
        const eventEl = e.target.closest('[data-action="view-event"]');
        if (eventEl) {
          e.stopPropagation();
          const evtId = eventEl.dataset.eventId;
          if (evtId) this.openDetailModal(evtId);
          return;
        }

        // 2. Click Quick Add button on month day
        const quickAdd = e.target.closest('[data-action="quick-add"]');
        if (quickAdd) {
          e.stopPropagation();
          const dateStr = quickAdd.dataset.date;
          this.openCreateModal({ date: dateStr });
          return;
        }

        // 3. Click Day Column Header to switch to Day View
        const jumpDay = e.target.closest('[data-action="jump-to-day"]');
        if (jumpDay) {
          const dateStr = jumpDay.dataset.date;
          if (dateStr) {
            window.CalendarCore.setCurrentDate(new Date(dateStr + 'T00:00:00'));
            window.CalendarCore.setCurrentView('day');
          }
          return;
        }

        // 4. Click on hour slot in Week or Day view
        const hourLine = e.target.closest('[data-action="quick-add-hour"]');
        if (hourLine) {
          const dateStr = hourLine.dataset.date;
          const hour = parseInt(hourLine.dataset.hour, 10);
          this.openCreateModal({ date: dateStr, hour });
          return;
        }

        // 5. Mini calendar day click
        const miniDay = e.target.closest('[data-action="mini-cal-select"]');
        if (miniDay) {
          const dateStr = miniDay.dataset.date;
          if (dateStr) {
            window.CalendarCore.setCurrentDate(new Date(dateStr + 'T00:00:00'));
          }
          return;
        }

        // 6. Overflow badge in Month view
        const overflow = e.target.closest('[data-action="view-day-events"]');
        if (overflow) {
          const dateStr = overflow.dataset.date;
          if (dateStr) {
            window.CalendarCore.setCurrentDate(new Date(dateStr + 'T00:00:00'));
            window.CalendarCore.setCurrentView('day');
          }
          return;
        }

        // 7. Click on month day cell background
        const dayCell = e.target.closest('.month-day-cell');
        if (dayCell && !e.target.closest('.event-pill') && !e.target.closest('.event-overflow-badge')) {
          const dateStr = dayCell.dataset.date;
          if (dateStr) {
            this.openCreateModal({ date: dateStr });
          }
        }
      });
    }

    // =========================================================================
    // Modals: Create / Edit Event & Detail Dialog
    // =========================================================================

    bindModalEvents() {
      // Create/Edit Modal controls
      const modalEvent = document.getElementById('cal-modal-event');
      const btnCloseEvent = document.getElementById('cal-modal-close');
      const btnCancelEvent = document.getElementById('cal-modal-cancel');
      const formEvent = document.getElementById('cal-event-form');

      if (btnCloseEvent) btnCloseEvent.addEventListener('click', () => this.closeCreateModal());
      if (btnCancelEvent) btnCancelEvent.addEventListener('click', () => this.closeCreateModal());

      if (modalEvent) {
        modalEvent.addEventListener('click', (e) => {
          if (e.target === modalEvent) this.closeCreateModal();
        });
      }

      // Color Swatches
      const palette = document.getElementById('color-picker-palette');
      const colorInput = document.getElementById('event-form-color');
      if (palette) {
        palette.addEventListener('click', (e) => {
          const swatch = e.target.closest('.color-swatch');
          if (!swatch) return;
          palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          if (colorInput) colorInput.value = swatch.dataset.color || '#6C63FF';
        });
      }

      // Attendees Search
      const attendeesInput = document.getElementById('event-form-attendees-search');
      const attendeesDropdown = document.getElementById('attendees-dropdown-results');

      if (attendeesInput) {
        attendeesInput.addEventListener('input', (e) => {
          const val = e.target.value.trim();
          clearTimeout(this.attendeeSearchDebounce);
          if (!val) {
            if (attendeesDropdown) attendeesDropdown.style.display = 'none';
            return;
          }
          this.attendeeSearchDebounce = setTimeout(async () => {
            const users = await window.CalendarCore.searchAttendees(val);
            this.renderAttendeeSearchResults(users);
          }, 250);
        });
      }

      // Form Submit
      if (formEvent) {
        formEvent.addEventListener('submit', (e) => this.handleEventFormSubmit(e));
      }

      // Detail Modal controls
      const modalDetail = document.getElementById('cal-modal-detail');
      const btnCloseDetail = document.getElementById('cal-detail-close');
      const btnFooterClose = document.getElementById('cal-detail-btn-close');
      const btnEdit = document.getElementById('cal-detail-btn-edit');
      const btnDelete = document.getElementById('cal-detail-btn-delete');

      if (btnCloseDetail) btnCloseDetail.addEventListener('click', () => this.closeDetailModal());
      if (btnFooterClose) btnFooterClose.addEventListener('click', () => this.closeDetailModal());

      if (modalDetail) {
        modalDetail.addEventListener('click', (e) => {
          if (e.target === modalDetail) this.closeDetailModal();
        });
      }

      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          const evt = window.CalendarCore.state.selectedEvent;
          if (evt) {
            this.closeDetailModal();
            this.openEditModal(evt);
          }
        });
      }

      if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
          const evt = window.CalendarCore.state.selectedEvent;
          if (evt && confirm(`Are you sure you want to delete "${evt.title}"?`)) {
            await window.CalendarCore.deleteEvent(evt.id);
            this.closeDetailModal();
          }
        });
      }
    }

    openCreateModal(preset = {}) {
      const modal = document.getElementById('cal-modal-event');
      const titleEl = document.getElementById('cal-modal-title');
      const form = document.getElementById('cal-event-form');
      if (!modal || !form) return;

      form.reset();
      document.getElementById('event-form-id').value = '';
      if (titleEl) titleEl.textContent = 'Create New Event';

      // Default start and end dates
      let startDt, endDt;
      if (preset.date) {
        const h = preset.hour !== undefined ? preset.hour : 9;
        startDt = `${preset.date}T${String(h).padStart(2, '0')}:00`;
        endDt = `${preset.date}T${String(h + 1).padStart(2, '0')}:00`;
      } else {
        const now = new Date();
        const nextHour = new Date(now.getTime() + 3600000);
        startDt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(nextHour.getHours()).padStart(2, '0')}:00`;
        endDt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(nextHour.getHours() + 1).padStart(2, '0')}:00`;
      }

      const startInput = document.getElementById('event-form-start');
      const endInput = document.getElementById('event-form-end');
      if (startInput) startInput.value = startDt;
      if (endInput) endInput.value = endDt;

      // Reset color swatches
      const colorInput = document.getElementById('event-form-color');
      if (colorInput) colorInput.value = '#6C63FF';
      document.querySelectorAll('#color-picker-palette .color-swatch').forEach(s => {
        if (s.dataset.color === '#6C63FF') s.classList.add('active');
        else s.classList.remove('active');
      });

      // Reset attendees
      this.selectedAttendees = [];
      this.renderSelectedAttendeesTags();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');

      setTimeout(() => {
        const inputTitle = document.getElementById('event-form-title');
        if (inputTitle) inputTitle.focus();
      }, 100);
    }

    openEditModal(evt) {
      const modal = document.getElementById('cal-modal-event');
      const titleEl = document.getElementById('cal-modal-title');
      const form = document.getElementById('cal-event-form');
      if (!modal || !form || !evt) return;

      form.reset();
      if (titleEl) titleEl.textContent = 'Edit Event';
      document.getElementById('event-form-id').value = evt.id;
      document.getElementById('event-form-title').value = evt.title || '';
      document.getElementById('event-form-start').value = (evt.start_dt || '').slice(0, 16);
      document.getElementById('event-form-end').value = (evt.end_dt || '').slice(0, 16);
      document.getElementById('event-form-all-day').checked = Boolean(evt.all_day);
      document.getElementById('event-form-category').value = evt.category || 'general';
      document.getElementById('event-form-location').value = evt.location || '';
      document.getElementById('event-form-desc').value = evt.description || '';
      document.getElementById('event-form-reminder').value = evt.reminder_min || '';

      const evtColor = evt.color || '#6C63FF';
      document.getElementById('event-form-color').value = evtColor;
      document.querySelectorAll('#color-picker-palette .color-swatch').forEach(s => {
        if (s.dataset.color === evtColor) s.classList.add('active');
        else s.classList.remove('active');
      });

      // Attendees
      this.selectedAttendees = evt.attendees ? evt.attendees.split(',').map(s => s.trim()).filter(Boolean) : [];
      this.renderSelectedAttendeesTags();

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }

    closeCreateModal() {
      const modal = document.getElementById('cal-modal-event');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      const dropdown = document.getElementById('attendees-dropdown-results');
      if (dropdown) dropdown.style.display = 'none';
    }

    openDetailModal(eventId) {
      const evt = window.CalendarCore.getEventById(eventId);
      if (!evt) return;

      window.CalendarCore.setState({ selectedEvent: evt });

      const modal = document.getElementById('cal-modal-detail');
      if (!modal) return;

      const strip = document.getElementById('detail-header-strip');
      if (strip) strip.style.background = evt.color || '#6C63FF';

      const catBadge = document.getElementById('detail-category-badge');
      if (catBadge) {
        catBadge.textContent = evt.category || 'General';
        catBadge.style.background = evt.color || '#6C63FF';
      }

      const titleEl = document.getElementById('detail-title');
      if (titleEl) titleEl.textContent = evt.title || '';

      const datetimeEl = document.getElementById('detail-datetime');
      const durationEl = document.getElementById('detail-duration');
      if (datetimeEl) {
        const startD = new Date(evt.start_dt);
        const endD = evt.end_dt ? new Date(evt.end_dt) : startD;
        const timeText = evt.all_day ? 'All day' : `${window.CalendarUI.formatTime(evt.start_dt)} – ${window.CalendarUI.formatTime(evt.end_dt)}`;
        datetimeEl.textContent = `${window.CalendarUI.formatDateFull(evt.start_dt)} • ${timeText}`;

        if (durationEl) {
          if (evt.all_day) {
            durationEl.textContent = 'All-day event';
          } else {
            const mins = Math.round((endD.getTime() - startD.getTime()) / 60000);
            if (mins >= 60) {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              durationEl.textContent = m > 0 ? `${h} hr ${m} min` : `${h} hr`;
            } else {
              durationEl.textContent = `${mins} min`;
            }
          }
        }
      }

      // Location
      const locRow = document.getElementById('detail-location-row');
      const locText = document.getElementById('detail-location');
      if (locRow && locText) {
        if (evt.location) {
          locRow.style.display = 'flex';
          locText.textContent = evt.location;
        } else {
          locRow.style.display = 'none';
        }
      }

      // Reminder
      const remRow = document.getElementById('detail-reminder-row');
      const remText = document.getElementById('detail-reminder');
      if (remRow && remText) {
        if (evt.reminder_min) {
          remRow.style.display = 'flex';
          remText.textContent = `${evt.reminder_min} minutes before`;
        } else {
          remRow.style.display = 'none';
        }
      }

      // Attendees
      const attRow = document.getElementById('detail-attendees-row');
      const attChips = document.getElementById('detail-attendees-chips');
      if (attRow && attChips) {
        if (evt.attendees) {
          attRow.style.display = 'flex';
          attChips.innerHTML = evt.attendees.split(',').map(a => {
            const clean = window.CalendarUI.escapeHtml(a.trim());
            return `<span class="attendee-tag">${clean}</span>`;
          }).join('');
        } else {
          attRow.style.display = 'none';
        }
      }

      // Description
      const descBox = document.getElementById('detail-desc-box');
      const descText = document.getElementById('detail-description');
      if (descBox && descText) {
        if (evt.description) {
          descBox.style.display = 'block';
          descText.textContent = evt.description;
        } else {
          descBox.style.display = 'none';
        }
      }

      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
    }

    closeDetailModal() {
      const modal = document.getElementById('cal-modal-detail');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    }

    async handleEventFormSubmit(e) {
      e.preventDefault();

      const eventId = document.getElementById('event-form-id').value;
      const title = document.getElementById('event-form-title').value.trim();
      const startDt = document.getElementById('event-form-start').value;
      const endDt = document.getElementById('event-form-end').value;
      const allDay = document.getElementById('event-form-all-day').checked ? 1 : 0;
      const category = document.getElementById('event-form-category').value;
      const color = document.getElementById('event-form-color').value || '#6C63FF';
      const location = document.getElementById('event-form-location').value.trim();
      const reminderMin = document.getElementById('event-form-reminder').value || null;
      const description = document.getElementById('event-form-desc').value.trim();
      const attendees = this.selectedAttendees.join(', ');

      if (!title) {
        alert('Please enter an event title');
        return;
      }
      if (!startDt || !endDt) {
        alert('Please specify both start and end time');
        return;
      }

      const payload = {
        title,
        start_dt: startDt,
        end_dt: endDt,
        all_day: allDay,
        category,
        color,
        location,
        reminder_min: reminderMin,
        description,
        attendees
      };

      const saveBtn = document.getElementById('cal-modal-save');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
      }

      let res;
      if (eventId) {
        res = await window.CalendarCore.updateEvent(eventId, payload);
      } else {
        res = await window.CalendarCore.createEvent(payload);
      }

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Event';
      }

      if (res && res.ok) {
        this.closeCreateModal();
      }
    }

    renderAttendeeSearchResults(users) {
      const dropdown = document.getElementById('attendees-dropdown-results');
      if (!dropdown) return;

      if (!users || users.length === 0) {
        dropdown.innerHTML = '<div style="padding:0.75rem;font-size:0.8rem;color:#94a3b8;">No contacts found</div>';
        dropdown.style.display = 'block';
        return;
      }

      dropdown.innerHTML = '';
      users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'attendee-result-item';
        item.innerHTML = `
          <div class="attendee-avatar-mini">${(u.name || 'U')[0].toUpperCase()}</div>
          <div class="attendee-result-meta">
            <span class="attendee-result-name">${window.CalendarUI.escapeHtml(u.name)}</span>
            <span class="attendee-result-username">@${window.CalendarUI.escapeHtml(u.username)}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          const ident = `@${u.username}`;
          if (!this.selectedAttendees.includes(ident)) {
            this.selectedAttendees.push(ident);
            this.renderSelectedAttendeesTags();
          }
          const searchInput = document.getElementById('event-form-attendees-search');
          if (searchInput) searchInput.value = '';
          dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
      });

      dropdown.style.display = 'block';
    }

    renderSelectedAttendeesTags() {
      const container = document.getElementById('selected-attendees-tags');
      if (!container) return;
      container.innerHTML = '';

      this.selectedAttendees.forEach(att => {
        const tag = document.createElement('span');
        tag.className = 'attendee-tag';
        tag.innerHTML = `
          <span>${window.CalendarUI.escapeHtml(att)}</span>
          <button type="button" class="btn-remove-attendee" title="Remove attendee">×</button>
        `;
        tag.querySelector('.btn-remove-attendee').addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedAttendees = this.selectedAttendees.filter(a => a !== att);
          this.renderSelectedAttendeesTags();
        });
        container.appendChild(tag);
      });
    }

    // =========================================================================
    // Keyboard Shortcuts
    // =========================================================================

    bindKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Do not trigger if typing in an input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
          if (e.key === 'Escape') {
            this.closeCreateModal();
            this.closeDetailModal();
          }
          return;
        }

        switch (e.key.toLowerCase()) {
          case 'escape':
            this.closeCreateModal();
            this.closeDetailModal();
            break;
          case 't':
            window.CalendarCore.today();
            break;
          case 'm':
            window.CalendarCore.setCurrentView('month');
            break;
          case 'w':
            window.CalendarCore.setCurrentView('week');
            break;
          case 'd':
            window.CalendarCore.setCurrentView('day');
            break;
          case 'a':
            window.CalendarCore.setCurrentView('agenda');
            break;
          case 'c':
            this.openCreateModal();
            break;
          case 'arrowleft':
            window.CalendarCore.prevPeriod();
            break;
          case 'arrowright':
            window.CalendarCore.nextPeriod();
            break;
        }
      });
    }
  }

  window.CalendarMainPage = new CalendarMainPage();
})(window);
