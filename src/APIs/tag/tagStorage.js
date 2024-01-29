const { JsonStorage } = require("../tool/jsonStorage");
const { homedir } = require("os");
const path = require("path");
const fs = require('fs');


/**
 * Default MXIV tag storage file.
 * @type {String}
 */
const defaultStorageFile = process.platform === 'win32' ?
  path.join(process.env.LOCALAPPDATA, 'mxiv', 'tagDB.json') :
  path.join(homedir(), '.cache', 'mxiv', 'tagDB.json')


/**
 * Persistent tag storage.
 */
class TagStorage extends JsonStorage {

  /**
   * Initialized persistent JSON filepath. Read-only.
   * @readonly
   * @type {String}
   */
  storageFile

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
   * Use `user/cache/mxiv/tagDB.json` path by default.
   * @param {String} storageFile Custom persistence file.
   */
  constructor(storageFile = defaultStorageFile) {
    super(storageFile)
    this.getPersistence()
      .catch( err => console.log('MXIV: TagStorage not found or initialized.') )

    this.storageFile = storageFile
  }

  /**
   * Set tag array for file. Delete entry if tags are empty.
   * @param {String} filePath Absolute path to file.
   * @param {String[]} tags File tags.
   */
  setTags(filePath, tags) {
    if (tags.length < 1) delete this.storageObject[filePath]
    else this.storageObject[filePath] = tags
  }

  /**
   * Return file tags. Empty if entry not found.
   * @param {String} filePath Absolute path to file.
   * @returns {String[]}
   */
  getTags(filePath) {
    return this.storageObject[filePath] || []
  }

  /**
   * Return unique tags.
   */
  uniqueTags() {
    if (this.#uniqueTagsDirty) {
      console.time('computeUniqueTags')
      this.#uniqueTagsCache = [ ...new Set( Object.values(this.storageObject).flat() ) ]
      this.#uniqueTagsDirty = false
      console.timeEnd('computeUniqueTags')
    }

    return this.#uniqueTagsCache
  }

  /**
   * @override
   */
  async getPersistence() {
    return await super.getPersistence()
      .then( () => { this.#uniqueTagsDirty = true } )
  }
  
  /**
   * @override
   */
  async persist() {
    return await super.persist()
      .then( () => { this.#uniqueTagsDirty = true })
  }

  /**
   * Return information about current tag storage state.
   */
  info() {
    return {
      storageFile: this.storageFile,
      entryCount: Object.keys(this.storageObject).length,
      tagCount: this.uniqueTags().length
    }
  }

  /**
   * List database entries whose files are no longer accessible.
   * @param {false} deleteOrphans Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = []

    for (const keyPath in this.storageObject) {
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
      for (const entry of orphans) delete this.storageObject[entry]
      console.log('Cleaned', orphans.length, 'orphan entries.')
      this.persist()
    }
  }
}


module.exports = { TagStorage }