const p = require('path');
const { pathToFileURL } = require('url');
const { ipcRenderer } = require('electron');

const collator = new Intl.Collator('en', { numeric: true })


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {String} name File/folder basename.
 * @property {String} path Absolute path to book file/folder.
 * @property {String} coverPath Absolute path to cover file.
 * @property {String} coverURL Encoded cover path for html display.
 */

/**
 * Manage Library localStorage collection.
 */
// TODO: migrate to main process using JsonStorage (?)
const libraryDB = new class LibraryCollection {

  /**
   * LocalStorage key to persist LibraryEntry collection.
   */
  #libraryStorage = 'libraryPaths'

  /**
   * Return Library entry object for folder/archive.
   * @param {String} path Folder/archive path.
   * @param {String} cover Cover thumbnail path.
   */
  entry(path, cover) {
    return {
      'name' : p.basename(path),
      'path' : path,
      'coverPath' : cover,
      'coverURL' : pathToFileURL(cover).href,
    }
  }

  /**
   * Recover Library entry collection from localStorage.
   * @returns {Object<string, LibraryEntry>}
   */
  getCollection() {
    const collection = JSON.parse( localStorage.getItem(this.#libraryStorage) )
    return collection ? collection : {}
  }

  /**
   * Persist given Library collection in localStorage.
   * @param {Object<string, LibraryEntry>} collection 
   */
  persist(collection) {
    localStorage.setItem( this.#libraryStorage, JSON.stringify(collection) )
  }
}


/**
 * Store archive or folder recursively.
 * @param {String} folderPath Folder/archive path to add.
 * @param {true} recursively Either to evaluate subfolders recursively.
 * @returns {Promise<Number>} New paths added.
 */
async function addToLibrary(folderPath, recursively = true) {
  console.time(`addToLib ${folderPath}`)

  // check cover directory, try creating if not found
  if ( !await ipcRenderer.invoke('library:createThumbnailDirectory') ) {
    console.error('ERROR: Couldn\'t create thumbnail directory')
    return 0
  }

  // map folder and filter-out ineligible paths 
  const collection = libraryDB.getCollection()
  const candidates = await ipcRenderer.invoke('library:getCandidates', 
    folderPath, recursively ? Infinity : 1)

  // filter out already cataloged paths
  const newCandidates = candidates.filter(path => collection[path] == null )

  // store new paths and emit event for library display 
  for (let i = 0; i < newCandidates.length; i++) {
    const path = newCandidates[i]
    const thumbnail = await ipcRenderer.invoke('library:createThumbnail', path)
    collection[path] = libraryDB.entry(path, thumbnail)

    dispatchEvent( new CustomEvent('bookAdded', { detail: {
      total: newCandidates.length,
      current: i,
      newPath: path
    }}))
  }

  // store new library object
  if (newCandidates.length) libraryDB.persist(collection)
  console.timeEnd(`addToLib ${folderPath}`)
  return newCandidates.length
}

/**
 * Return sorted Library entries for displaying.
 * @returns {LibraryEntry[]}
 */
function getLibraryEntries() {
  const collection = libraryDB.getCollection()
  
  const entries = Object.values(collection)
  entries.sort( (a, b) => collator.compare(a.path, b.path) )

  return entries
}

/**
 * Remove a library entry and delete cover thumbnail from cache.
 * @param {String} path Library object key. Path to stored book.
 * @returns {Promise<Boolean>} Success.
 */
async function removeFromLibrary(path) {
  const collection = libraryDB.getCollection()
  const entry = collection[path]

  if (!entry) {
    console.warn(`WARN: Can't delete entry. Key ${path} is not in library.`)
    return false
  }

  const success = await ipcRenderer.invoke('library:deleteThumbnail', entry.coverPath)
  if (!success)
    console.warn(`WARN: Failed to delete thumbnail at ${entry.coverPath}. Orphaning.`)

  delete collection[path]
  libraryDB.persist(collection)

  return true
}

/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<Boolean>} Success.
 */
async function clearLibrary() {
  const success = await ipcRenderer.invoke('library:deleteThumbnailDirectory')
  if (success) libraryDB.persist({})

  return success
}


// TODO: procedure to clean orphaned entries on sync (end of addToLibrary)


module.exports = { getLibraryEntries, addToLibrary, removeFromLibrary, clearLibrary }