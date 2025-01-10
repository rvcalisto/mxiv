// @ts-check
import * as utils from './thumbnailService.js';
import { libraryStorage } from './libraryStorage.js';
import { createThumbnailMultiThreaded } from './thumbnailWorker.js';
import { listFiles } from '../file/fileSearch.js';
import { fileType } from '../file/fileTools.js';
import { tools } from '../tool/toolCapabilities.js';
import { availableParallelism } from 'os';


/**
 * @typedef {import('../tool/toolCapabilities.js').ToolCapabilities} ToolCapabilities
 */

/**
 * @typedef {import('./libraryStorage.js').LibraryEntry} LibraryEntry
 */

/**
 * @typedef LibraryUpdate
 * @property {'scan'|'thumbnail'} task Current task in process.
 * @property {number} total Items to process.
 * @property {number} current Current item count.
 * @property {string|{key: string, entry: LibraryEntry}} value Latest path added.
 */


/**
 * Store archive or folder recursively.
 * @param {Electron.WebContents} senderWin Electron sender window.
 * @param {{path: string, recursive: boolean}[]} folderItems Folder/archive path to add.
 * @returns {Promise<number>} New paths added.
 */
export async function addToLibrary(senderWin, folderItems) {
  let candidates = [];

  for (const folder of folderItems) {
    const folders = await getCandidates(folder.path, tools, folder.recursive ? Infinity : 1);
    candidates.push(...folders);
  }
  
  const addedEntries = /** @type {string[]} */ ([]);
  let total = candidates.length;
  
  await libraryStorage.write(async db => {
    candidates.forEach(path => {
      if ( db.has(path) )
        total--;
      else {
        db.setFromCover(path, null);
        addedEntries.push(path);

        senderWin.send('library:new', /** @type {LibraryUpdate} */ ({
          task: 'scan',
          total: total,
          current: addedEntries.length,
          value: path
        }));
      }
    });

    if (addedEntries.length < 1)
      throw 'rollback';
  });

  if (addedEntries.length > 0)
    updateThumbnails(senderWin, addedEntries);

  return addedEntries.length;
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
 * @param {string} path Library object key. Path to stored book.
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
 * @param {string} folderPath Path to folder to be mapped recursively.
 * @param {ToolCapabilities} tools Tool capabilities.
 * @param {number} depth How many levels to recurse. Defaults to `Infinity`.
 * @param {string[]} mappedPaths Used internally on recursive calls.
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

/**
 * Generate and update entry thumbnails in the background.
 * @param {Electron.WebContents} senderWin Electron sender window.
 * @param {string[]} paths
 */
async function updateThumbnails(senderWin, paths) {
  let generatedThumbnails = 0;
  
  // check cover directory, try creating if not found
  if ( !await utils.createThumbnailDirectory() ) {
    console.error('MXIV::ERROR: Couldn\'t create thumbnail directory');
    return;
  }

  await libraryStorage.write(async db => {
    await createThumbnailMultiThreaded(paths, tools, (value) => {
      db.setFromCover(value.path, value.thumbnail);
      
      senderWin.send('library:new', /** @type {LibraryUpdate} */ ({
        task: 'thumbnail',
        current: ++generatedThumbnails,
        total: paths.length,
        value: {
          key: value.path,
          entry: db.get(value.path)
        }
      }));
    }, Math.ceil( availableParallelism() / 2 ) ); // match cores
  });
}
