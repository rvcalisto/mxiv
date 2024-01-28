const fs = require('fs');


/**
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
   */
  storageObject = {}

  /**
   * Either already failed a sync check.
   * @type {Boolean}
   */
  #knownDirty = true

  /**
   * Initialize storage instance.
   * @param storageFile Persistent JSON storage filepath.
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
  async isInSync() {
    if (this.#knownDirty) return false

    const currentMs = await this.#readLastModified()
    this.#knownDirty = this.#lastModifiedMS !== currentMs
    return !this.#knownDirty
  }

  /**
   * Load storage object from JSON file and sync, if not already.
   * @returns {Promise<Boolean>} In sync.
   */
  async getPersistence() {

    if ( await this.isInSync() ) 
      return true

    return await new Promise(resolve => {
      fs.readFile(this.#storageFile, 'utf8', async (err, data) => {
        if (!err) {
          this.#lastModifiedMS = await this.#readLastModified()
          this.storageObject = JSON.parse(data)
          this.#knownDirty = false
        } else {
          console.error(`${this.constructor.name}: Failed to get Persistence:\n`, err)
        }
        resolve(!err)
      })
    })
  }

  /**
   * Persist storageObject to json file and sync.
   * @returns {Promise<Boolean>} Success.
   */
  async persist() {
    return await new Promise(resolve => {
      fs.writeFile(this.#storageFile, JSON.stringify(this.storageObject), 'utf8', async (err) => {
        if (!err) {
          this.#lastModifiedMS = await this.#readLastModified()
          this.#knownDirty = false
        } else {
          console.error(`${this.constructor.name}: Failed to Persist:\n`, err)
        }
        resolve(!err)
      })
    })
  }

  /**
   * Monitor persistence file and run callback on detected changes. 
   * @param {()=>} callback Callback function.
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