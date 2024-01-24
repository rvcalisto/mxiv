/** Open files, folders and archives. Create, track and delete temporary folders. */

const fs = require('fs');
const os = require('os');
const p = require('path');
const arcAPI = require('./arcAPI')
const fileAPI = require('./fileAPI')

const TMPDIR = os.tmpdir()  // OS directory where to temporarily extract archives
const TMPPREFIX = 'mxiv-'   // prefix for temporarily extracted archive folders


/**
 * Viewable file structure for path array. Used in `FileBook`.
 * @typedef {Object} BookObject
 * @property {String?} startOn Path substring from file that is supposed to be displayed at start.
 * @property {fileAPI.FileObject[]} paths Listed files parent directories.
 * @property {fileAPI.FileObject[]} files All viewable files for given directories.
 */

/**
 * Treat and wrap folders, archives and files in a common object for unpriviledged usage.
 * @param {String[]} paths Array of files/folders paths to open.
 * @param {Number} ownerID Keeps track of temporary folder (archives) ownership.
 * @returns {Promise<BookObject>} New book object data.
 */
async function open(paths, ownerID = 0) {

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
  if (paths.length > 1 && tmpFolders.isPathFromTmp(paths[0]) ) {
    bookObj.startOn = p.basename( paths.shift() )
  }

  // append valid data to bookObj
  for (let path of paths) {
    // skip empty path, turn atomic
    if (!path) continue
    path = fileAPI.expandPath(path)

    // filter already processed paths
    const parentDir = p.dirname(path)
    const fileType = fileAPI.fileType(path)
    const isViewable = fileType !== 'archive' && fileType !== 'other'
    if (bookObj.paths.some(item => {
      // filter files covered by a previous lsAsync scan 
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
      const lsObj = await fileAPI.lsAsync(path)
      if (!lsObj.files.length) continue

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Viewable file, build from parent folder and start on itself
    else if (isViewable) {
      // only set startOn file for first path
      const lsObj = await fileAPI.lsAsync(parentDir)
      if (!bookObj.paths.length) bookObj.startOn = path

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Archive, extract (and prevent trying to extract directories with archive extentions)
    else if ( fileType === 'archive' && !stats.isDirectory() ) {
      const tmpDir = await tmpFolders.leaseArchive(path, ownerID)
      if (tmpDir) {
        workingArchives.push(path) // prevent surrendering working archive leases later
        const lsObj = await fileAPI.lsAsync(tmpDir)
  
        bookObj.paths.push( fileAPI.fileObj('archive', p.basename(path), path) )
        bookObj.files = bookObj.files.concat(lsObj.files)
      }
    }
  }

  // clear orphan tmp folders on success, if any
  const success = bookObj.paths.length
  if (success) tmpFolders.surrenderLeases(ownerID, workingArchives)

  return bookObj
}


/**
 * Manage temporary folders created to view archives.
 */
const tmpFolders = new class TemporaryFolders {

  /**
   * Track archives temporarily extracted and their consumers.
   * @type {Object<string, {path:String, owners:Set<Number>}>}
   */
  #openArchives = {}

  /**
   * Return either path is from a temporary folder file.
   * @param {String} path Path to file to verify.
   * @returns {Boolean}
   */
  isPathFromTmp(path) {
    const pathIsTmp = path.includes( p.join(TMPDIR, TMPPREFIX) )
    const pathType = fileAPI.fileType(path)

    return pathIsTmp && pathType !== 'other' && pathType !== 'archive'
  }

  /**
   * Revoke access to a leased archive. Delete orphaned lease paths.
   * @param {String} archivePath Archive to revoke access to.
   * @param {Number} ownerID Consumer UUID.
   */
  #revokeAccess(archivePath, ownerID = 0) {
    this.#openArchives[archivePath].owners.delete(ownerID)

    if (!this.#openArchives[archivePath].owners.size) {
      this.#deleteTmpFolder(this.#openArchives[archivePath].path)
      delete this.#openArchives[archivePath]
    }
  }

  /**
   * Lease temporary folder for archive files. Returns folder path or empty if invalid.
   * @param {String} archivePath Absolute path to archive.
   * @param {Number} ownerID Owner ID to register folder.
   * @returns {Promise<String>} Path to temporary folder. Empty on failure.
   */
  async leaseArchive(archivePath, ownerID = 0) {

    const registry = this.#openArchives[archivePath]
    if (registry) {
      registry.owners.add(ownerID)
      return registry.path
    }

    // filter out archives without viewable files
    const archivedFiles = await arcAPI.fileList(archivePath)
    const hasViewableFiles = archivedFiles.some(filePath => {
      const fileType = fileAPI.fileType(filePath)
      return fileType === 'image' || fileType === 'video'
    })
    if (!hasViewableFiles) return ''

    // new unique temp folder (ex: /tmp/prefix-dpC7Id)
    const tmpDir = fs.mkdtempSync( p.join(TMPDIR, TMPPREFIX) )
    await arcAPI.extract(archivePath, tmpDir)
    console.log(`Extracted archive to tmp folder ${tmpDir}`)

    this.#openArchives[archivePath] = {
      path: tmpDir,
      owners: new Set([ownerID])
    }

    return tmpDir
  }

  /**
   * Revoke all archive accesses associated with ownerID. Spare archives if given.
   * Called after successfuly generating a new book for viewing or when closing the app.
   * @param {Number} ownerID Tab instance to be cleaned.
   * @param {String[]} spareArchives Archive paths to spare.
   */
  surrenderLeases(ownerID = 0, spareArchives = []) {
    for (const archive in this.#openArchives) {
      const spare = spareArchives.includes(archive)
      if (!spare) this.#revokeAccess(archive, ownerID)
    }
  }

  /**
   * Delete temporary folder and its contents.
   * @param {String} folder Temporary folder path to remove.
   */
  #deleteTmpFolder(folder) {
    // folder resides on TMPDIR, right? RIGHT?
    if ( p.dirname(folder) !== TMPDIR ) {
      return console.error('FORBIDDEN: Tried to delete non-temporary folder!\n', 
        `targeted path: ${folder}`)
    }

    // delete folder recursively
    try {
      fs.rmSync(folder, { recursive: true })
      console.log(`Deleted tmp folder at ${folder}`)
    } catch (err) {
      console.error(`Failed to clear tmp folder at ${folder}\n`, err)
    }
  }
}

/**
 * Remove all temporary folders associated with ownerID. For unpriviledged contexts.
 * @param {Number} ownerID Tab instance to be cleaned.
 */
function clearTmp(ownerID) {
  tmpFolders.surrenderLeases(ownerID)
}


module.exports = { open, clearTmp }