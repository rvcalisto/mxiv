const p = require('path');
const { homedir } = require('os');
const { pathToFileURL } = require('url');
const { JsonStorage } = require('../tool/jsonStorage');


/**
 * Library persistent storage file.
 */
const libraryStorageFile = process.platform === 'win32' ?
  p.join(process.env.LOCALAPPDATA, 'mxiv', 'library.json') :
  p.join(homedir(), '.cache', 'mxiv', 'library.json');


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {String} name File/folder basename.
 * @property {String} path Absolute path to book file/folder.
 * @property {String} coverPath Absolute path to cover file.
 * @property {String} coverURL Encoded cover path for html display.
 */

/**
 * Persistent Library JSON storage controller.
 */
const libraryStorage = new class extends JsonStorage {

  #collator = new Intl.Collator('en', { numeric: true })

  constructor() {
    super(libraryStorageFile)
    this.getPersistence()
      .catch( err => console.log('MXIV: LibraryStorage not found or initialized.') )
  }

  /**
   * Return Library entry object for folder/archive.
   * @param {String} path Folder/archive path.
   * @param {String} cover Cover thumbnail path.
   */
  addEntry(path, cover) {
    this.storageObject[path] = {
      'name': p.basename(path),
      'path': path,
      'coverPath': cover,
      'coverURL': pathToFileURL(cover).href,
    }
  }

  /**
   * Return sorted entry array.
   * @returns {Promise<LibraryEntry[]>}
   */
  async getEntries() {
    await this.getPersistence()
      .catch( err => console.log('MXIV: LibraryStorage not found or initialized.') )

    return Object.values(this.storageObject)
      .sort( (a, b) => this.#collator.compare(a.path, b.path) )
  }
}


module.exports = { libraryStorage }