/**
 * static/calendar/js/components/ui.js
 * AuthGuard — Calendar Module DOM Renderers & UI Builders
 */
(function (window) {
  'use strict';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  class CalendarUI {
    /** Escape HTML helper to prevent XSS */
    escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    formatTime(isoString) {
      if (!isoString) return '';
      try {
        const d = new Date(isoString);
        let hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
      } catch (e) {
        return '';
      }
    }

    formatDateShort(isoString) {
      if (!isoString) return '';
      const d = new Date(isoString);
      return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
    }

    formatDateFull(date) {
      const d = new Date(date);
      return `${DAY_NAMES_FULL[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }

    // =========================================================================
    // 1. Month View Renderer
    // =========================================================================

    renderMonthView(container, currentDate, events) {
      if (!container) return;
      container.innerHTML = '';

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // First day of current month
      const firstDayIndex = new Date(year, month, 1).getDay();
      // Total days in current month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      // Total days in previous month
      const prevDaysInMonth = new Date(year, month, 0).getDate();

      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
      const todayDate = today.getDate();

      // Calculate total cells needed (multiples of 7, 35 or 42)
      const totalCells = (firstDayIndex + daysInMonth) > 35 ? 42 : 35;

      const frag = document.createDocumentFragment();

      for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'month-day-cell';

        let cellDate, cellMonth, cellYear, isOtherMonth = false;

        if (i < firstDayIndex) {
          // Trailing days of previous month
          cellDate = prevDaysInMonth - firstDayIndex + i + 1;
          cellMonth = month - 1;
          cellYear = cellMonth < 0 ? year - 1 : year;
          if (cellMonth < 0) cellMonth = 11;
          isOtherMonth = true;
          cell.classList.add('other-month');
        } else if (i >= firstDayIndex + daysInMonth) {
          // Leading days of next month
          cellDate = i - (firstDayIndex + daysInMonth) + 1;
          cellMonth = month + 1;
          cellYear = cellMonth > 11 ? year + 1 : year;
          if (cellMonth > 11) cellMonth = 0;
          isOtherMonth = true;
          cell.classList.add('other-month');
        } else {
          // Current month day
          cellDate = i - firstDayIndex + 1;
          cellMonth = month;
          cellYear = year;
          if (isCurrentMonth && cellDate === todayDate) {
            cell.classList.add('today');
          }
        }

        const dateIsoStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDate).padStart(2, '0')}`;
        cell.dataset.date = dateIsoStr;

        // Top Row: Day Number + Quick Add Button
        const topRow = document.createElement('div');
        topRow.className = 'cell-top-row';

        const numSpan = document.createElement('span');
        numSpan.className = 'day-number';
        numSpan.textContent = cellDate;

        const quickAddBtn = document.createElement('button');
        quickAddBtn.type = 'button';
        quickAddBtn.className = 'btn-quick-add';
        quickAddBtn.title = 'Add event on this date';
        quickAddBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
        quickAddBtn.dataset.action = 'quick-add';
        quickAddBtn.dataset.date = dateIsoStr;

        topRow.appendChild(numSpan);
        topRow.appendChild(quickAddBtn);
        cell.appendChild(topRow);

        // Filter events for this day
        const dayEvents = (events || []).filter(e => e.start_dt && e.start_dt.startsWith(dateIsoStr));

        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events-container';

        const MAX_DISPLAY = 3;
        const displayEvents = dayEvents.slice(0, MAX_DISPLAY);

        displayEvents.forEach(evt => {
          const pill = document.createElement('div');
          pill.className = 'event-pill';
          pill.style.background = evt.color || '#6C63FF';
          pill.dataset.eventId = evt.id;
          pill.dataset.action = 'view-event';

          const timeText = evt.all_day ? 'All day' : this.formatTime(evt.start_dt);
          pill.innerHTML = `
            ${timeText ? `<span class="event-pill-time">${this.escapeHtml(timeText)}</span>` : ''}
            <span class="event-pill-title">${this.escapeHtml(evt.title)}</span>
          `;
          eventsContainer.appendChild(pill);
        });

        if (dayEvents.length > MAX_DISPLAY) {
          const overflow = document.createElement('span');
          overflow.className = 'event-overflow-badge';
          overflow.textContent = `+${dayEvents.length - MAX_DISPLAY} more`;
          overflow.dataset.action = 'view-day-events';
          overflow.dataset.date = dateIsoStr;
          eventsContainer.appendChild(overflow);
        }

        cell.appendChild(eventsContainer);
        frag.appendChild(cell);
      }

      container.appendChild(frag);
    }

    // =========================================================================
    // 2. Week View Renderer
    // =========================================================================

    renderWeekView(headersContainer, gridContainer, currentDate, events) {
      if (!headersContainer || !gridContainer) return;
      headersContainer.innerHTML = '';
      gridContainer.innerHTML = '';

      // Find Sunday of the current week
      const curr = new Date(currentDate);
      const dayOfWeek = curr.getDay();
      const weekStart = new Date(curr);
      weekStart.setDate(curr.getDate() - dayOfWeek);

      const weekDays = [];
      const today = new Date();

      // Build Headers
      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + d);
        weekDays.push(dayDate);

        const isToday = dayDate.getFullYear() === today.getFullYear() &&
                        dayDate.getMonth() === today.getMonth() &&
                        dayDate.getDate() === today.getDate();

        const colHeader = document.createElement('div');
        colHeader.className = `week-day-col-header ${isToday ? 'today' : ''}`;
        colHeader.dataset.date = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
        colHeader.dataset.action = 'jump-to-day';

        colHeader.innerHTML = `
          <span class="week-day-name">${DAY_NAMES_SHORT[d]}</span>
          <span class="week-day-num">${dayDate.getDate()}</span>
        `;
        headersContainer.appendChild(colHeader);
      }

      // Build Time Gutter (24 hours)
      const timeGutter = document.createElement('div');
      timeGutter.className = 'time-gutter';
      for (let h = 0; h < 24; h++) {
        const slotLabel = document.createElement('div');
        slotLabel.className = 'time-slot-label';
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        slotLabel.textContent = `${displayH} ${ampm}`;
        timeGutter.appendChild(slotLabel);
      }
      gridContainer.appendChild(timeGutter);

      // Build 7 Day Columns
      const daysColumns = document.createElement('div');
      daysColumns.className = 'week-days-columns';

      const SLOT_HEIGHT = 44; // 44px per hour

      weekDays.forEach(dayDate => {
        const col = document.createElement('div');
        col.className = 'week-day-column';
        const dateIsoStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
        col.dataset.date = dateIsoStr;

        // Hour lines
        for (let h = 0; h < 24; h++) {
          const line = document.createElement('div');
          line.className = 'hour-row-line';
          line.style.top = `${h * SLOT_HEIGHT}px`;
          line.dataset.hour = h;
          line.dataset.date = dateIsoStr;
          line.dataset.action = 'quick-add-hour';
          col.appendChild(line);
        }

        // Render Events in this column
        const dayEvents = (events || []).filter(e => e.start_dt && e.start_dt.startsWith(dateIsoStr));

        dayEvents.forEach(evt => {
          const block = document.createElement('div');
          block.className = 'week-event-block';
          block.style.background = evt.color || '#6C63FF';
          block.dataset.eventId = evt.id;
          block.dataset.action = 'view-event';

          // Calculate vertical position and height
          const startD = new Date(evt.start_dt);
          const endD = evt.end_dt ? new Date(evt.end_dt) : new Date(startD.getTime() + 3600000);

          const startHour = startD.getHours() + (startD.getMinutes() / 60);
          let durationHours = (endD.getTime() - startD.getTime()) / (1000 * 60 * 60);
          if (durationHours < 0.5) durationHours = 0.5; // min 30 min height

          block.style.top = `${Math.max(0, startHour * SLOT_HEIGHT)}px`;
          block.style.height = `${Math.max(26, durationHours * SLOT_HEIGHT - 4)}px`;

          block.innerHTML = `
            <div class="week-event-title">${this.escapeHtml(evt.title)}</div>
            <div class="week-event-time">${this.formatTime(evt.start_dt)}</div>
          `;
          col.appendChild(block);
        });

        daysColumns.appendChild(col);
      });

      gridContainer.appendChild(daysColumns);

      // Auto-scroll to 8 AM
      setTimeout(() => {
        const scrollable = document.getElementById('week-body-scrollable');
        if (scrollable) scrollable.scrollTop = 8 * SLOT_HEIGHT;
      }, 50);
    }

    // =========================================================================
    // 3. Day View Renderer
    // =========================================================================

    renderDayView(headerContainer, gridContainer, currentDate, events) {
      if (!headerContainer || !gridContainer) return;

      const dateIsoStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const dayEvents = (events || []).filter(e => e.start_dt && e.start_dt.startsWith(dateIsoStr));

      // Update Header
      const titleEl = document.getElementById('day-view-date-title');
      const countEl = document.getElementById('day-view-event-count');
      if (titleEl) titleEl.textContent = this.formatDateFull(currentDate);
      if (countEl) countEl.textContent = `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`;

      gridContainer.innerHTML = '';

      // Day Time Gutter
      const timeGutter = document.createElement('div');
      timeGutter.className = 'day-time-gutter';
      for (let h = 0; h < 24; h++) {
        const slotLabel = document.createElement('div');
        slotLabel.className = 'day-slot-label';
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        slotLabel.textContent = `${displayH}:00 ${ampm}`;
        timeGutter.appendChild(slotLabel);
      }
      gridContainer.appendChild(timeGutter);

      // Single Day Column
      const eventsCol = document.createElement('div');
      eventsCol.className = 'day-events-column';

      const SLOT_HEIGHT = 48; // 48px per hour

      for (let h = 0; h < 24; h++) {
        const line = document.createElement('div');
        line.className = 'day-slot-line';
        line.style.top = `${h * SLOT_HEIGHT}px`;
        line.dataset.hour = h;
        line.dataset.date = dateIsoStr;
        line.dataset.action = 'quick-add-hour';
        eventsCol.appendChild(line);
      }

      dayEvents.forEach(evt => {
        const card = document.createElement('div');
        card.className = 'day-event-card';
        card.style.background = evt.color || '#6C63FF';
        card.dataset.eventId = evt.id;
        card.dataset.action = 'view-event';

        const startD = new Date(evt.start_dt);
        const endD = evt.end_dt ? new Date(evt.end_dt) : new Date(startD.getTime() + 3600000);

        const startHour = startD.getHours() + (startD.getMinutes() / 60);
        let durationHours = (endD.getTime() - startD.getTime()) / (1000 * 60 * 60);
        if (durationHours < 0.6) durationHours = 0.6;

        card.style.top = `${startHour * SLOT_HEIGHT + 2}px`;
        card.style.height = `${durationHours * SLOT_HEIGHT - 6}px`;

        card.innerHTML = `
          <div class="day-event-title">${this.escapeHtml(evt.title)}</div>
          <div class="day-event-meta">
            <span>${this.formatTime(evt.start_dt)} – ${this.formatTime(evt.end_dt)}</span>
            ${evt.location ? `<span>• 📍 ${this.escapeHtml(evt.location)}</span>` : ''}
            <span>• 🏷️ ${this.escapeHtml(evt.category || 'General')}</span>
          </div>
        `;
        eventsCol.appendChild(card);
      });

      gridContainer.appendChild(eventsCol);

      setTimeout(() => {
        const scrollable = document.getElementById('day-body-scrollable');
        if (scrollable) scrollable.scrollTop = 8 * SLOT_HEIGHT;
      }, 50);
    }

    // =========================================================================
    // 4. Agenda View Renderer
    // =========================================================================

    renderAgendaView(container, events) {
      if (!container) return;
      container.innerHTML = '';

      if (!events || events.length === 0) {
        container.innerHTML = `
          <div class="empty-agenda-box">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <p>No events found for this period or filter.</p>
          </div>
        `;
        return;
      }

      // Group events by date (YYYY-MM-DD)
      const groups = {};
      events.forEach(evt => {
        const dateKey = evt.start_dt ? evt.start_dt.split('T')[0] : 'undated';
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(evt);
      });

      // Sort dates
      const sortedKeys = Object.keys(groups).sort();

      sortedKeys.forEach(dateKey => {
        const groupEl = document.createElement('div');
        groupEl.className = 'agenda-date-group';

        const header = document.createElement('div');
        header.className = 'agenda-group-header';
        header.textContent = this.formatDateFull(dateKey);
        groupEl.appendChild(header);

        groups[dateKey].forEach(evt => {
          const card = document.createElement('div');
          card.className = 'agenda-event-card';
          card.style.borderLeftColor = evt.color || '#6C63FF';
          card.dataset.eventId = evt.id;
          card.dataset.action = 'view-event';

          const timeDisplay = evt.all_day ? 'All day' : `${this.formatTime(evt.start_dt)} – ${this.formatTime(evt.end_dt)}`;

          card.innerHTML = `
            <div class="agenda-card-left">
              <span class="agenda-time-pill">${this.escapeHtml(timeDisplay)}</span>
              <div class="agenda-info">
                <span class="agenda-title">${this.escapeHtml(evt.title)}</span>
                ${evt.location ? `<span class="agenda-location">📍 ${this.escapeHtml(evt.location)}</span>` : ''}
              </div>
            </div>
            <span class="agenda-category-badge" style="background: ${evt.color || '#6C63FF'};">${this.escapeHtml(evt.category || 'General')}</span>
          `;
          groupEl.appendChild(card);
        });

        container.appendChild(groupEl);
      });
    }

    // =========================================================================
    // 5. Mini-Calendar Widget
    // =========================================================================

    renderMiniCalendar(container, currentDate, events) {
      if (!container) return;
      container.innerHTML = '';

      const titleEl = document.getElementById('mini-cal-title');
      if (titleEl) {
        titleEl.textContent = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      }

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDayIndex = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevDaysInMonth = new Date(year, month, 0).getDate();

      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

      // Weekday initials
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
        const nameEl = document.createElement('div');
        nameEl.className = 'mini-day-name';
        nameEl.textContent = d;
        container.appendChild(nameEl);
      });

      const totalCells = (firstDayIndex + daysInMonth) > 35 ? 42 : 35;

      for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'mini-day-cell';

        let cellDate, cellMonth, cellYear, isOther = false;
        if (i < firstDayIndex) {
          cellDate = prevDaysInMonth - firstDayIndex + i + 1;
          cellMonth = month - 1;
          cellYear = cellMonth < 0 ? year - 1 : year;
          if (cellMonth < 0) cellMonth = 11;
          isOther = true;
          cell.classList.add('other-month');
        } else if (i >= firstDayIndex + daysInMonth) {
          cellDate = i - (firstDayIndex + daysInMonth) + 1;
          cellMonth = month + 1;
          cellYear = cellMonth > 11 ? year + 1 : year;
          if (cellMonth > 11) cellMonth = 0;
          isOther = true;
          cell.classList.add('other-month');
        } else {
          cellDate = i - firstDayIndex + 1;
          cellMonth = month;
          cellYear = year;
          if (isCurrentMonth && cellDate === today.getDate()) {
            cell.classList.add('today');
          }
        }

        const dateIsoStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDate).padStart(2, '0')}`;
        cell.textContent = cellDate;
        cell.dataset.date = dateIsoStr;
        cell.dataset.action = 'mini-cal-select';

        // Check if day has events
        const hasEvt = (events || []).some(e => e.start_dt && e.start_dt.startsWith(dateIsoStr));
        if (hasEvt) cell.classList.add('has-events');

        // Check active date
        if (currentDate.getDate() === cellDate && currentDate.getMonth() === cellMonth && currentDate.getFullYear() === cellYear) {
          cell.classList.add('active-date');
        }

        container.appendChild(cell);
      }
    }

    // =========================================================================
    // 6. Upcoming Events in Sidebar
    // =========================================================================

    renderUpcomingEvents(container, events) {
      if (!container) return;
      container.innerHTML = '';

      const countEl = document.getElementById('upcoming-events-count');
      const nowIso = new Date().toISOString();

      const upcoming = (events || [])
        .filter(e => e.end_dt && e.end_dt >= nowIso)
        .slice(0, 5);

      if (countEl) countEl.textContent = upcoming.length;

      if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state-mini">No upcoming events scheduled</div>';
        return;
      }

      upcoming.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'upcoming-item';
        item.style.borderLeftColor = evt.color || '#6C63FF';
        item.dataset.eventId = evt.id;
        item.dataset.action = 'view-event';

        item.innerHTML = `
          <div class="upcoming-item-title">${this.escapeHtml(evt.title)}</div>
          <div class="upcoming-item-time">${this.formatDateShort(evt.start_dt)} • ${this.formatTime(evt.start_dt)}</div>
        `;
        container.appendChild(item);
      });
    }

    // =========================================================================
    // 7. Update Period Title in Toolbar
    // =========================================================================

    updatePeriodTitle(titleEl, currentDate, currentView) {
      if (!titleEl) return;
      const monthName = MONTH_NAMES[currentDate.getMonth()];
      const year = currentDate.getFullYear();

      if (currentView === 'month' || currentView === 'agenda') {
        titleEl.textContent = `${monthName} ${year}`;
      } else if (currentView === 'week') {
        const curr = new Date(currentDate);
        const dayOfWeek = curr.getDay();
        const start = new Date(curr);
        start.setDate(curr.getDate() - dayOfWeek);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        if (start.getMonth() === end.getMonth()) {
          titleEl.textContent = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
        } else {
          titleEl.textContent = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
        }
      } else if (currentView === 'day') {
        titleEl.textContent = `${monthName.slice(0, 3)} ${currentDate.getDate()}, ${year}`;
      }
    }
  }

  window.CalendarUI = new CalendarUI();
})(window);
