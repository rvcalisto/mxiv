// @ts-check
import p from 'path';
import { pathToFileURL } from 'url';
import { JsonStorage } from '../tool/jsonStorage.js';
import { libraryFile } from '../tool/appPaths.js';


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {string} name File/folder basename.
 * @property {string} path Absolute path to book file/folder.
 * @property {string?} coverPath Absolute path to cover file.
 * @property {string?} coverURL Encoded cover path for html display.
 */


/**
 * LibraryStorage state wrapper.
 * @extends {Map<string, LibraryEntry>} 
 */
export class LibraryState extends Map {

  static #collator = new Intl.Collator('en', { numeric: true })

  /**
   * Add library entry by cover path.
   * @param {string} path Folder/archive path.
   * @param {string?} coverPath Cover thumbnail path.
   */
  setFromCover(path, coverPath) {
    this.set(path, {
      'name': p.basename(path),
      'path': path,
      'coverPath': coverPath,
      'coverURL': coverPath && pathToFileURL(coverPath).href,
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
      this.#cache.state = await this.getState();
      this.#cache.lastModified = lastModified || Date.now();
    }

    return this.#cache.state;
  }
}


/**
 * Persistent library storage.
 * @type {LibraryStorage}
 */
export const libraryStorage = new LibraryStorage();
