import { AcceleratorDB } from './acceleratorDB.js'
import { Accelerators } from "./accelerators.js"

const storageEntry = 'userHotkeys'


/**
 * @typedef {Object<string, import('./actionDB.js').AcceleratorSet>} UserHotkeys
 */

/**
 * Get stored userHotkeys object from localStorage.
 * @returns {UserHotkeys}
 */
function getStorageObj() {
  let userHotkeys = JSON.parse( localStorage.getItem(storageEntry) )
  return userHotkeys || {}
}

/**
 * Store userHotkeys object into localStorage.
 * @param {UserHotkeys} userHotkeys Profile object.
 */
function setStorageObj(userHotkeys) {
  localStorage.setItem( storageEntry, JSON.stringify(userHotkeys) )
}

/**
 * Get object with all registered user accelerators for given component.
 */
export function getUserKeys(component = 'base') {
  const userKeys = getStorageObj()
  const componentKeys = userKeys[component] || {}

  // translate-back spaces
  for (const key in componentKeys) {
    if ( !key.includes(' ') ) continue
    
    const keyWithSpace = key.replace(' ', 'space')
    componentKeys[keyWithSpace] = componentKeys[key]
    delete componentKeys[key]
  }

  return componentKeys
}

/**
 * Set userHotkeys for component. Store new hotkeys by default.
 * - Entries whose value's first item equals `default` are deleted.
 * - Entries whose value's first item equals `mask` are nulled.
 * @param {Object<string, string[]>} newUserKeys User defined accelerators.
 * @param {'base'} component Component to modify.
 * @param {true} store Either to store changes after apply.
 */
export function setUserKeys(newUserKeys, component = 'base', store = true) {
  const userKeys = getStorageObj()
  if (!userKeys[component]) userKeys[component] = {}
  
  // delete keys purposefully nulled before assignment & storing
  // otherwise, overwrite key value
  for (let [key, actionArr] of Object.entries(newUserKeys) ) {
    key = Accelerators.parseKeycombo(key)
    const toDelete = actionArr[0] === 'default'
    const toMask = actionArr[0] === 'mask'

    if (toDelete) delete userKeys[component][key]
    else userKeys[component][key] = toMask ? [] : actionArr
  }

  if (component === 'base')
    AcceleratorDB.setBaseCustoms(userKeys[component])
  else
    AcceleratorDB.setComponentCustoms(component, userKeys[component])

  if (store) setStorageObj(userKeys)
  updateCLIaccelCSSvar()
}

/**
 * Apply previously set user hotkeys from localStorage.
 */
export function loadUserHotkeys() {
  const userHotkeys = getStorageObj()

  // no user hotkeys to apply, generate CSS var only
  if ( Object.keys(userHotkeys).length < 1 ) return updateCLIaccelCSSvar()

  for (const component in userHotkeys) {
    const componentHotkeys = userHotkeys[component]
    
    if (!Object.keys(componentHotkeys).length) continue
    setUserKeys(componentHotkeys, component, false)
  }
}


/**
 * Set and update `--msg-cliAccel` css variable value.
 * - Used in `viewer` to conduct new users to the CLI accelerator keycombo.
 * - Elements that use css variables get updated automatically on change.
 */
function updateCLIaccelCSSvar() {
  const action = ['cli', 'show']
  
  // try keycombo for specific action, otherwise any intersection
  const baseAccelSet = AcceleratorDB.getAccel('base')
  const keycombo = baseAccelSet.byAction(action, true)[0] ||
  baseAccelSet.byAction(action)[0] || '???'

  document.documentElement.style.setProperty('--msg-cliAccel', `"${keycombo}"`)
}