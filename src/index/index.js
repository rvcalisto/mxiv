import { Tab, newFileViewer } from "../tabs/tab.js";
import "./mediaSession.js";
import "./baseActions.js";
import "./baseAccelerators.js";
import "./keyEventController.js";
import { userAccelerators } from "../actions/userAccelerators.js";


/**
 * Open paths passed as arguments.
 */
elecAPI.onOpen(function openInViewer(_e, /** @type {string[][]} */ tabs) {
  for (const paths of tabs)
    Tab.newTab( 'viewer', (viewer) => viewer.open(...paths) );
});

/**
 * Properly "Destruct" tabs to trigger termination callbacks.
 * Keep open if any tab is still on hold.
 */
onbeforeunload = function onClose() {
  Tab.allTabs.forEach( tab => tab.close(false) );
  return Tab.allTabs.length > 0 ? false : null;
};

/**
 * Load user accelerators and create first tab.
 */
onload = function startApp() {
  userAccelerators.reload();
  newFileViewer();
};
