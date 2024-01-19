// Display frame status and update window title.

/**
 * Application name.
 */
const titleSuffix = 'MXIV'

/** 
 * Either status bar is visible.
 * @type {Boolean} 
 */
export let visibility = true

/**
 * Old visibility value before fullscreen.
 */
let oldVisibility = visibility


/**
 * Toggle status bar visibility.
 * @param {Boolean|undefined} force Either to force on and off instead.
 */
export function toggle(force) {
  if (force === undefined) force = !visibility
  visibility = force

  const barElement = document.getElementById('bar')
  barElement.style.fontSize = force ? '' : '0px' // smooth animation
}

/**
 * @typedef StatusObjectType
 * @property {String} title Title to display on application window.
 * @property {String} infoLeft Information to display on the left.
 * @property {String} infoRight Information to display on the right.
 * @property {()=>} infoLeftFunc Function to run on right-click on the left.
 */

/**
 * Force update status info with current tab data.
 * @param {StatusObjectType} statusObject 
 */
export function updateStatus(statusObject) {
  const { title, infoLeft, infoRight, infoLeftFunc } = statusObject

  document.title = title ? `${title} — ${titleSuffix}` : titleSuffix

  const nameElement = document.getElementById('barName')
  nameElement.title = infoLeft
  nameElement.textContent = infoLeft

  const infoElement = document.getElementById('barInfo')
  infoElement.textContent = infoRight
  nameElement.oncontextmenu = infoLeftFunc
}


// toggle visibility on fullscreen
elecAPI.onFullscreen( function onFullscreenChange(e, isFullscreen) {
  if (isFullscreen) oldVisibility = visibility
  toggle(isFullscreen ? false : oldVisibility)
})