// @ts-check

/** 
 * View slideshow controller. 
 */
export class Slideshow {

  /**
   * Host View component.
   * @type {import('./view.js').View}
   */
  #view;

  /**
   * File skip timeout.
   * @type {NodeJS.Timeout|undefined}
   */
  #timer;

  /**
   * Seconds to wait between slides.
   */
  #delay = 1;
  
  /**
   * Slideshow state.
   */
  #active = false;

  /**
   * @param {import('./view.js').View} view View instance.
   */
  constructor(view) {
    this.#view = view;
  }
  
  /**
   * Slideshow state. Read only.
   */
  get isActive() {
    return this.#active;
  }

  /**
   * Get or set slideshow interval in seconds.
   */
  get delay() {
    return this.#delay;
  }

  /**
   * Get or set slideshow interval in seconds.
   * @param {number} value Slideshow interval in secs.
   */
  set delay(value) {
    this.#delay = Math.max(0, value);
    this.#view.events.fire('view:notify', `slide delay to ${this.#delay}s`, 'slideshow');
  }

  /**
   * Set timeout for next slide, if active.
   */
  tick() {
    if (!this.isActive)
      return;

    clearTimeout(this.#timer);

    this.#timer = setTimeout(() => {
      this.#view.events.fire('view:skip', true);
    }, this.#delay * 1000);
  }

  /**
   * Set slideshow on or off. Toggles by default.
   * @param {boolean} [active] Force slideshow state.
   * @param {boolean} [notify=true] Either to display an OSD message.
   */
  toggle(active = !this.isActive, notify = true) {
    clearTimeout(this.#timer);

    // set and signal play state
    this.#active = active;
    if (active)
      this.tick();

    this.#view.events.fire('view:playing', active);

    if (notify)
      this.#view.events.fire('view:notify', 
        `slideshow ${active ? `on [${this.#delay}s]` : 'off'}`, 'slideshow');
  }
}
