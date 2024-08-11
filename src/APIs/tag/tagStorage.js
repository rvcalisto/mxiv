const { JsonStorage } = require("../tool/jsonStorage");
const { tagDBFile } = require("../tool/appPaths");
const fs = require('fs');


/**
 * Persistent tag storage.
 * @extends {JsonStorage<string[]>}
 */
class TagStorage extends JsonStorage {

  /**
   * Initialized persistent JSON filepath.
   */
  #storageFile = ''

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
  constructor(storageFile = tagDBFile) {
    super(storageFile)
    this.getPersistence()
      .catch( err => console.log('MXIV: TagStorage not found or initialized.') )

    this.#storageFile = storageFile
  }

  /**
   * Insert or update tags. Delete entry if tags are empty. Changes must be persisted.
   * @param {String} filePath Absolute path to file.
   * @param {String[]} tags File tags.
   */
  set(filePath, tags) {
    if (tags.length > 0) super.set(filePath, tags)
    else super.delete(filePath)
  }

  /**
   * Return tags for entry. Empty if not found.
   * @param {String} filePath Absolute path to file.
   * @returns {String[]}
   */
  get(filePath) {
    return super.get(filePath) || []
  }

  /**
   * Return unique tags.
   * @returns {string[]}
   */
  uniqueTags() {
    if (this.#uniqueTagsDirty) {
      console.time('computeUniqueTags')
      this.#uniqueTagsCache = [ ...new Set( this.values().flat() ) ]
      this.#uniqueTagsDirty = false
      console.timeEnd('computeUniqueTags')
    }

    return this.#uniqueTagsCache
  }

  /**
   * @inheritdoc
   */
  async getPersistence() {
    return await super.getPersistence()
      .then( () => { this.#uniqueTagsDirty = true } )
  }
  
  /**
   * @inheritdoc
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
      storageFile: this.#storageFile,
      entryCount: this.keys().length,
      tagCount: this.uniqueTags().length
    }
  }

  /**
   * List database entries whose files are no longer accessible. Optionally clear orphans.
   * * Changes are persisted.
   * @param {boolean} [deleteOrphans=false] Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], /** @type {string[]} */ orphans = []

    for ( const keyPath of this.keys() ) {
      taskPromises.push( new Promise(resolve => {
        fs.access(keyPath, err => {
          if (err) orphans.push(keyPath)
          resolve(true)
        })
      }))
    }

    await Promise.all(taskPromises)
    
    if (orphans.length < 1) {
      console.log('\nNo orphan entries to clean.') 
    } else {
      console.log(`${orphans.length} orphan entries found:`, orphans)
      if (!deleteOrphans) return

      for (const key of orphans) this.delete(key)
      await this.persist()
      console.log('Cleaned', orphans.length, 'orphan entries.')
    }
  }
}


module.exports = { TagStorage }
