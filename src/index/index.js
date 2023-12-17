import { Tab, FRAME } from "../app/tabs.js"
import "./keyHandler.js"
import { loadUserHotkeys } from "../app/userHotkeys.js"
import "./mediaSession.js"

// open paths in current viewer tab on IPC signal
elecAPI.onOpen(function openInViewer(e, details) {
  const { paths, newTab } = details

  if (newTab) new Tab('viewer', (v) => v.open(...paths))
  else FRAME.open(...paths)
})

// clear tmp folders, if any, on quit/reload
onbeforeunload = function clearTempFolders () {
  Tab.closeAll(true)
}

// load user key map and create first tab
onload = function StartApp () {
  loadUserHotkeys()
  Tab.newTab()
  elecAPI.tagAPI.start()
}