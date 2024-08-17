// @ts-check
const p = require('path');
const { pathToFileURL } = require('url');
const { JsonStorage } = require('../tool/jsonStorage');
const { libraryFile } = require('../tool/appPaths');


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {String} name File/folder basename.
 * @property {String} path Absolute path to book file/folder.
 * @property {String} coverPath Absolute path to cover file.
 * @property {String} coverURL Encoded cover path for html display.
 */


/**
 * LibraryStorage state wrapper.
 * @extends {Map<string, LibraryEntry>} 
 */
class LibraryState extends Map {

  static #collator = new Intl.Collator('en', { numeric: true })

  /**
   * Add library entry by cover path.
   * @param {String} path Folder/archive path.
   * @param {String} coverPath Cover thumbnail path.
   */
  setFromCover(path, coverPath) {
    this.set(path, {
      'name': p.basename(path),
      'path': path,
      'coverPath': coverPath,
      'coverURL': pathToFileURL(coverPath).href,
    });
  }

  /**
   * Return sorted library items.
   * @returns {LibraryEntry[]}
   */
  sortedValues() {
    return [...super.values()]
      .sort( (a, b) => LibraryState.#collator.compare(a.path, b.path) );
  }
}

/**
 * @extends {JsonStorage<LibraryEntry, LibraryState>}
 */
class LibraryStorage extends JsonStorage {
  
  /**
   * @type {{state: LibraryState?, lastModified: number}}
   */
  #cache = {
    state: null,
    lastModified: 0
  }

  constructor() {
    super(libraryFile, LibraryState);
  }

  /**
   * Build and returns state cache. Rebuilds automatically on modified-time mismatch.
   * - Avoids creating new state snapshots for recurrent read operations.
   * @returns {Promise<LibraryState>}
   */
  async getStateFromCache() {
    const lastModified = await this.getLastModified();

    if (!this.#cache.state || this.#cache.lastModified !== lastModified) {
      this.#cache.state = await this.getState(true);
      this.#cache.lastModified = lastModified || Date.now();
    }

    return this.#cache.state;
  }
}


/**
 * Persistent library storage.
 * @type {LibraryStorage}
 */
const libraryStorage = new LibraryStorage();


module.exports = { libraryStorage, LibraryState };
