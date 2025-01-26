/**
 * @typedef StatusObjectType
 * @property {String} title Title to display on application window.
 * @property {String} infoLeft Information to display on the left.
 * @property {String} infoRight Information to display on the right.
 * @property {(()=>void)?} infoLeftFunc Function to run on right-click on the left.
 */


/**
 * Display contextual information and update window title.
 */
export const statusBar = new class {

  /**
   * Application name.
   */
  #titleSuffix = 'MXIV';

  #barElement  = /** @type {HTMLDivElement}   */ (document.getElementById('bar'));
  #nameElement = /** @type {HTMLLabelElement} */ (document.getElementById('barName'));
  #infoElement = /** @type {HTMLLabelElement} */ (document.getElementById('barInfo'));

  /**
   * Old visibility value before fullscreen.
   */
  #wasVisible = this.isVisible();


  // toggle visibility on fullscreen
  static {
    elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
      if (isFullscreen) statusBar.#wasVisible = statusBar.isVisible();
      statusBar.toggle(isFullscreen ? false : statusBar.#wasVisible);
    });
  }

  /** 
   * Either status bar is visible.
   */
  isVisible() {
    return this.#barElement.style.fontSize === '';
  }

  /**
   * Toggle status bar visibility.
   * @param {Boolean} [force] Either to force on and off instead.
   */
  toggle(force) {
    if (force === undefined) force = !this.isVisible();
    this.#barElement.style.fontSize = force ? '' : '0px'; // smooth animation
  }

  /**
   * Force update status info with current tab data.
   * @param {StatusObjectType} statusObject 
   */
  updateStatus(statusObject) {
    const { title, infoLeft, infoRight, infoLeftFunc } = statusObject;

    document.title = title ? `${title} — ${this.#titleSuffix}` : this.#titleSuffix;

    this.#nameElement.title = infoLeft;
    this.#nameElement.textContent = infoLeft;
    this.#nameElement.oncontextmenu = infoLeftFunc;
    this.#infoElement.textContent = infoRight;
  }
}
