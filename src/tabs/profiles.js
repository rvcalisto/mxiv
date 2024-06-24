import { AppNotifier } from "../components/notifier.js"
import { GenericFrame } from "../frames/genericFrame.js"
import { Tab } from "./tab.js"


/**
 * @typedef TabProfileType
 * @property {string} type Tab frame type.
 * @property {object} state Tab frame state.
 */

/**
 * @typedef SessionProfileType
 * @property {TabProfileType[]} tabs Tabs in session.
 */

/**
 * @typedef {Object<string, SessionProfileType>} ProfileStorageType
 */


/**
 * Load and store tab session profiles in localStorage.
 */
const ProfileStorage = new class {

  /**
   * Storage key.
   */
  #storageEntry = 'profiles';
  
  /**
   * Get stored profile object from localStorage.
   * @returns {ProfileStorageType}
   */
  getObject() {
    const profileStorageJSON = localStorage.getItem(this.#storageEntry);
    return profileStorageJSON ? JSON.parse(profileStorageJSON) : {};
  }
  
  /**
   * Store given profile object into localStorage.
   * @param {ProfileStorageType} profileStorageObject
   */
  setObject(profileStorageObject) {
    localStorage.setItem( this.#storageEntry, JSON.stringify(profileStorageObject) );
  }
}


/**
 * Manage tab session profiles.
 */
export const SessionProfiles = new class {

  #collator = new Intl.Collator();

  /**
   * Store current tab session.
   * @param {String} name Profile name.
   */
  store(name) {
    /** @type {SessionProfileType} */
    const sessionProfile = {
      tabs: []
    }
  
    // store tab data in order of presentation, if allowed and implemented
    for (const tab of Tab.allTabs) {
      const type = tab.frame.type;
      const allowProfiling = GenericFrame.getClass(type).allowProfiling;
      
      const state = allowProfiling ? tab.frame.getState() : null;
      if (!state) continue;
  
      sessionProfile.tabs.push({
        type: type,
        state: state
      });
    }
  
    // update or insert sessionProfile entry
    let profiles = ProfileStorage.getObject();
    profiles[name] = sessionProfile;
    ProfileStorage.setObject(profiles);
  
    AppNotifier.notify(`stored ${name} profile`);
  }
  
  
  /**
   * Load tab session from profile. Clears current tab session by default.
   * @param {String} name Profile name.
   * @param {boolean} [clearSession=true] Clear current tab session before loading profile.
   */
  load(name, clearSession = true) {
    const profiles = ProfileStorage.getObject();
  
    if (!profiles[name]) {
      AppNotifier.notify(`profile ${name} does not exist`);
      return;
    }
  
    if (clearSession)
      Tab.allTabs.forEach( tab => tab.close(false) );
  
    // re-create session
    for (const tabStateObj of profiles[name].tabs) {
      const { type, state } = tabStateObj;
  
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
    const profiles = ProfileStorage.getObject();
  
    if (!profiles[name]) {
      AppNotifier.notify(`profile ${name} does not exist`);
      return;
    }
  
    delete profiles[name];
    ProfileStorage.setObject(profiles);
    AppNotifier.notify(`erased ${name} profile`);
  }
  
  
  /**
   * Return sorted array of profile entries.
   * @returns {String[]}
   */
  list() {
    let profiles = Object.keys( ProfileStorage.getObject() );
    return profiles.sort( (a, b) => this.#collator.compare(a, b) );
  }
}
