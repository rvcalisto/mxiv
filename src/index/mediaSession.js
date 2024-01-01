import { Viewer } from "../components/viewer/viewer.js"
import { FRAME } from "../tabs/tab.js"


/**
 * Return either current frame is a Viewer whose content is a video.
 * @returns {boolean}
 */
function viewerVideo() {
  return FRAME instanceof Viewer && FRAME.viewComponent.fileType == 'video'
}

/**
 * Toggles media play state for Viewer video.
 * @param {boolean} play Force state. Toogles
 */
function playPause(play) {
  if ( !viewerVideo() ) return
  FRAME.viewComponent.media.playToggle(play)
}

/**
 * Skip to next media in Viewer playlist.
 * @param {boolean} forward Force direction if specified.
 */
function skip(forward = true) {
  // if ( !viewerVideo() ) return
  FRAME.flipPage(forward)
}

/**
 * Initialize custom actions for `mediaSession` handlers.
 */
function init() {
  const mediaSession = navigator.mediaSession

  mediaSession.setActionHandler("nexttrack", () => skip() )
  mediaSession.setActionHandler("previoustrack", () => skip(false) )
  mediaSession.setActionHandler("play", () => playPause() )
  mediaSession.setActionHandler("pause", () => playPause() )
  mediaSession.setActionHandler("stop", () => playPause(false) )
}


init()