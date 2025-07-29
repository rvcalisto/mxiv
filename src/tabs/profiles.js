// @ts-check
import { GenericStorage } from "../components/genericStorage.js";
import { notify } from "../components/notifier.js";
import { allTabs, newTab } from "./tab.js";


/**
 * @typedef SessionProfileType
 * @property {import('./tab.js').TabProfileType[]} tabs Tabs in session.
 * @property {GeneralState} general General session state.
 */


/**
 * Profile session general state.
 * @typedef {generalState} GeneralState
 */
export let generalState = {
  librarySelection: ''
};

/**
 * Profile persistence.
 * @type {GenericStorage<SessionProfileType>}
 */
const storage = new GenericStorage('profiles');

/**
 * Sorting tool.
 */
const collator = new Intl.Collator();


/**
 * Store current tab session.
 * @param {string} name Profile name.
 */
export function store(name) {
  const session = /** @type {SessionProfileType} */ ({
    tabs: [],
    general: generalState
  });

  // store tab data in order of presentation, if allowed and implemented
  for ( const tab of allTabs() ) {
    const tabProfile = tab.getProfile();

    if (tabProfile != null)
      session.tabs.push(tabProfile);
  }

  // update or insert session entry
  storage.set(name, session);
  notify(`stored ${name} profile`, 'storePro');
}

/**
 * Load tab session from profile. Clears current tab session by default.
 * @param {string} name Profile name.
 * @param {boolean} [clearSession=true] Clear current tab session before loading profile.
 */
export function load(name, clearSession = true) {
  const session = storage.get(name);

  if (!session) {
    notify(`profile ${name} does not exist`, 'loadPro');
    return;
  }

  if (clearSession) {
    allTabs().forEach( tab => tab.close(false) );
    Object.assign(generalState, session.general);
  }

  // re-create profile session
  for (const { type, state } of session.tabs) {
    newTab(type, async (frame) => {
      frame.restoreState(state);
    }, { quiet: true });
  }
}

/**
 * Erase a tab session.
 * @param {string} name Profile name.
 */
export function erase(name) {
  const session = storage.get(name);

  if (!session) {
    notify(`profile ${name} does not exist`, 'erasePro');
    return;
  }

  storage.delete(name);
  notify(`erased ${name} profile`, 'erasePro');
}

/**
 * Return sorted array of profile entries.
 * @returns {string[]}
 */
export function list() {
  return storage.keys()
    .sort( (a, b) => collator.compare(a, b) );
}
