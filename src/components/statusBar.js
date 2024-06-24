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
   * Either status bar is visible.
   * @type {Boolean}
   */
  visibility = true;

  /**
   * Old visibility value before fullscreen.
   */
  #oldVisibility = this.visibility;

  /**
   * Application name.
   */
  #titleSuffix = 'MXIV';


  // toggle visibility on fullscreen
  static {
    elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
      if (isFullscreen) this.#oldVisibility = visibility;
      toggle(isFullscreen ? false : this.#oldVisibility);
    })
  }

  /**
   * Toggle status bar visibility.
   * @param {Boolean|undefined} force Either to force on and off instead.
   */
  toggle(force) {
    if (force === undefined) force = !visibility;
    visibility = force;

    const barElement = document.getElementById('bar');
    barElement.style.fontSize = force ? '' : '0px'; // smooth animation
  }

  /**
   * Force update status info with current tab data.
   * @param {StatusObjectType} statusObject 
   */
  updateStatus(statusObject) {
    const { title, infoLeft, infoRight, infoLeftFunc } = statusObject;

    document.title = title ? `${title} — ${this.#titleSuffix}` : this.#titleSuffix;

    const nameElement = document.getElementById('barName');
    nameElement.title = infoLeft;
    nameElement.textContent = infoLeft;

    const infoElement = document.getElementById('barInfo');
    infoElement.textContent = infoRight;
    nameElement.oncontextmenu = infoLeftFunc;
  }
}
