/**
 * Generic `HTMLElement` to extend tab frames from.
 * - Use `connectedCallback()` to populate the element, attach shadowRoot, clone templates.
 * - Use `disconnectedCallback()` as a destructor on node removal.
 */
export class GenericFrame extends HTMLElement {

  /**
   * Allow duplication.
   * @type {true}
   */
  static allowDuplicate = true

  /**
   * Allow tab store/restore if implemented.
   * @type {true}
   */
  static allowProfiling = true

  constructor() {
    super()

    /**
     * Frame class type, class constructor in lowercase.
     * @type {String}
     */
    this.type = this.constructor.name.toLowerCase()
  }

  /**
   * Returns the class associated to a customElement.
   * @param {String} type Component type.
   * @returns {typeof GenericFrame}
   */
  static getClass(type) {
    return customElements.get(`${type}-component`)
  }

  /**
   * Return current tab header name.
   * @returns {String}
   */
  get tabName() {
    return this.getAttribute("frametitle")
  }

  /**
   * Rename tab header.
   * @param {String} newName 
   */
  renameTab(newName) {
    this.setAttribute("frametitle", newName)
  }

  /**
   * Update tab header play state icon.
   * @param {Boolean} playing Either tab is playing.
   */
  setFrameIsPlaying(playing) {
    this.toggleAttribute("playing", playing)
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
    }
  }

  /**
   * Request a StatusBar status refresh.
   */
  refreshStatus() {
    this.setAttribute("updatestatus", true)
  }

  /**
   * Hold frame open, prevent closing tab/window.
   * @param {Boolean} value Either to hold frame open.
   */
  hold(value) {
    this.toggleAttribute('hold', value)
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