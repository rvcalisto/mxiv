const fs = require('fs');
const p = require('path');
const { listFiles, fileObj } = require('./fileSearch')
const { expandPath, fileType } = require('./fileTools')
const { TemporaryFolders } = require('./temporaryFolders')


/**
 * Viewable file structure for path array. Used in `FileBook`.
 * @typedef {Object} BookObject
 * @property {String?} startOn Path substring from file that is supposed to be displayed at start.
 * @property {import('./fileSearch').FileObject[]} paths Listed files parent directories.
 * @property {import('./fileSearch').FileObject[]} files All viewable files for given directories.
 */


/**
 * Open and wrap folders, archives & files in a common object for unprivileged contexts.
 * @param {String[]} paths Paths from files and folders to open.
 * @param {String} ownerID Keeps track of temporary folder (archives) ownership.
 * @returns {Promise<BookObject>}
 */
async function open(paths, ownerID) {

  /** Archives openned in current call. */
  const workingArchives = []

  /** @type {BookObject} */
  const bookObj = {
    'startOn': null,
    'paths': [],
    'files': []
  }

  // knowing current files are unshifted to the openArg array, shift & startOn basename of the first 
  // tmp file (if any) to allow archive page preservation when loading profiles or duplicating tabs.
  if (paths.length > 1 && TemporaryFolders.isPathFromTmp(paths[0]) ) {
    bookObj.startOn = p.basename( /** @type {string} */ (paths.shift()) )
  }

  // append valid data to bookObj
  for (let path of paths) {
    // skip empty path, turn atomic
    if (!path) continue
    path = expandPath(path)

    // filter already processed paths
    const parentDir = p.dirname(path)
    const type = fileType(path)
    const isViewable = type !== 'archive' && type !== 'other'
    if (bookObj.paths.some(item => {
      // filter files covered by a previous listFiles scan 
      if (isViewable && (parentDir === item.path) ) return true
      // filter already scanned directory/archive
      if (item.path === path) return true
    })) continue

    // skip if file doesn't exist, else get stat and type
    const stats = await new Promise(resolve => {
      fs.stat( path, (err, stat) => resolve(stat) )
    })
    if (!stats) continue

    // Directory, build files array from path
    if ( stats.isDirectory() ) {
      const lsObj = await listFiles(path)
      if (!lsObj.files.length) continue

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Viewable file, build from parent folder and start on itself
    else if (isViewable) {
      // only set startOn file for first path
      const lsObj = await listFiles(parentDir)
      if (!bookObj.paths.length) bookObj.startOn = path

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Archive, extract (and prevent trying to extract directories with archive extentions)
    else if ( type === 'archive' && !stats.isDirectory() ) {
      const tmpDir = await TemporaryFolders.leaseArchive(path, ownerID)
      if (tmpDir) {
        workingArchives.push(path) // prevent surrendering working archive leases later
        const lsObj = await listFiles(tmpDir)
  
        bookObj.paths.push( fileObj('archive', p.basename(path), path) )
        bookObj.files = bookObj.files.concat(lsObj.files)
      }
    }
  }

  // clear orphan tmp folders on success, if any
  const success = bookObj.paths.length > 0
  if (success) TemporaryFolders.surrenderLeases(ownerID, workingArchives)

  return bookObj
}

/**
 * Remove all temporary folders associated with ownerID. For unpriviledged contexts.
 * @param {String} ownerID Tab instance to be cleaned.
 */
function clearTmp(ownerID) {
  TemporaryFolders.surrenderLeases(ownerID)
}


module.exports = { open, clearTmp }