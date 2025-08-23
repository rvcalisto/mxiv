// @ts-check
import { stat } from 'fs';
import { basename, dirname } from 'path';
import { listFiles, fileObj } from './fileSearch.js';
import { expandPath, fileType } from './fileTools.js';
import { isPathFromTmp, leaseArchive, surrenderLeases } from './temporaryFolders.js';
import { tools } from '../tool/toolCapabilities.js';


/**
 * @import { Stats } from 'fs'
 * @import { FileObject } from './fileSearch.js'
 */

/**
 * Viewable file structure for path array. Used in `FileBook`.
 * @typedef BookObject
 * @property {string?} startOn Path substring from file that is supposed to be displayed at start.
 * @property {FileObject[]} paths Listed files parent directories.
 * @property {FileObject[]} files All viewable files for given directories.
 */


/**
 * Open and wrap folders, archives & files in a common object for unprivileged contexts.
 * @param {string[]} paths Paths from files and folders to open.
 * @param {string} ownerID Keeps track of temporary folder (archives) ownership.
 * @returns {Promise<BookObject>}
 */
export async function open(paths, ownerID) {

  /** Archives opened in current call. */
  const workingArchives = [];

  /** @type {BookObject} */
  const book = {
    'startOn': null,
    'paths': [],
    'files': []
  };

  // knowing currently displayed files have their paths unshifted into Viewer's `openArg` array,
  // preserve page idx for archives on profile load, tab duplication by shifting `paths` and
  // setting its basename to `startOn` whenever it's a temporary path.
  if (paths.length > 1 && isPathFromTmp(paths[0]) ) {
    book.startOn = basename( /** @type {string} */ (paths.shift()) );
  }

  // append valid data to book
  for (let path of paths) {
    if (path === '')
      continue;

    path = expandPath(path);
    const parentDirectory = dirname(path);
    const type = fileType(path);
    const isViewable = type !== 'archive' && type !== 'other';

    // filter-out already processed files
    const relevantPath = isViewable ? parentDirectory : path;
    if ( book.paths.some(fileObject => fileObject.path === relevantPath) )
      continue;

    // skip file if unreachable
    const stats = /** @type {Stats?} */ (await new Promise(resolve => {
      stat( path, (_err, stat) => resolve(stat) );
    }));
    if (stats == null)
      continue;

    // Directory, append files from path
    if ( stats.isDirectory() ) {
      const lsObj = await listFiles(path);

      if (lsObj.files.length > 0) {
        book.paths.push(lsObj.target);
        book.files.push(...lsObj.files);
      }
    }

    // Viewable file, append parent folder files
    else if (isViewable) {
      const lsObj = await listFiles(parentDirectory);

      if (book.paths.length < 1)
        book.startOn = path; // start on self if first file to be processed

      book.paths.push(lsObj.target);
      book.files.push(...lsObj.files);
    }

    // Archive, append extracted files from the temporary directory
    else if (type === 'archive' && tools.canExtract) {
      const tmpDir = await leaseArchive(path, ownerID);

      if (tmpDir !== '') {
        workingArchives.push(path); // preserve current archive
        const lsObj = await listFiles(tmpDir);

        book.paths.push( fileObj('archive', basename(path), path) );
        book.files.push(...lsObj.files);
      }
    }
  }

  // clear all but `workingArchives` temporary folders (if any) for ownerID on success
  if (book.paths.length > 0)
    surrenderLeases(ownerID, workingArchives);

  return book;
}

/**
 * Remove all temporary folders associated with ownerID. For unprivileged contexts.
 * @param {string} ownerID Tab instance to be cleaned.
 */
export function clearTmp(ownerID) {
  surrenderLeases(ownerID);
}
