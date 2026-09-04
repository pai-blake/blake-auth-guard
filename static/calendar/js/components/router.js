/**
 * static/calendar/js/components/router.js
 * AuthGuard — Calendar Module In-Page View Router & Navigation
 */
(function (window) {
  'use strict';

  class CalendarRouter {
    constructor() {
      this.currentView = 'month';
    }

    init() {
      // Listen to core state updates
      window.CalendarCore.on('viewChange', (view) => this.switchView(view));
      window.CalendarCore.on('dateChange', () => this.refreshCurrentView());
      window.CalendarCore.on('eventsLoaded', () => this.refreshCurrentView());
      window.CalendarCore.on('eventCreated', () => this.refreshCurrentView());
      window.CalendarCore.on('eventUpdated', () => this.refreshCurrentView());
      window.CalendarCore.on('eventDeleted', () => this.refreshCurrentView());
      window.CalendarCore.on('filterChange', () => this.refreshCurrentView());
    }

    switchView(viewName) {
      if (!['month', 'week', 'day', 'agenda'].includes(viewName)) return;
      this.currentView = viewName;

      // Update View Switcher Buttons
      document.querySelectorAll('.calendar-view-selector .view-btn').forEach(btn => {
        if (btn.dataset.view === viewName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update Views Container
      const views = ['month', 'week', 'day', 'agenda'];
      views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) {
          if (v === viewName) {
            el.style.display = 'flex';
            el.classList.add('active');
          } else {
            el.style.display = 'none';
            el.classList.remove('active');
          }
        }
      });

      this.refreshCurrentView();
    }

    refreshCurrentView() {
      const state = window.CalendarCore.getState();
      const events = window.CalendarCore.getFilteredEvents();
      const currentDate = state.currentDate;
      const view = this.currentView;

      // 1. Update Period Title
      const titleEl = document.getElementById('cal-period-title');
      window.CalendarUI.updatePeriodTitle(titleEl, currentDate, view);

      // 2. Render Active View
      if (view === 'month') {
        const monthGrid = document.getElementById('month-days-grid');
        window.CalendarUI.renderMonthView(monthGrid, currentDate, events);
      } else if (view === 'week') {
        const headers = document.getElementById('week-day-headers');
        const grid = document.getElementById('week-time-grid');
        window.CalendarUI.renderWeekView(headers, grid, currentDate, events);
      } else if (view === 'day') {
        const headerCard = document.getElementById('day-header-card');
        const grid = document.getElementById('day-time-grid');
        window.CalendarUI.renderDayView(headerCard, grid, currentDate, events);
      } else if (view === 'agenda') {
        const feed = document.getElementById('agenda-events-feed');
        window.CalendarUI.renderAgendaView(feed, events);
      }

      // 3. Render Mini-Calendar in Sidebar
      const miniGrid = document.getElementById('mini-cal-grid');
      window.CalendarUI.renderMiniCalendar(miniGrid, currentDate, state.events);

      // 4. Render Upcoming Events in Sidebar
      const upcomingList = document.getElementById('upcoming-events-list');
      window.CalendarUI.renderUpcomingEvents(upcomingList, state.events);
    }
  }

  window.CalendarRouter = new CalendarRouter();
})(window);
