// @ts-check
import { GenericStorage } from "./genericStorage.js";


/**
 * @typedef {'dark'|'light'|'system'} ThemeOverride
 */


/**
 * Persistent user preferences, defaults.
 */
export const userPreferences = new class {

  #storage = new GenericStorage('userPreferences');

  /**
   * @param {number} value
   */
  set libraryItemsPerPage(value) {
    this.#storage.set('libraryItemsPerPage', value);
  }

  /**
   * @returns {number}
   */
  get libraryItemsPerPage() {
    return this.#storage.get('libraryItemsPerPage') || 100;
  }
  
  /**
   * @param {number} value
   */
  set libraryCoverSize(value) {
    this.#storage.set('libraryCoverSize', value);
  }
  
  /**
   * @returns {number}
   */
  get libraryCoverSize() {
    return this.#storage.get('libraryCoverSize') || 200;
  }
  
  /**
   * @param {ThemeOverride} value
   */
  set themeOverride(value) {
    // directly stored to ease main process access
    if (value === 'system')
      localStorage.removeItem('themeOverride');
    else
      localStorage.setItem('themeOverride', value);
  }
  
  /**
   * @returns {ThemeOverride} value
   */
  get themeOverride() {
    // directly stored to ease main process access
    return /** @type {ThemeOverride?} */ (localStorage.getItem('themeOverride')) || 'system';
  }
}
