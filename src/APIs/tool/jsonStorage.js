// @ts-check
const fs = require('fs');


/**
 * @template T
 * Persistent JSON storage.
 */
class JsonStorage {

  /**
   * Persistent JSON filepath.
   */
  #storageFile = ''

  /**
   * As fs.watch runs the callback twice on every single file write, 
   * track the number of calls and only process when it's even.
   */
  #watchCount = 0

  /**
   * Last storage file read modified time. Null if unsupported.
   * @type {Number?}
   */
  #lastModifiedTime

  /**
   * Storage object to persist from and to file.
   * @type {Object<string, T>}
   */
  #storageObject = {}

  /**
   * Initialize storage instance.
   * @param {string} storageFile Persistent JSON storage filepath.
   */
  constructor(storageFile) {
    this.#storageFile = storageFile
  }

  /**
   * Returns persistence file modified time. Null if disabled.
   * @returns {Promise<Number?>}
   */
  async #readModifiedTime() {
    return await new Promise(resolve => {
      fs.stat( this.#storageFile, (err, stats) => resolve(stats?.mtimeMs) )
    })
  }

  /**
   * Load storage object from JSON file and sync, if not already. Reject on error.
   * @throws {PromiseRejectionEvent} On failure.
   * @returns {Promise<void>}
   */
  async getPersistence() {
    // skip only if modified times match
    const modifiedTime = await this.#readModifiedTime()
    if (modifiedTime != null && modifiedTime === this.#lastModifiedTime) return

    return await new Promise( (resolve, reject) => {
      fs.readFile(this.#storageFile, 'utf8', async (err, data) => {
        if (err) {
          reject(err)
        } else {
          this.#lastModifiedTime = modifiedTime
          this.#storageObject = JSON.parse(data)
          resolve()
        }
      })
    })
  }

  /**
   * Persist storage to json file and sync. Reject on error.
   * @throws {PromiseRejectionEvent} On failure.
   * @returns {Promise<void>}
   */
  async persist() {
    const json = JSON.stringify(this.#storageObject)

    return await new Promise( (resolve, reject) => {
      fs.writeFile(this.#storageFile, json, 'utf8', async (err) => {
        if (err) {
          reject(err)
        } else {
          this.#lastModifiedTime = await this.#readModifiedTime()
          resolve()
        }
      })
    })
  }

  /**
   * Insert or update entry. Changes must be persisted.
   * @param {string} key Entry key.
   * @param {T} object Entry value.
   */
  set(key, object) {
    this.#storageObject[key] = object;
  }

  /**
   * Get entry.
   * @param {string} key Entry key.
   * @returns {T|undefined} Entry value.
   */
  get(key) {
    return this.#storageObject[key];
  }

  /**
   * Delete entry. Changes must be persisted.
   * @param {string} key Entry key.
   */
  delete(key) {
    delete this.#storageObject[key];
  }

  /**
   * Delete all entries. Changes must be persisted.
   */
  clear() {
    this.#storageObject = {};
  }

  /**
   * Return keys.
   * @returns {string[]}
   */
  keys() {
    return Object.keys(this.#storageObject);
  }

  /**
   * Return values.
   * @returns {T[]}
   */
  values() {
    return Object.values(this.#storageObject);
  }

  /**
   * Return entries.
   * @returns {[string, T][]}
   */
  entries() {
    return Object.entries(this.#storageObject);
  }

  /**
   * Monitor persistence file and run callback on detected changes. 
   * @param {()=>void} callback Callback function.
   */
  async monitorPersistenceFile(callback) {
    
    if (!callback)
      return

    // watch triggers twice on writting. Only process even counts
    fs.watch(this.#storageFile, async () => {
      if (++this.#watchCount % 2 === 0)
        await callback()
    })
  }
}


module.exports = { JsonStorage }