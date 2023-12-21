import { AcceleratorDB } from "../../app/acceleratorDB.js";
import { FRAME } from "../../app/tabs.js";


/**
 * [Workaround] Manage Viewer FileBrowser KeyboardEvents locally.
 */
addEventListener('fileExplorerKeyEvent', function handleFileExplorer(e) {
  const keyEvent = e.detail;

  const fileExpAccel = AcceleratorDB.getAccel('fileExplorer', 'default');
  const action = fileExpAccel.byEvent(keyEvent);

  // no match, bubble up
  if (!action) return onkeydown(keyEvent);

  keyEvent.preventDefault();
  const [cmd, ...args] = action;

  FRAME.fileExplorer[cmd](...args);
});


/**
 * [Workaround] Release slide interval for Viewer's View component.
 */
addEventListener('keyup', function releaseViewSlide(e) {
  if (!FRAME || FRAME.constructor.name !== 'Viewer') return;

  const viewerAccelSet = AcceleratorDB.getAccel('viewer');
  const action = viewerAccelSet.byEvent(e);
  if (!action) return;

  // else, run action
  e.preventDefault();
  const cmd = action[0];
  if (cmd !== 'navigate') return;

  const axis = action[1];
  if (['left', 'right'].includes(axis)) FRAME.viewComponent.navigate('x', 0);
  else if (['up', 'down'].includes(axis)) FRAME.viewComponent.navigate('y', 0);
});
