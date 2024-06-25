const utils = require('./mainUtils');
const { libraryStorage } = require('./libraryStorage');
const { createThumbnailMultiThreaded } = require('./thumbnailWorker');


/**
 * Library mutual exclusivity lock object.
 */
const mutexLock = {
  locked: false,
  owner: null
}

/**
 * Request library mutex.
 * @param {Number} senderID Sender number ID.
 * @returns {Boolean}
 */
function requestLock(senderID) {
  if (mutexLock.locked) return false
  mutexLock.locked = true
  mutexLock.owner = senderID
  return true
}

/**
 * Release library mutex.
 * @param {Number} senderID Sender number ID.
 * @returns {Boolean}
 */
function releaseLock(senderID) {
  if (mutexLock.locked && mutexLock.owner === senderID) {
    mutexLock.locked = false
    mutexLock.owner = null
    return true
  }
  return false
}

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
  await libraryStorage.getPersistence().catch( () => {} ) 
  
  // map folder and filter-out ineligible paths
  const collection = libraryStorage.storageObject
  const candidates = await utils.getCandidates(folderPath, 
    recursively ? Infinity : 1)

  // filter out already cataloged paths
  const newCandidates = candidates.filter(path => collection[path] == null )
  let entriesAddded = 0
  
  await createThumbnailMultiThreaded(newCandidates, (value) => {
    libraryStorage.addEntry(value.path, value.thumbnail)
  
    senderWin.send('library:new', {
      total: newCandidates.length,
      current: ++entriesAddded,
      newPath: value.path
    })
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
  return await libraryStorage.getEntries()
}

/**
 * Remove a library entry and delete cover thumbnail from cache.
 * @param {String} path Library object key. Path to stored book.
 * @returns {Promise<Boolean>} Success.
 */
async function removeFromLibrary(path) {
  const collection = libraryStorage.storageObject
  const entry = collection[path]

  if (!entry) {
    console.warn(`MXIV::WARN: Can't delete entry. "${path}" is not in library.`)
    return true
  }

  const success = await utils.deleteThumbnail(entry.coverPath)
  if (!success)
    console.warn(`MXIV::WARN: Failed to delete thumbnail at "${entry.coverPath}". Orphaning.`)

  delete collection[path]
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
    libraryStorage.storageObject = {}
    await libraryStorage.persist()
  }

  return success
}


// TODO: procedure to clean orphaned entries on sync (end of addToLibrary)


module.exports = { getLibraryEntries, addToLibrary, removeFromLibrary, clearLibrary, requestLock, releaseLock }