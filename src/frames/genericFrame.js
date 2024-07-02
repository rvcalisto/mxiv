import { ObservableEvents } from "../components/observableEvents.js";


/**
 * @typedef {'frame:rename'|'frame:statusChange'|'frame:isPlaying'} GenericFrameEvents
 */


/**
 * Generic `HTMLElement` to extend tab frames from.
 * - Use `connectedCallback()` to populate the element, attach shadowRoot, clone templates.
 * - Use `disconnectedCallback()` as a destructor on node removal.
 */
export class GenericFrame extends HTMLElement {

  /**
   * Frame class type, class constructor name in lowercase.
   * @type {String}
   */
  type = this.constructor.name.toLowerCase();
  
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
    return this.#tabName
  }

  /**
   * Rename tab header name.
   * @param {String} newName 
   */
  set tabName(newName) {
    this.#tabName = newName;
    this.events.fire('frame:rename', newName);
  }

  /**
   * Update tab header play state icon.
   * @param {Boolean} playing Either tab is playing.
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
   * Request a StatusBar status refresh.
   */
  refreshStatus() {
    this.events.fire('frame:statusChange');
  }

  /**
   * Hold frame open, prevent closing tab/window.
   * @param {Boolean} value Either to hold frame open.
   */
  hold(value) {
    this.toggleAttribute('hold', value);
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
}