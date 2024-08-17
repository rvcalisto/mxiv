// @ts-check
const { JsonStorage } = require("../tool/jsonStorage");
const { tagDBFile } = require("../tool/appPaths");
const fs = require('fs');


/**
 * TagStorage state wrapper.
 * @extends {Map<string, string[]>}
 */
class TagState extends Map {

  /**
   * Insert or update tags. Delete entry if tags are empty.
   * @param {String} filePath Absolute path to file.
   * @param {String[]} tags File tags.
   */
  set(filePath, tags) {
    tags.length > 0 ?
      super.set(filePath, tags) :
      this.delete(filePath);
    
    return this;
  }

  /**
   * Return tags for entry. Empty if not found.
   * @param {String} filePath Absolute path to file.
   * @returns {String[]}
   */
  get(filePath) {
    return super.get(filePath) || [];
  }
  
  /**
   * Return unique tags.
   * @returns {string[]}
   */
  uniqueTags() {
    console.time('computeUniqueTags');
    const tags = new Set( [...this.values()].flat() );
    console.timeEnd('computeUniqueTags');
    
    return [...tags];
  }
}


/**
 * Persistent tag storage.
 * @extends {JsonStorage<string[], TagState>}
 */
class TagStorage extends JsonStorage {

  /**
   * Initialized persistent JSON filepath.
   */
  #storageFile = '';

  /**
   * Use MXIV tagDB filepath by default.
   * @param {String} storageFile Custom persistence file.
   */
  constructor(storageFile = tagDBFile) {
    super(storageFile, TagState);
    this.#storageFile = storageFile;
  }

  /**
   * Return information about current tag storage state.
   */
  async info() {
    const state = await this.getState(true);

    return {
      storageFile: this.#storageFile,
      entryCount: state.size,
      tagCount: state.uniqueTags().length
    };
  }

  /**
   * List database entries whose files are no longer accessible. Optionally clear orphans.
   * * Changes are persisted.
   * @param {boolean} [deleteOrphans=false] Either to delete orphaned entries if found.
   */
  async listOrphans(deleteOrphans = false) {
    const taskPromises = [], orphans = [];
    const state = await this.getState(true);

    for ( const filepath of state.keys() ) {
      taskPromises.push( new Promise(resolve => {
        fs.access(filepath, (err) => {
          if (err) 
            orphans.push(filepath);

          resolve(true);
        });
      }));
    }

    await Promise.all(taskPromises);
    
    if (orphans.length < 1) {
      console.log('\nNo orphan entries to clean.');
    } else {
      console.log(`${orphans.length} orphan entries found:`, orphans);

      if (deleteOrphans) {
        await this.write(db => {
          for (const key of orphans)
            db.delete(key);
        });
        
        console.log('Cleaned', orphans.length, 'orphan entries.');
      }
    }
  }
}


module.exports = { TagStorage, TagState };
