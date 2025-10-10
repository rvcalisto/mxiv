// @ts-check
import { GenericStorage } from "./genericStorage.js";
import { ObservableEvents } from "./observableEvents.js";


/**
 * @typedef {'dark'|'light'|'system'} ThemeOverride
 */


const storage = new GenericStorage('userPreferences');

/**
 * Observable property changes.
 * @type {ObservableEvents<keyof values>}
 */
export const events = new ObservableEvents();

/**
 * Runtime values, defaults.
 */
const values = {
  libraryItemsPerPage: 100,
  libraryCoverSize: 200,
  themeOverride: /** @type ThemeOverride */ ('system')
};


/**
 * Get user preference value.
 * @template {keyof values} T
 * @param {T} property
 * @returns {values[T]}
 */
export function get(property) {
  return values[property];
}

/**
 * Set new value for user preference property.
 * @template {keyof values} T
 * @param {T} property
 * @param {values[T]} value
 * @returns {boolean} Success.
 */
export function set(property, value) {
  if (values[property] == null)
    return false;

  if (property === 'themeOverride') {
    // directly stored to ease main process access
    if (value === 'system')
      localStorage.removeItem(property);
    else
      localStorage.setItem(property, /** @type ThemeOverride */ (value));
  } else {
    storage.set(property, value);
  }

  values[property] = value;
  events.fire(property, value);
  elecAPI.broadcast('userPref:sync', property, value);

  return true;
}

/**
 * Load user preferences from storage.
 */
function reload() {
  for ( const [key, value] of storage.entries() ) {
    if (value !== undefined)
      values[key] = value;
  }
}

/**
 * Load user preferences from storage, listen for property updates.
 */
function initialize() {
  reload();

  elecAPI.onBroadcast((_e, /** @type string */ message, property, value, ..._args) => {
    if (message === 'userPref:sync') {
      values[property] = value;
      events.fire(property, value);
    }
  });
}


initialize();

export default { get, set, events };
