// @ts-check

/**
 * @typedef StatusObjectType
 * @property {string} title Title to display on application window.
 * @property {string} infoLeft Information to display on the left.
 * @property {string} infoRight Information to display on the right.
 * @property {()=>void} [infoLeftFunc] Function to run on right-click on the left.
 */


const barElement  = /** @type {HTMLDivElement}       */ (document.querySelector('footer'));
const nameElement = /** @type {HTMLParagraphElement} */ (barElement.querySelector(':first-child'));
const infoElement = /** @type {HTMLParagraphElement} */ (barElement.querySelector(':last-child'));

/**
 * Application name shown as window suffix.
 */
const titleSuffix = 'MXIV';

/**
 * Old visibility value before fullscreen.
 */
let wasVisible = statusVisibility();


/** 
 * Either status bar is visible.
 */
export function statusVisibility() {
  return !barElement.hasAttribute('hidden');
}

/**
 * Toggle status bar visibility.
 * @param {boolean} [force] Either to force on and off instead.
 */
export function toggleStatus( force = !statusVisibility() ) {
  // animation transition in css
  barElement.toggleAttribute('hidden', !force);
}

/**
 * Update status info with current tab data.
 * @param {StatusObjectType} statusObject 
 */
export function updateStatus(statusObject) {
  const { title, infoLeft, infoRight, infoLeftFunc = null } = statusObject;

  document.title = title
    ? `${title} — ${titleSuffix}`
    : titleSuffix;

  nameElement.title = infoLeft;
  nameElement.textContent = infoLeft;
  nameElement.oncontextmenu = infoLeftFunc;
  infoElement.textContent = infoRight;
}


/**
 * Toggle visibility on fullscreen.
 */
function initialize() {
  elecAPI.onFullscreen( function onFullscreenChange(/** @type boolean */ isFullscreen) {
    if (isFullscreen)
      wasVisible = statusVisibility();

    toggleStatus(isFullscreen ? false : wasVisible);
  });
}

initialize();
