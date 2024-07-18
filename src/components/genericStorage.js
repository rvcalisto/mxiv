/**
 * @template T
 * Simple localStorage wrapper. 
 */
export class GenericStorage {

  /**
   * @type {string}
   */
  #storageKey;

  /**
   * Initialize the given storage.
   * @param {string} storageKey
   */
  constructor(storageKey) {
    this.#storageKey = storageKey;
  }

  /**
   * Get storage object from localStorage.
   * @returns {Object<string, T>}
   */
  #getStorage() {
    const json = localStorage.getItem(this.#storageKey);
    return json ? JSON.parse(json) : {};
  }

  /**
   * Set storage object to localStorage.
   * @param {Object<string, T>} storageObject
   */
  #setStorage(storageObject) {
    localStorage.setItem( this.#storageKey, JSON.stringify(storageObject) );
  }

  /**
   * Insert or update storage entry.
   * @param {string} key
   * @param {T} object
   */
  set(key, object) {
    const storage = this.#getStorage();
    storage[key] = object;
    this.#setStorage(storage);
  }

  /**
   * Get entry from storage.
   * @param {string} key
   * @returns {T|undefined}
   */
  get(key) {
    const storage = this.#getStorage();
    return storage[key];
  }

  /**
   * Delete entry from storage.
   * @param {string} key
   */
  delete(key) {
    const storage = this.#getStorage();
    delete storage[key];
    this.#setStorage(storage);
  }

  /**
   * Return storage keys.
   * @returns {string[]}
   */
  keys() {
    return Object.keys( this.#getStorage() );
  }

  /**
   * Return storage keys.
   * @returns {T[]}
   */
  values() {
    return Object.values( this.#getStorage() );
  }

  /**
   * Return storage entries.
   * @returns {[string, T][]}
   */
  entries() {
    return Object.entries( this.#getStorage() );
  }
}