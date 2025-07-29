// @ts-check
import { ObservableEvents } from "../components/observableEvents.js";


/**
 * @typedef {import("./frameRegistry.js").FrameType} FrameType
 */

/**
 * @typedef {'frame:rename'|'frame:statusChange'|'frame:isPlaying'|'frame:hold'|'frame:notify'} GenericFrameEvents
 */


/**
 * Generic `HTMLElement` to extend tab frames from.
 * - Use `connectedCallback()` to populate the element, attach shadowRoot, clone templates.
 * - Use `disconnectedCallback()` as a destructor on node removal.
 */
export class GenericFrame extends HTMLElement {

  /**
   * Frame class type, class constructor name in lowercase.
   * @type {FrameType}
   */
  type = /** @type FrameType */ (this.constructor.name.toLowerCase());
  
  /**
   * @type {ObservableEvents<GenericFrameEvents>}
   */
  events = new ObservableEvents();

  /**
   * Current tab header name.
   */
  #tabName = '';

  /**
   * Current tab header name.
   * @returns {string}
   */
  get tabName() {
    return this.#tabName;
  }

  /**
   * Rename tab header name.
   * @param {string} newName 
   */
  set tabName(newName) {
    this.#tabName = newName;
    this.events.fire('frame:rename', newName);
  }

  /**
   * Update tab header play state icon.
   * @param {boolean} playing Either tab is playing.
   */
  setFrameIsPlaying(playing) {
    this.events.fire('frame:isPlaying', playing);
  }

  /**
   * Return Frame status object to be presented in bar. Override to customize.
   * @returns {import("../components/statusBar.js").StatusObjectType}
   */
  status() {
    return {
      title: this.constructor.name,
      infoLeft: this.constructor.name,
      infoRight: '',
      infoLeftFunc: null
    };
  }

  /**
   * Request a statusBar status refresh.
   */
  refreshStatus() {
    this.events.fire('frame:statusChange');
  }

  /**
   * Hold frame open, prevent closing tab/window.
   * @param {boolean} value Either to hold frame open.
   */
  hold(value) {
    this.events.fire('frame:hold', value);
  }
  
  /**
   * Display tab-wide on-screen notification.
   * @param {string} message Notification body.
   * @param {string} [typeId] Identifier to avoid duplicates.
   */
  notify(message, typeId) {
    this.events.fire('frame:notify', message, typeId);
  }

  /**
   * Return Frame state object.
   * @abstract
   * @returns {*}
   */
  getState() {}

  /**
   * Restore Frame state.
   * @abstract
   * @param {*} stateObject
   */
  restoreState(stateObject) {}

  /**
   * Handle media requests for media-session integration. Override to customize.
   * @abstract
   * @param {'play'|'pause'|'stop'|'next'|'previous'} action 
   */
  mediaControl(action) {}

  /**
   * Called on Frame Tab selected.
   * @abstract
   */
  onSelected() {}
}
