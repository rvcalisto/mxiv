import * as utils from './mainUtils.js';
import { libraryStorage } from './libraryStorage.js';
import { createThumbnailMultiThreaded } from './thumbnailWorker.js';


/**
 * @typedef LibraryProgress
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
export async function addToLibrary(senderWin, folderPath, recursively = true) {

  // check cover directory, try creating if not found
  if ( !await utils.createThumbnailDirectory() ) {
    console.error('MXIV::ERROR: Couldn\'t create thumbnail directory')
    return 0
  }
  
  // map folder and filter-out ineligible paths
  const depth = recursively ? Infinity : 1;
  const candidates = await utils.getCandidates(folderPath, depth);
  let entriesAdded = 0;
  
  await libraryStorage.write(async db => {
    // filter out already cataloged paths
    const newCandidates = candidates.filter( path => !db.has(path) );

    await createThumbnailMultiThreaded(newCandidates, (value) => {
      db.setFromCover(value.path, value.thumbnail);
    
      /** @type {LibraryProgress} */
      const progress = {
        total: newCandidates.length,
        current: ++entriesAdded,
        newPath: value.path
      };
  
      senderWin.send('library:new', progress);
    }, 2);

    if (entriesAdded < 1)
      throw 'rollback';
  });

  return entriesAdded;
}

/**
 * Return sorted Library entries for displaying.
 * @returns {Promise<import("./libraryStorage").LibraryEntry[]>}
 */
export async function getLibraryEntries() {
  return await libraryStorage.getStateFromCache()
    .then(state => state.sortedValues() );
}

/**
 * Remove a library entry and delete cover thumbnail from cache.
 * @param {String} path Library object key. Path to stored book.
 * @returns {Promise<boolean>} Success.
 */
export async function removeFromLibrary(path) {
  await libraryStorage.write(async db => {
    const entry = db.get(path);
    
    if (!entry) {
      console.warn(`MXIV::WARN: Can't delete entry. "${path}" is not in library.`);
      throw 'rollback';
    }
  
    const success = await utils.deleteThumbnail(entry.coverPath);
    if (!success)
      console.warn(`MXIV::WARN: Failed to delete thumbnail at "${entry.coverPath}". Orphaning.`);
  
    db.delete(path);
  })

  return true;
}

/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<boolean>} Success.
 */
export async function clearLibrary() {
  const success = await utils.deleteThumbnailDirectory()
  if (success)
    libraryStorage.write(state => state.clear() )

  return success
}


// TODO: procedure to clean orphaned entries on sync (end of addToLibrary)
