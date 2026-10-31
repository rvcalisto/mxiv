import { FRAME } from "../tabs/tab.js";

/**
 * @import { FrameMediaControl } from "../frames/genericFrame.js"
 */


/**
 * Call active frame media control.
 * @param {FrameMediaControl} command Media control command.
 */
function frameMediaControl(command) {
  if (FRAME != null)
    FRAME.mediaControl(command);
}


/**
 * Initialize custom actions for `mediaSession` handlers.
 */
function initMediaController() {
  const mediaSession = navigator.mediaSession;

  mediaSession.setActionHandler( "play", () => frameMediaControl('play') );
  mediaSession.setActionHandler( "pause", () => frameMediaControl('pause') );
  mediaSession.setActionHandler( "stop", () => frameMediaControl('stop') );
  mediaSession.setActionHandler( "nexttrack", () => frameMediaControl('next') );
  mediaSession.setActionHandler( "previoustrack", () => frameMediaControl('previous') );
}


initMediaController();
