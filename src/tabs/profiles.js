import { AppNotifier } from "../app/notifier.js"
import { GenericFrame } from "./genericFrame.js"
import { Tab } from "./tab.js"

const storageEntry = 'profiles'

/**
 * @typedef {Object<string, {tabs:{type:string, state:any}[]}>} ProfileObjType
 */

/**
 * Get stored profiles object from localStorage.
 * @returns {ProfileObjType}
 */
function getStorageObj() {
  let storedProfiles = JSON.parse( localStorage.getItem(storageEntry) )
  return storedProfiles || {}
}

/**
 * Store profiles object into localStorage.
 * @param {ProfileObjType} profilesObj Profile object.
 */
function setStorageObj(profilesObj) {
  localStorage.setItem( storageEntry, JSON.stringify(profilesObj) )
}


/**
 * Store current tab session as a profile.
 * @param {String} name Name of the new profile.
 */
export function storeProfile(name) {
  const newProfile = {
    tabs: []
  }

  // store type and state per tab, in order, if allowed and implemented
  for (const tab of Tab.allTabs) {
    const type = tab.frame.type
    const allowProfiling = GenericFrame.getClass(type).allowProfiling
    
    const state = allowProfiling ? tab.frame.getState() : null
    if (!state) continue

    newProfile.tabs.push({
      type: type,
      state: state
    })
  }

  // update or insert newProfile entry
  let profiles = getStorageObj()
  profiles[name] = newProfile
  setStorageObj(profiles)

  AppNotifier.notify(`stored ${name} profile`)
}


/**
 * Load tab session from stored profile.
 * @param {String} name Profile name.
 * @param {true} clearSession Either to clear current tab session before loading profile.
 */
export function loadProfile(name, clearSession = true) {
  const profiles = getStorageObj()

  if (!profiles[name]) {
    AppNotifier.notify(`profile ${name} does not exist`)
    return
  }

  // clear current session first?
  if (clearSession) Tab.closeAll(true)

  // re-create session
  for (const tabStateObj of profiles[name].tabs) {
    const { type, state } = tabStateObj

    new Tab(type, async (frame) => {
      frame.restoreState(state)
    })
  }
}


/**
 * Erase profile from storage.
 * @param {String} name Profile name.
 */
export function eraseProfile(name) {
  const profiles = getStorageObj()

  if (!profiles[name]) {
    AppNotifier.notify(`profile ${name} does not exist`)
    return
  }

  delete profiles[name]
  setStorageObj(profiles)
  AppNotifier.notify(`erased ${name} profile`)
}


/**
 * Return sorted array of profile entries.
 * @returns {String[]}
 */
export function listProfiles() {
  let profiles = Object.keys( getStorageObj() )
  
  const coll = new Intl.Collator()
  return profiles.sort( (a, b) => coll.compare(a, b) )
}


// in case restructuring profiles is needed
// const profiles = getStorageObj()
// for ( const [name, profile] of Object.entries(profiles) ) {
//   for (let i = 0; i < profile.tabs.length; i++) {
//     let tab = profile.tabs[i]
//     // do stuff
//   }
// }
// setStorageObj(profiles)