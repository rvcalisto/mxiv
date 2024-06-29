/** 
 * View slideshow controller. 
 */
export class Slideshow {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view

  /**
   * File skip timeout.
   * @type {Number?}
   */
  #timer = null

  /**
   * Seconds to wait between slides.
   */
  #delay = 1

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    /**
     * Slideshow state. Read only.
     */
    this.active = false

    this.#view = view
  }

  /**
   * Get or set slideshow interval in seconds.
   */
  get delay() {
    return this.#delay
  }

  /**
   * Get or set slideshow interval in seconds.
   * @param {Number} value Slideshow interval in secs.
   */
  set delay(value) {
    this.#delay = Math.max(0, value)
    this.#view.events.fire('view:notify', `slide delay to ${this.#delay}s`, 'slideshow')
  }

  /**
   * Set timeout for next slide, if active.
   */
  tick() {
    if (!this.active) return
    clearTimeout(this.#timer)

    this.#timer = setTimeout(() => {
      this.#view.events.fire('view:skip', true)
    }, this.#delay * 1000)
  }

  /**
   * Set slideshow on or off. Toggles by default.
   * @param {Boolean?} active Force slideshow state.
   * @param {true} notify Either to display an OSD message.
   */
  toggle(active = !this.active, notify = true) {
    clearTimeout(this.#timer)
    
    // set and signal play state
    this.active = active
    if (active) this.tick()
    this.#view.events.fire('view:playing', active)

    if (notify) {
      this.#view.events.fire('view:notify', `slideshow ${active ? 
      `on [${this.#delay}s]` : 'off'}`, 'slideshow')
    }
  }
}
