import { GenericStorage } from "../components/genericStorage.js";
import { appNotifier } from "../components/notifier.js"
import { frameRegistry } from "../frames/frameRegistry.js";
import { Tab } from "./tab.js"


/**
 * @typedef TabProfileType
 * @property {string} type Tab frame type.
 * @property {object} state Tab frame state.
 */

/**
 * @typedef SessionProfileType
 * @property {TabProfileType[]} tabs Tabs in session.
 * @property {GeneralState} general General session state.
 */


/**
 * Profile session general state.
 * @typedef {generalState} GeneralState
 */
export let generalState = {
  librarySelection: ''
}


/**
 * Manage tab session profiles.
 */
export const sessionProfiles = new class {

  #collator = new Intl.Collator();

  /**
   * @type {GenericStorage<SessionProfileType>}
   */
  #storage = new GenericStorage('profiles');

  /**
   * Store current tab session.
   * @param {String} name Profile name.
   */
  store(name) {
    /** @type {SessionProfileType} */
    const session = {
      tabs: [],
      general: generalState
    }
  
    // store tab data in order of presentation, if allowed and implemented
    for (const tab of Tab.allTabs) {
      const type = tab.frame.type;
      const allowProfiling = frameRegistry.getPolicy(type)?.allowProfiling;
      
      if (!allowProfiling) continue;

      session.tabs.push({
        type: type,
        state: tab.frame.getState() || null
      });
    }
  
    // update or insert session entry
    this.#storage.set(name, session);
  
    appNotifier.notify(`stored ${name} profile`);
  }
  
  /**
   * Load tab session from profile. Clears current tab session by default.
   * @param {String} name Profile name.
   * @param {boolean} [clearSession=true] Clear current tab session before loading profile.
   */
  load(name, clearSession = true) {
    const session = this.#storage.get(name);
  
    if (!session) {
      appNotifier.notify(`profile ${name} does not exist`);
      return;
    }
  
    if (clearSession) {
      Tab.allTabs.forEach( tab => tab.close(false) );
      Object.assign(generalState, session.general);
    }
  
    // recover state and re-create session
    for (const tabStateObj of session.tabs) {
      const { type, state } = tabStateObj;

      // enforce single instance
      const policy = frameRegistry.getPolicy(type);
      if (!policy?.allowDuplicate) {
        const hasDuplicate = Tab.allTabs.some(tab => tab.frame.type === type);
        if (hasDuplicate) continue;
      }
  
      new Tab(type, async (frame) => {
        frame.restoreState(state);
      });
    }
  }
  
  /**
   * Erase a tab session.
   * @param {String} name Profile name.
   */
  erase(name) {
    const session = this.#storage.get(name);
  
    if (!session) {
      appNotifier.notify(`profile ${name} does not exist`);
      return;
    }
  
    this.#storage.delete(name);
    appNotifier.notify(`erased ${name} profile`);
  }
  
  /**
   * Return sorted array of profile entries.
   * @returns {String[]}
   */
  list() {
    return this.#storage.keys()
      .sort( (a, b) => this.#collator.compare(a, b) );
  }
}
