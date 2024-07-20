const utils = require('./mainUtils');
const { libraryStorage } = require('./libraryStorage');
const { createThumbnailMultiThreaded } = require('./thumbnailWorker');


/**
 * @typedef LibraryProgressNotification
 * @property {number} total Items to process.
 * @property {number} current Current item count.
 * @property {string} newPath Latest path added.
 */


/**
 * Store archive or folder recursively.
 * @param {Electron.WebContents} senderWin Electron sender window.
 * @param {String} folderPath Folder/archive path to add.
 * @param {true} recursively Either to evaluate subfolders recursively.
 * @returns {Promise<Number>} New paths added.
 */
async function addToLibrary(senderWin, folderPath, recursively = true) {

  // check cover directory, try creating if not found
  if ( !await utils.createThumbnailDirectory() ) {
    console.error('MXIV::ERROR: Couldn\'t create thumbnail directory')
    return 0
  }

  // sync storage, ignore if uninitialized
  await libraryStorage.getPersistence()
    .catch( () => console.log('MXIV: LibraryStorage not found or initialized.') )
  
  // map folder and filter-out ineligible paths
  const candidates = await utils.getCandidates(folderPath, 
    recursively ? Infinity : 1)

  // filter out already cataloged paths
  const newCandidates = candidates.filter(path => libraryStorage.get(path) == null )
  let entriesAddded = 0
  
  await createThumbnailMultiThreaded(newCandidates, (value) => {
    libraryStorage.setFromCover(value.path, value.thumbnail)
  
    /** @type {LibraryProgressNotification} */
    const notification = {
      total: newCandidates.length,
      current: ++entriesAddded,
      newPath: value.path
    }

    senderWin.send('library:new', notification)
  }, 2)

  // store new library object
  if (entriesAddded) await libraryStorage.persist()
  return entriesAddded
}

/**
 * Return sorted Library entries for displaying.
 * @returns {Promise<import("./libraryStorage").LibraryEntry[]>}
 */
async function getLibraryEntries() {
  await libraryStorage.getPersistence()
    .catch( () => console.log('MXIV: LibraryStorage not found or initialized.') )

  return libraryStorage.values()
}

/**
 * Remove a library entry and delete cover thumbnail from cache.
 * @param {String} path Library object key. Path to stored book.
 * @returns {Promise<Boolean>} Success.
 */
async function removeFromLibrary(path) {
  const entry = libraryStorage.get(path)

  if (!entry) {
    console.warn(`MXIV::WARN: Can't delete entry. "${path}" is not in library.`)
    return true
  }

  const success = await utils.deleteThumbnail(entry.coverPath)
  if (!success)
    console.warn(`MXIV::WARN: Failed to delete thumbnail at "${entry.coverPath}". Orphaning.`)

  libraryStorage.delete(path)
  await libraryStorage.persist()

  return true
}

/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<Boolean>} Success.
 */
async function clearLibrary() {
  const success = await utils.deleteThumbnailDirectory()
  if (success) {
    libraryStorage.clear()
    await libraryStorage.persist()
  }

  return success
}


// TODO: procedure to clean orphaned entries on sync (end of addToLibrary)


module.exports = { getLibraryEntries, addToLibrary, removeFromLibrary, clearLibrary }