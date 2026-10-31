import { FRAME } from "../tabs/tab.js";


/**
 * Call active frame media control.
 * @param {MediaSessionAction} action Media control action.
 */
function frameMediaControl(action) {
  if (FRAME != null)
    FRAME.mediaControl(action);
}


/**
 * Initialize custom actions for `mediaSession` handlers.
 */
function initMediaController() {
  const mediaSession = navigator.mediaSession;

  /** @type {MediaSessionAction[]} */
  const mediaActions = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack'];

  for (const action of mediaActions)
    mediaSession.setActionHandler( action, () => frameMediaControl(action) );
}


initMediaController();
