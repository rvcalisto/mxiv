import { newTab, newFileViewer, allTabs } from "../tabs/tab.js";
import "./mediaSession.js";
import "./baseActions.js";
import "./baseAccelerators.js";
import "./keyEventController.js";
import { reloadUserAccelerators } from "../actions/userAccelerators.js";


/**
 * Open paths passed as arguments.
 */
elecAPI.onOpen(function openInViewer(/** @type {string[][]} */ tabs) {
  for (const paths of tabs)
    newTab( 'viewer', (viewer) => viewer.open(...paths) );
});

/**
 * Properly "Destruct" tabs to trigger termination callbacks.
 * Keep open if any tab is still on hold.
 */
addEventListener('beforeunload', function onClose(e) {
  allTabs().forEach( tab => tab.close(false) );
  allTabs().length > 0 && e.preventDefault();
});

/**
 * Load user accelerators and create first tab.
 */
addEventListener('load', function startApp() {
  reloadUserAccelerators();
  newFileViewer();
});
