const { JsonStorage } = require("../tool/jsonStorage");
const fs = require('fs')


/**
 * Persistent tag storage.
 */
class TagStorage {

  /**
   * Tag storage persistent JSON file.
   */
  #persistentFile

  /**
   * Inner JsonStorage instance.
   */
  #storage

  /** 
   * Store computed unique tags for consecutive calls.
   * @type {String[]}
   */
  #uniqueTagsCache = []

  /**
   * If true, next uniqueTags access will first compute array instead 
   * of just returning the stored value in order to save performance.
   * @type {Boolean}
   */
  #uniqueTagsDirty = true

  /**
   * @param {String} persistentFile JSON file to persist storage.
   */
  constructor(persistentFile) {
    this.#persistentFile = persistentFile
    this.#storage = new JsonStorage(persistentFile)
    this.#storage.getPersistence()
  }

  /**
   * Set tag array for file. Delete entry if tags are empty.
   * @param {String} filePath Absolute path to file.
   * @param {String[]} tags File tags.
   */
  setTags(filePath, tags) {
    if (tags.length < 1) delete this.#storage.storageObject[filePath]
    else this.#storage.storageObject[filePath] = tags
  }

  /**
   * Return file tags. Empty if entry not found.
   * @param {String} filePath Absolute path to file.
   * @returns {String[]}
   */
  getTags(filePath) {
    return this.#storage.storageObject[filePath] || []
  }

  /**
   * Return unique tags.
   */
  uniqueTags() {
    if (this.#uniqueTagsDirty) {
      console.time('computeUniqueTags')
      this.#uniqueTagsCache = [ ...new Set( Object.values(this.#storage.storageObject).flat() ) ]
      this.#uniqueTagsDirty = false
      console.timeEnd('computeUniqueTags')
    }

    return this.#uniqueTagsCache
  }

  /**
   * Read and sync tag from file.
   * @returns {Promise<boolean>} Success.
   */
  async loadDB() {
    const alreadySynced = await this.#storage.isInSync()
    if (alreadySynced) return true

    const success = await this.#storage.getPersistence()
    if (success) this.#uniqueTagsDirty = true
    return success
  }
  
  /**
   * Write and sync tags to file.
   * @returns {Promise<boolean>} Success.
   */
  async storeDB() {
    const success = await this.#storage.persist()
    if (success) this.#uniqueTagsDirty = true
    return success
  }

  /**
   * Return information about current tag storage state.
   */
  info() {
    return {
      persistentFile: this.#persistentFile,
      entryCount: Object.keys(this.#storage.storageObject).length,
      tagCount: this.uniqueTags().length
    }
  }

  /**
   * Return all entry keys.
   * @returns {String[]}
   */
  getEntries() {
    return Object.keys(this.#storage.storageObject)
  }

  /**
   * Monitor persistence file and run callback on detected changes.
   * @param {()=>} callback Callback function.
   */
  async monitorChanges(callback) {
    await this.#storage.monitorPersistenceFile(callback)
  }

  /**
   * List database entries whose files are no longer accessible.
   * @param {false} deleteOrphans Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = [], entries = this.getEntries()

    for (const keyPath of entries) {
      const task = new Promise(resolve => {
        fs.access(keyPath, (err) => {
          if (err) orphans.push(keyPath)
          resolve()
        })
      })
      taskPromises.push(task)
    }

    await Promise.all(taskPromises)
    
    if (!orphans.length) console.log('\nNo orphan entries to clean.') 
    else console.log(`${orphans.length} orphan entries found:`, orphans)

    if (deleteOrphans && orphans.length) {
      for (const entry of orphans) delete this.#storage.storageObject[entry]
      console.log('Cleaned', orphans.length, 'orphan entries.')
      this.storeDB()
    }
  }
}


module.exports = { TagStorage }