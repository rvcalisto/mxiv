/**
 * @typedef StatusObjectType
 * @property {String} title Title to display on application window.
 * @property {String} infoLeft Information to display on the left.
 * @property {String} infoRight Information to display on the right.
 * @property {()=>} infoLeftFunc Function to run on right-click on the left.
 */


/**
 * Display contextual information and update window title.
 */
export const StatusBar = new class {

  /**
   * Application name.
   */
  #titleSuffix = 'MXIV';

  /**
   * @type {HTMLDivElement}
   */
  #barElement = document.getElementById('bar');

  /**
   * @type {HTMLLabelElement}
   */
  #nameElement = document.getElementById('barName');

  /**
   * @type {HTMLLabelElement}
   */
  #infoElement = document.getElementById('barInfo');

  /**
   * Old visibility value before fullscreen.
   */
  #wasVisible = this.isVisible();


  // toggle visibility on fullscreen
  static {
    elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
      if (isFullscreen) StatusBar.#wasVisible = StatusBar.isVisible();
      StatusBar.toggle(isFullscreen ? false : StatusBar.#wasVisible);
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
