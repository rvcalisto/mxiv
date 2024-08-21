import { GenericStorage } from "./genericStorage.js";


/**
 * Persistent user preferences, defaults.
 */
export const UserPreferences = new class {

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
}