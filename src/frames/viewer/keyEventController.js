import { AcceleratorDB } from "../../actions/acceleratorDB.js";
import { FRAME } from "../../tabs/tab.js";


/**
 * [Workaround] Manage Viewer FileBrowser KeyboardEvents locally.
 */
addEventListener('fileExplorerKeyEvent', function handleFileExplorer(e) {
  const keyEvent = e.detail;

  const action = AcceleratorDB.getAccel('fileExplorer', 'default')
    .byEvent(keyEvent);

  // bubble-up on null, call function directly on match
  if (action == null)
    return onkeydown(keyEvent);

  keyEvent.preventDefault();
  const [cmd, ...args] = action;
  FRAME.fileExplorer[cmd](...args);
});


/**
 * [Workaround] Release slide interval for Viewer's View component.
 */
addEventListener('keyup', function releaseViewSlide(e) {
  if (FRAME == null || FRAME.type !== 'viewer') return;

  const action = AcceleratorDB.getAccel('viewer').byEvent(e);
  if (action != null && action[0] === 'navigate') {
    e.preventDefault();

    const axis = action[1];
    if (['left', 'right'].includes(axis)) FRAME.viewComponent.navigate('x', 0);
    else if (['up', 'down'].includes(axis)) FRAME.viewComponent.navigate('y', 0);
  }
});