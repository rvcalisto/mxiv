// @ts-check
import { GenericStorage } from "../components/genericStorage.js";
import { appNotifier } from "../components/notifier.js";
import * as frameRegistry from "../frames/frameRegistry.js";
import { Tab } from "./tab.js";


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
  for (const tab of Tab.allTabs) {
    const type = tab.frame.type;

    if ( frameRegistry.getPolicy(type).allowProfiling )
      session.tabs.push({
        type: type,
        state: tab.frame.getState() || null
      });
  }

  // update or insert session entry
  storage.set(name, session);
  appNotifier.notify(`stored ${name} profile`);
}

/**
 * Load tab session from profile. Clears current tab session by default.
 * @param {string} name Profile name.
 * @param {boolean} [clearSession=true] Clear current tab session before loading profile.
 */
export function load(name, clearSession = true) {
  const session = storage.get(name);

  if (!session) {
    appNotifier.notify(`profile ${name} does not exist`);
    return;
  }

  if (clearSession) {
    Tab.allTabs.forEach( tab => tab.close(false) );
    Object.assign(generalState, session.general);
  }

  // re-create profile session
  for (const { type, state } of session.tabs) {

    // enforce single instance policies when keeping old sessions
    if ( !frameRegistry.getPolicy(type).allowDuplicate ) {
      const hasDuplicate = Tab.allTabs.some(tab => tab.frame.type === type);
      if (hasDuplicate)
        continue;
    }

    new Tab(type, async (frame) => {
      frame.restoreState(state);
    });
  }
}

/**
 * Erase a tab session.
 * @param {string} name Profile name.
 */
export function erase(name) {
  const session = storage.get(name);

  if (!session) {
    appNotifier.notify(`profile ${name} does not exist`);
    return;
  }

  storage.delete(name);
  appNotifier.notify(`erased ${name} profile`);
}

/**
 * Return sorted array of profile entries.
 * @returns {string[]}
 */
export function list() {
  return storage.keys()
    .sort( (a, b) => collator.compare(a, b) );
}
