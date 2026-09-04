/**
 * static/template/js/components/core.js
 * AuthGuard — Template Module Core State & Business Logic Backbone
 * 
 * Developer Guide:
 *  Use TemplateCore to store module state, trigger business actions,
 *  and publish events across sub-components.
 */
(function (window) {
  'use strict';

  class TemplateCore {
    constructor() {
      this.state = {
        title: 'template',
        counter: 0,
        lastUpdated: Date.now(),
        settings: {
          debugMode: false,
          themeOverride: null
        }
      };

      this._listeners = new Map();
    }

    /** Retrieve a snapshot of the current state */
    getState() {
      return { ...this.state };
    }

    /** Update state partially and notify listeners */
    setState(partialState) {
      this.state = {
        ...this.state,
        ...partialState,
        lastUpdated: Date.now()
      };
      this.emit('stateChange', this.state);
    }

    /** Increment sample counter */
    incrementCounter() {
      this.setState({ counter: this.state.counter + 1 });
      return this.state.counter;
    }

    /** Subscribe to core events */
    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, new Set());
      }
      this._listeners.get(event).add(callback);
      return () => this.off(event, callback);
    }

    /** Unsubscribe from core events */
    off(event, callback) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).delete(callback);
      }
    }

    /** Emit event to subscribers */
    emit(event, data) {
      if (this._listeners.has(event)) {
        this._listeners.get(event).forEach(cb => {
          try { cb(data); } catch (err) { console.error(`[TemplateCore] Error in event '${event}':`, err); }
        });
      }
    }
  }

  // Export globally
  window.TemplateCore = new TemplateCore();
})(window);
