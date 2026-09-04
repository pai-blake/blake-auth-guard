/**
 * static/contact/js/components/core.js
 * AuthGuard — Contact Module Core State & API Client
 */
(function (window) {
  'use strict';

  class ContactCore {
    constructor() {
      this.state = {
        contacts: [],
        favourites: [],
        customPages: [],
        searchResults: [],
        searchQuery: '',
        filterQuery: '',
        sortBy: 'recent',
        loading: false
      };

      this._listeners = new Map();
    }

    /** Retrieve state snapshot */
    getState() {
      return { ...this.state };
    }

    /** Set state and notify listeners */
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
          try { cb(data); } catch (err) { console.error(`[ContactCore] Error in event '${event}':`, err); }
        });
      }
    }

    /** Find user in state cache */
    getUserById(id) {
      if (!id) return null;
      const all = [...(this.state.contacts || []), ...(this.state.favourites || []), ...(this.state.searchResults || [])];
      return all.find(u => String(u.id) === String(id)) || null;
    }

    // =========================================================================
    // API Methods
    // =========================================================================

    /** Search users by exact @username or name substring */
    async searchUsers(query) {
      const q = (query || '').trim();
      this.setState({ searchQuery: q, loading: true });
      if (!q) {
        this.setState({ searchResults: [], loading: false });
        return [];
      }
      try {
        const res = await fetch(`/contact/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.ok) {
          this.setState({ searchResults: data.users || [], loading: false });
          this.emit('searchComplete', data.users || []);
          return data.users || [];
        }
      } catch (err) {
        console.error('[ContactCore] search error:', err);
      }
      this.setState({ loading: false });
      return [];
    }

    /** Load all saved contacts */
    async loadAllContacts() {
      try {
        const res = await fetch('/contact/api/all');
        const data = await res.json();
        if (data.ok) {
          this.setState({ contacts: data.contacts || [] });
          this.emit('contactsLoaded', data.contacts || []);
          return data.contacts || [];
        }
      } catch (err) {
        console.error('[ContactCore] loadAllContacts error:', err);
      }
      return [];
    }

    /** Load favourite contacts */
    async loadFavourites() {
      try {
        const res = await fetch('/contact/api/favourites');
        const data = await res.json();
        if (data.ok) {
          this.setState({ favourites: data.favourites || [] });
          this.emit('favouritesLoaded', data.favourites || []);
          return data.favourites || [];
        }
      } catch (err) {
        console.error('[ContactCore] loadFavourites error:', err);
      }
      return [];
    }

    /** Load custom pages */
    async loadPages() {
      try {
        const res = await fetch('/contact/api/pages');
        const data = await res.json();
        if (data.ok) {
          this.setState({ customPages: data.pages || [] });
          this.emit('pagesLoaded', data.pages || []);
          return data.pages || [];
        }
      } catch (err) {
        console.error('[ContactCore] loadPages error:', err);
      }
      return [];
    }

    /** Save a contact to address book */
    async saveContact(contactId) {
      try {
        const res = await fetch('/contact/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contactId })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadAllContacts();
          // Update search results flags if present
          const updatedSearch = this.state.searchResults.map(u => u.id === contactId ? { ...u, is_saved: true } : u);
          this.setState({ searchResults: updatedSearch });
          this.emit('contactSaved', contactId);
          return { ok: true, message: data.message };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    /** Remove contact from address book */
    async unsaveContact(contactId) {
      try {
        const res = await fetch('/contact/api/unsave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contactId })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadAllContacts();
          await this.loadFavourites();
          const updatedSearch = this.state.searchResults.map(u => u.id === contactId ? { ...u, is_saved: false, is_favourite: false } : u);
          this.setState({ searchResults: updatedSearch });
          this.emit('contactUnsaved', contactId);
          return { ok: true, message: data.message };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    /** Toggle favourite status */
    async toggleFavourite(contactId, isFav) {
      try {
        const res = await fetch('/contact/api/favourite/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact_id: contactId, is_fav: isFav })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadAllContacts();
          await this.loadFavourites();
          const updatedSearch = this.state.searchResults.map(u => u.id === contactId ? { ...u, is_saved: true, is_favourite: isFav } : u);
          this.setState({ searchResults: updatedSearch });
          this.emit('favouriteToggled', { contactId, isFav });
          return { ok: true, isFav };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    /** Create custom page (max 3 extra / 6 total) */
    async createPage(name, icon = 'folder') {
      try {
        const res = await fetch('/contact/api/pages/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadPages();
          this.emit('pageCreated', data.page);
          return { ok: true, page: data.page, message: data.message };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    /** Rename custom page */
    async renamePage(pageId, name) {
      try {
        const res = await fetch('/contact/api/pages/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: pageId, name })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadPages();
          this.emit('pageRenamed', { pageId, name });
          return { ok: true, message: data.message };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    /** Delete custom page */
    async deletePage(pageId) {
      try {
        const res = await fetch('/contact/api/pages/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_id: pageId })
        });
        const data = await res.json();
        if (data.ok) {
          await this.loadPages();
          this.emit('pageDeleted', pageId);
          return { ok: true, message: data.message };
        }
        return { ok: false, error: data.error };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
  }

  // Export globally
  window.ContactCore = new ContactCore();
})(window);
