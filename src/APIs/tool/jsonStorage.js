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
   * Prevents overwrites between accesses.
   * @type {Number} Storage file modified info.
   */
  #lastModifiedMS

  /**
   * Storage object to persist from and to file.
   * @type {Object<string, T>}
   */
  #storageObject = {}

  /**
   * Either already failed a sync check.
   * @type {Boolean}
   */
  #knownDirty = true

  /**
   * Initialize storage instance.
   * @param {string} storageFile Persistent JSON storage filepath.
   */
  constructor(storageFile) {
    this.#storageFile = storageFile
  }

  /**
   * Returns last time when persistence file was modified. Null on failure.
   * @returns {Promise<Number?>}
   */
  async #readLastModified() {
    return await new Promise(resolve => {
      fs.stat( this.#storageFile, (err, stats) => resolve(stats?.mtimeMs) )
    })
  }

  /**
   * Check persistence file lastModifiedTime against last sync time.
   * @returns {Promise<Boolean>}
   */
  async #isInSync() {
    if (this.#knownDirty) return false

    const currentMs = await this.#readLastModified()
    this.#knownDirty = this.#lastModifiedMS !== currentMs
    return !this.#knownDirty
  }

  /**
   * Load storage object from JSON file and sync, if not already. Reject on error.
   * @throws {PromiseRejectionEvent} On failure.
   * @returns {Promise<void>}
   */
  async getPersistence() {
    if ( await this.#isInSync() ) return

    return await new Promise( (resolve, reject) => {
      fs.readFile(this.#storageFile, 'utf8', async (err, data) => {
        if (err) {
          reject(err)
        } else {
          this.#lastModifiedMS = await this.#readLastModified() || 0
          this.#storageObject = JSON.parse(data)
          this.#knownDirty = false
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
          this.#lastModifiedMS = await this.#readLastModified() || 0
          this.#knownDirty = false
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