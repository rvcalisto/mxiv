/** Display frame info on status bar and update window title */
import { Tab } from "./tab.js"

const barElement = document.getElementById('bar')
const nameElement = document.getElementById('barName')
const infoElement = document.getElementById('barInfo')
const titleSuffix = 'MXIV'

/** Either status bar is visible.
 * @type {Boolean} */
export let visibility = true


/**
 * Toggle status bar visibility.
 * @param {Boolean|undefined} force Either to force on and off instead.
 */
export function toggle(force) {
  if (force === undefined) force = !visibility
  visibility = force
  barElement.style.fontSize = force ? '' : '0px' // smooth animation
}


/**
 * Force update status info with current tab data.
 */
export function updateStatus() {
  const frameImplementsStatus = Tab.selectedTab.frame.barStatus

  // implemented object, otherwise generic information
  let frameStatusObj = frameImplementsStatus ? Tab.selectedTab.frame.barStatus() : {
    title : Tab.selectedTab.frame.constructor.name,
    infoLeft : Tab.selectedTab.frame.constructor.name,
    infoRight : '',
    infoLeftFunc : null
  }

  const { title, infoLeft, infoRight, infoLeftFunc } = frameStatusObj
  document.title = title ? `${title} — ${titleSuffix}` : titleSuffix
  nameElement.title = infoLeft
  nameElement.textContent = infoLeft
  infoElement.textContent = infoRight
  nameElement.oncontextmenu = infoLeftFunc
}
