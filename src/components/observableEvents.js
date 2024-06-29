/**
 * Provide observable custom events.
 * @template {string} CustomEvents
 */
export class ObservableEvents {

  /**
   * @type {Object<string, ((...any)=>void)[]>}
   */
  #events = {};

  /**
   * Register an event observer.
   * @param {CustomEvents} event
   * @param {(...any)=>void} callback
   */
  observe(event, callback) {
    if (this.#events[event] == null)
      this.#events[event] = [];

    this.#events[event].push(callback);
  }

  /**
   * Fire an event.
   * @param {CustomEvents} event
   * @param {...any} payload
   */
  fire(event, ...payload) {
    const registeredCallbacks = this.#events[event];
    if (registeredCallbacks != null) {
      for (const callback of registeredCallbacks)
        callback(...payload);
    }
  }
}
