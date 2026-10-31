import { getAccelerators } from "../../actions/acceleratorService.js";
import { frameKeyEvHandler } from "../../index/keyEventController.js";
import { FRAME } from "../../tabs/tab.js";


/**
 * @import { Viewer } from "./viewer.js"
 * @import { FileExplorerEvent } from "./fileExplorer.js"
 */


/**
 * [Workaround] Manage Viewer FileBrowser KeyboardEvents locally.
 */
addEventListener('fileExplorerKeyEvent', function handleFileExplorer(/** @type {any} */ e) {
  const keyEvent = /** @type {FileExplorerEvent} */ (e).detail;

  const action = getAccelerators('fileExplorer', 'default')
    ?.byEvent(keyEvent);

  // bubble-up on null, call function directly on match
  if (action == null)
    return frameKeyEvHandler(keyEvent);

  keyEvent.preventDefault();
  const [cmd, ...args] = action;

  // @ts-ignore: dynamically call FileExplorer methods as properties.
  /** @type {Viewer} */ (FRAME).fileExplorer[cmd](...args);
});


/**
 * [Workaround] Release slide interval for Viewer's View component.
 */
addEventListener('keyup', function releaseViewSlide(e) {
  if (FRAME == null || FRAME.type !== 'viewer')
    return;

  const action = getAccelerators('viewer')
    ?.byEvent(e);

  if (action != null && action[0] === 'navigate') {
    e.preventDefault();

    const axis = action[1];
    if (['left', 'right'].includes(axis))
      /** @type {Viewer} */ (FRAME).viewComponent.navigate('x', 0);
    else if (['up', 'down'].includes(axis))
      /** @type {Viewer} */ (FRAME).viewComponent.navigate('y', 0);
  }
});
