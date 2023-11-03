import { Tab, FRAME } from "../app/tabs.js"
import "./keyHandler.js"
import { loadUserHotkeys } from "../app/userHotkeys.js"


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

  // custom media controls for current viewer
  const mediaSession = navigator.mediaSession
  mediaSession.setActionHandler("nexttrack", () => FRAME.flipPage())
  mediaSession.setActionHandler("previoustrack", () => FRAME.flipPage(false))
  mediaSession.setActionHandler("play", () => FRAME.viewComponent.playToggle())
  mediaSession.setActionHandler("pause", () => FRAME.viewComponent.playToggle())
  mediaSession.setActionHandler("stop", () => FRAME.viewComponent.playToggle())
}