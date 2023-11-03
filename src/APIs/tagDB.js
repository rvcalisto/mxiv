const fs = require('fs');


/**
 * Simple class for managing a simple JSON tag database. Implement as a Singleton.
 */
class TagDBMS {

  /** Persistent JSON filepath. */
  #storageFile = ''

  /**
   * As fs.watch runs the callback twice on every single file write, 
   * track the number of calls and only process when it's even. */
  #watchCount = 0

  /**
   * Prevents overwrites between windows.
   * @type {Number} Storage file modified info. */
  #lastModifiedMS

  /**
   * Read from and written to local JSON file. Prefer this method to 
   * ease custom behavior, such as syncing filesystem tags to the app DB 
   * through an user script, which would be harder with LocalStorage.
   * * If ever getting into noSQL territory (lol), consider using `Proxy`.
   * @type {Object<string, string[]>} ex: `absolutePath: [tag1, tag2, ...]`.
   */
  #db = {}

  /** 
   * Store computed unique tags for consecutive calls.
   * @type {String[]} */
  #uniqueTagsCache = []

  /**
   * If true, next uniqueTags access will first compute array instead 
   * of just returning the stored value in order to save performance.
   * @type {Boolean} */
  #uniqueTagsDirty = true

  /**
   * Create a new TagDB instance. Ideally should be used as a Singleton.
   * @param storageFile Persistent JSON filepath. */
  constructor(storageFile) {
    this.#storageFile = storageFile
  }


  /**
   * Returns last time when storage file was modified.
   * @returns {Promise<Number>}
   */
  async #readLastModified() {
    return await new Promise((resolve, reject) => {
      fs.stat(this.#storageFile, (err, stats) => {
        if (err || !stats) {
          console.log('Failed to probe tag DB file.')
          resolve(-1)
        }
        else resolve(stats.mtimeMs)
      })
    })
  }

  /**
   * Check last loaded modifiedMs against current storage file time.
   * @returns {Promise<Boolean>}
   */
  async #isInSync() {
    const currentMs = await this.#readLastModified()
    return this.#lastModifiedMS === currentMs
  }

  /**
   * Read DB from json file. Skip if last modified time is the same.
   * @returns {Promise<Boolean>}
   */
  async loadDB() {

    if ( await this.#isInSync() ) {
      console.log('Tag DB already in-sync.')
      return true
    }

    return await new Promise((resolve, reject) => {
      fs.readFile(this.#storageFile, 'utf8', async (err, data) => {
        console.log(`${(!err ? 'Successfuly' : 'Failed to')} read tag DB from file.`)
        if (!err) {
          this.#lastModifiedMS = await this.#readLastModified()
          this.#db = JSON.parse(data)
          this.#uniqueTagsDirty = true
        }
        resolve(!err)
      })
    })
  }

  /**
   * Write DB to json file, update last modified ms.
   * @returns {Promise<Boolean>}
   */
  async storeDB() {
    return await new Promise((resolve, reject) => {
      fs.writeFile(this.#storageFile, JSON.stringify(this.#db), 'utf8', async (err) => {
        console.log(`${(!err ? 'Successfuly written' : 'Failed to write')} tag DB file.`)
        if (!err) {
          this.#lastModifiedMS = await this.#readLastModified()
          this.#uniqueTagsDirty = true
        }
        resolve(!err)
      })
    })
  }

  /**
   * Return file tags as an array. Return empty array if undefined.
   * @param {String} filePath Absolute path to file.
   * @returns {String[]}
   */
  getTags(filePath) {
    return this.#db[filePath] || []
  }

  /**
   * Set tag array for file. Delete file entry if given an empty array.
   * @param {String} filePath Absolute path to file.
   * @param {String[]} tags File tags.
   */
  setTags(filePath, tags) {
    if (tags.length === 0) delete this.#db[filePath]
    else this.#db[filePath] = tags
  }

  /**
   * Return unique tags.
   */
  uniqueTags() {
    // dirty cache? compute and store
    if (this.#uniqueTagsDirty) {
      console.time('computeUniqueTags')
      this.#uniqueTagsCache = [ ...new Set( Object.values(this.#db).flat() ) ]
      this.#uniqueTagsDirty = false
      console.timeEnd('computeUniqueTags')
    }

    return this.#uniqueTagsCache
  }

  /**
   * Return information object about the current DB state.
   */
  info() {
    return {
      dbFile: this.#storageFile,
      entryCount: Object.keys(this.#db).length,
      tagCount: this.uniqueTags().length
    }
  }

  /**
   * Return all entry keys.
   * @returns {String[]}
   */
  getEntries() {
    return Object.keys(this.#db)
  }

  /**
   * List database entries whose files are no longer accessible.
   * @param {false} deleteOrphans Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = [], entries = this.getEntries()

    for (const keyPath of entries) {
      const task = new Promise((resolve, reject) => {
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
      for (const entry of orphans) delete this.#db[entry]
      console.log('Cleaned', orphans.length, 'orphan entries.')
      this.storeDB()
    }
  }

  /**
   * Watch storageFile for changes and reload when detected. 
   * If the file doesn't exist, try to create first.
   */
  async reloadOnFileChange() {

    fs.watch(this.#storageFile, (eventType, filename) => {
      // watch triggers twice on writting. Only process even counts
      if (++this.#watchCount % 2 != 0) return

      // give time to lastModifiedMS be updated by storeDB(), 
      // skipping re-loading for the culprit window, if any. 
      setTimeout(async () => {
        if ( await this.#isInSync() ) return
        console.log('Tag DB changed, re-loading...')
        this.loadDB()
      }, 50);
    })

    console.log('Listening for tag storage file changes.')
  }
}


module.exports = { TagDBMS }