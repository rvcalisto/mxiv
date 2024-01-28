import { FRAME } from "../tabs/tab.js"


/**
 * Initialize custom actions for `mediaSession` handlers.
 */
function initMediaController() {
  const mediaSession = navigator.mediaSession
  
  mediaSession.setActionHandler("play", () => FRAME.mediaControl('play') )
  mediaSession.setActionHandler("pause", () => FRAME.mediaControl('pause') )
  mediaSession.setActionHandler("stop", () => FRAME.mediaControl('stop') )
  mediaSession.setActionHandler("nexttrack", () => FRAME.mediaControl('next') )
  mediaSession.setActionHandler("previoustrack", () => FRAME.mediaControl('previous') )
}


initMediaController()