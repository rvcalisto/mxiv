import { Tab, FRAME } from "../tabs/tab.js"
import "./mediaSession.js"
import "./baseActions.js"
import "./baseAccelerators.js"
import "./keyEventController.js"
import { UserAccelerators } from "../actions/userAccelerators.js"


// open paths in current viewer tab on IPC signal
elecAPI.onOpen(function openInViewer(e, details) {
  const { paths, newTab } = details

  if (newTab) new Tab('viewer', (v) => v.open(...paths))
  else FRAME.open(...paths)
})

/**
 * "Destruct" each tab. Keep open when tabs on hold.
 * @returns {false?}
 */
onbeforeunload = function onClose() {
  Tab.allTabs.forEach( tab => tab.close(false) )
  return Tab.allTabs.length > 0 ? false : null
}

// load user key map and create first tab
onload = function StartApp () {
  UserAccelerators.reload()
  Tab.newTab()
}