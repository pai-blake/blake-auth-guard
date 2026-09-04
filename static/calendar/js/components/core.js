/**
 * static/calendar/js/components/core.js
 * AuthGuard — Calendar Module Core State & API Client
 */
(function (window) {
  'use strict';

  class CalendarCore {
    constructor() {
      const now = new Date();
      this.state = {
        events: [],
        currentDate: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        currentView: 'month', // 'month' | 'week' | 'day' | 'agenda'
        activeCategory: 'all',
        searchQuery: '',
        selectedEvent: null,
        loading: false
      };

      this._listeners = new Map();
    }

    /** Retrieve state snapshot */
    getState() {
      return { ...this.state };
    }

    /** Set partial state and emit stateChange */
    setState(partial) {
      this.state = {
        ...this.state,
        ...partial
      };
      this.emit('stateChange', this.state);
    }

    /** Event Bus */
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).delete(callback);
      }
    }

    emit(event, data) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).forEach(cb => {
          try {
            cb(data);
          } catch (err) {
            console.error(`[CalendarCore] Error in event '${event}':`, err);
          }
        });
      }
    }

    // =========================================================================
    // Navigation & Date Manipulation
    // =========================================================================

    setCurrentDate(date) {
      const d = new Date(date);
      this.setState({ currentDate: d });
      this.emit('dateChange', d);
    }

    setCurrentView(view) {
      if (['month', 'week', 'day', 'agenda'].includes(view)) {
        this.setState({ currentView: view });
        this.emit('viewChange', view);
      }
    }

    setActiveCategory(category) {
      this.setState({ activeCategory: category });
      this.emit('filterChange', { category, query: this.state.searchQuery });
    }

    setSearchQuery(query) {
      this.setState({ searchQuery: (query || '').trim() });
      this.emit('filterChange', { category: this.state.activeCategory, query: this.state.searchQuery });
    }

    today() {
      const now = new Date();
      this.setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    }

    prevPeriod() {
      const d = new Date(this.state.currentDate);
      const view = this.state.currentView;
      if (view === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (view === 'week') {
        d.setDate(d.getDate() - 7);
      } else if (view === 'day') {
        d.setDate(d.getDate() - 1);
      } else if (view === 'agenda') {
        d.setMonth(d.getMonth() - 1);
      }
      this.setCurrentDate(d);
    }

    nextPeriod() {
      const d = new Date(this.state.currentDate);
      const view = this.state.currentView;
      if (view === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (view === 'week') {
        d.setDate(d.getDate() + 7);
      } else if (view === 'day') {
        d.setDate(d.getDate() + 1);
      } else if (view === 'agenda') {
        d.setMonth(d.getMonth() + 1);
      }
      this.setCurrentDate(d);
    }

    // =========================================================================
    // Filtered Events Retrieval
    // =========================================================================

    getFilteredEvents() {
      let list = this.state.events || [];
      const cat = this.state.activeCategory;
      const q = (this.state.searchQuery || '').toLowerCase();

      if (cat && cat !== 'all') {
        list = list.filter(e => (e.category || '').toLowerCase() === cat);
      }

      if (q) {
        list = list.filter(e =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
        );
      }

      return list;
    }

    getEventsForDate(year, month, day) {
      const targetStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return this.getFilteredEvents().filter(e => {
        if (!e.start_dt) return false;
        return e.start_dt.startsWith(targetStr);
      });
    }

    getEventById(id) {
      if (!id) return null;
      return (this.state.events || []).find(e => String(e.id) === String(id)) || null;
    }

    // =========================================================================
    // API Calls
    // =========================================================================

    async fetchEvents(start = '', end = '') {
      this.setState({ loading: true });
      try {
        let url = '/calendar/api/events?';
        const params = new URLSearchParams();
        if (start) params.append('start', start);
        if (end) params.append('end', end);
        if (this.state.activeCategory && this.state.activeCategory !== 'all') {
          params.append('category', this.state.activeCategory);
        }
        url += params.toString();

        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (data.ok) {
          this.setState({ events: data.events || [], loading: false });
          this.emit('eventsLoaded', data.events || []);
          return data.events || [];
        } else {
          this.setState({ loading: false });
          this._toast(data.error || 'Failed to load events', 'error');
          return [];
        }
      } catch (err) {
        this.setState({ loading: false });
        console.error('[CalendarCore] fetchEvents error:', err);
        this._toast('Network error loading events', 'error');
        return [];
      }
    }

    async createEvent(eventData) {
      try {
        const res = await fetch('/calendar/api/events/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(eventData)
        });
        const data = await res.json();
        if (data.ok && data.event) {
          const events = [...this.state.events, data.event];
          this.setState({ events });
          this.emit('eventCreated', data.event);
          this._toast('Event created successfully!', 'success');
          return { ok: true, event: data.event };
        } else {
          this._toast(data.error || 'Could not create event', 'error');
          return { ok: false, error: data.error };
        }
      } catch (err) {
        console.error('[CalendarCore] createEvent error:', err);
        this._toast('Error creating event', 'error');
        return { ok: false, error: 'Network error' };
      }
    }

    async updateEvent(eventId, eventData) {
      try {
        const res = await fetch(`/calendar/api/events/update/${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(eventData)
        });
        const data = await res.json();
        if (data.ok && data.event) {
          const events = this.state.events.map(e => e.id === eventId ? data.event : e);
          this.setState({ events });
          this.emit('eventUpdated', data.event);
          this._toast('Event updated successfully!', 'success');
          return { ok: true, event: data.event };
        } else {
          this._toast(data.error || 'Could not update event', 'error');
          return { ok: false, error: data.error };
        }
      } catch (err) {
        console.error('[CalendarCore] updateEvent error:', err);
        this._toast('Error updating event', 'error');
        return { ok: false, error: 'Network error' };
      }
    }

    async deleteEvent(eventId) {
      try {
        const res = await fetch(`/calendar/api/events/delete/${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });
        const data = await res.json();
        if (data.ok) {
          const events = this.state.events.filter(e => e.id !== eventId);
          this.setState({ events });
          this.emit('eventDeleted', eventId);
          this._toast('Event deleted successfully', 'info');
          return { ok: true };
        } else {
          this._toast(data.error || 'Could not delete event', 'error');
          return { ok: false, error: data.error };
        }
      } catch (err) {
        console.error('[CalendarCore] deleteEvent error:', err);
        this._toast('Error deleting event', 'error');
        return { ok: false, error: 'Network error' };
      }
    }

    async searchAttendees(query) {
      if (!query || !query.trim()) return [];
      try {
        const res = await fetch(`/calendar/api/attendees/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json();
        return data.ok ? (data.users || []) : [];
      } catch (err) {
        console.error('[CalendarCore] searchAttendees error:', err);
        return [];
      }
    }

    _toast(msg, type = 'info') {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show(msg, type);
      } else {
        console.log(`[Toast] ${type}: ${msg}`);
      }
    }
  }

  window.CalendarCore = new CalendarCore();
})(window);
