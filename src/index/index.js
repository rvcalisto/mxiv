import { Tab, FRAME } from "../tabs/tab.js";
import "./mediaSession.js";
import { setAppTheme } from "./baseActions.js";
import "./baseAccelerators.js";
import "./keyEventController.js";
import { UserAccelerators } from "../actions/userAccelerators.js";
import { UserPreferences } from "../components/userPreferences.js";


/**
 * Open paths passed as arguments.
 */
elecAPI.onOpen(function openInViewer(_e, details) {
  const { paths, newTab } = details;

  if (newTab)
    new Tab( 'viewer', (viewer) => viewer.open(...paths) );
  else
    FRAME.open(...paths);
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
onload = function StartApp() {
  setAppTheme(UserPreferences.preferredTheme, false);
  UserAccelerators.reload();
  Tab.newTab();
};
