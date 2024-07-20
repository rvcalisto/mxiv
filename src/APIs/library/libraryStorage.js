const p = require('path');
const { homedir } = require('os');
const { pathToFileURL } = require('url');
const { JsonStorage } = require('../tool/jsonStorage');


/**
 * Library persistent storage file.
 */
const libraryStorageFile = process.platform === 'win32' ?
  p.join(/** @type {string} */ (process.env.LOCALAPPDATA), 'mxiv', 'library.json') :
  p.join(homedir(), '.cache', 'mxiv', 'library.json');


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {String} name File/folder basename.
 * @property {String} path Absolute path to book file/folder.
 * @property {String} coverPath Absolute path to cover file.
 * @property {String} coverURL Encoded cover path for html display.
 */


/**
 * @extends {JsonStorage<LibraryEntry>}
 */
class LibraryStorage extends JsonStorage {

  #collator = new Intl.Collator('en', { numeric: true })

  constructor() {
    super(libraryStorageFile)
    this.getPersistence()
      .catch( err => console.log('MXIV: LibraryStorage not found or initialized.') )
  }

  /**
   * Insert or update LibraryEntry object from cover. Changes must be persisted.
   * @param {String} path Folder/archive path.
   * @param {String} cover Cover thumbnail path.
   */
  setFromCover(path, cover) {
    this.set(path, {
      'name': p.basename(path),
      'path': path,
      'coverPath': cover,
      'coverURL': pathToFileURL(cover).href,
    });
  }

  /**
   * Return sorted library items.
   * @returns {LibraryEntry[]}
   */
  values() {
    return super.values()
      .sort( (a, b) => this.#collator.compare(a.path, b.path) );
  }
}

/**
 * Persistent library storage.
 * @type {LibraryStorage}
 */
const libraryStorage = new LibraryStorage();


module.exports = { libraryStorage }
