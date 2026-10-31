import { GenericStorage } from "./genericStorage.js";
import { ObservableEvents } from "./observableEvents.js";


/**
 * @typedef {'dark'|'light'|'system'} ThemeOverride
 */


const storage = new GenericStorage('userPreferences');

/**
 * Observable property changes.
 * @type {ObservableEvents<keyof preferences>}
 */
export const events = new ObservableEvents();

/**
 * Runtime preferences, defaults.
 */
const preferences = {
  libraryItemsPerPage: 100,
  libraryCoverSize: 200,
  themeOverride: /** @type {ThemeOverride} */ ('system'),
  paletteHistorySize: 10
};


/**
 * Get user preference value.
 * @template {keyof preferences} T
 * @param {T} property
 * @returns {preferences[T]}
 */
export function get(property) {
  return preferences[property];
}

/**
 * Set new value for user preference property.
 * @template {keyof preferences} T
 * @param {T} property
 * @param {preferences[T]} value
 * @returns {boolean} Success.
 */
export function set(property, value) {
  if (preferences[property] == null)
    return false;

  if (property === 'themeOverride') {
    // directly stored to ease main process access
    if (value === 'system')
      localStorage.removeItem(property);
    else
      localStorage.setItem(property, /** @type {ThemeOverride} */ (value));
  } else {
    storage.set(property, value);
  }

  preferences[property] = value;
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
      Object.assign(preferences, { [key]: value });
  }
}

/**
 * Load user preferences from storage, listen for property updates.
 */
function initialize() {
  reload();

  elecAPI.onBroadcast((
    /** @type {string} */ message,
    /** @type {keyof preferences} */ property,
    /** @type {preferences[property]} */ value
  ) => {
    if (message === 'userPref:sync') {
      Object.assign(preferences, { [property]: value });
      events.fire(property, value);
    }
  });
}


initialize();


export default { get, set, events };
