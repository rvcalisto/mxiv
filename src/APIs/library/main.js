// @ts-check
import * as utils from './thumbnailService.js';
import { libraryStorage } from './libraryStorage.js';
import { createThumbnailMultiThreaded } from './thumbnailWorker.js';
import { listFiles } from '../file/fileSearch.js';
import { fileType } from '../file/fileTools.js';
import { tools } from '../tool/toolCapabilities.js';


/**
 * @typedef LibraryProgress
 * @property {number} total Items to process.
 * @property {number} current Current item count.
 * @property {string} newPath Latest path added.
 */

/**
 * @typedef {import('../tool/toolCapabilities.js').ToolCapabilities} ToolCapabilities
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
  const candidates = await getCandidates(folderPath, tools, depth);
  let entriesAdded = 0;
  
  await libraryStorage.write(async db => {
    // filter out already cataloged paths
    const newCandidates = candidates.filter( path => !db.has(path) );

    await createThumbnailMultiThreaded(newCandidates, tools, (value) => {
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
  
    if (entry.coverPath != null) {
      const success = await utils.deleteThumbnail(entry.coverPath);
      if (!success)
        console.warn(`MXIV::WARN: Failed to delete thumbnail at "${entry.coverPath}". Orphaning.`);
    }
  
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

/**
 * Return library folder/archive candidates.
 * @param {String} folderPath Path to folder to be mapped recursively.
 * @param {ToolCapabilities} tools Tool capabilities.
 * @param {Number} depth How many levels to recurse. Defaults to `Infinity`.
 * @param {String[]} mappedPaths Used internally on recursive calls.
 * @returns {Promise<String[]>} Mapped paths.
 */
async function getCandidates(folderPath, tools, depth = Infinity, mappedPaths = []) {
  const ls = await listFiles(folderPath);
  
  // add archives
  if (tools.canExtract) {
    if ( fileType(folderPath) === 'archive' )
      mappedPaths.push(folderPath);
    
    for (const archive of ls.archives)
      mappedPaths.push(archive.path);
  }
  
  // path has viewable files, add absolute path
  if (ls.files.length)
    mappedPaths.push(ls.target.path);
  
  // process subfolders recursively
  if (depth-- > 0)
    for (const dir of ls.directories)
      await getCandidates(dir.path, tools, depth, mappedPaths);
  
  return mappedPaths;
}
