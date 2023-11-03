/** Open files, folders and archives. Create, track and delete temporary folders. */

const fs = require('fs');
const os = require('os');
const p = require('path');
const zipAPI = require('./zipAPI')
const fileAPI = require('./fileAPI')

const TMPDIR = os.tmpdir()  // OS directory where to temporarily unzip archives
const TMPPREFIX = 'mxiv-'   // prefix for temporarily extracted archive folders


/**
 * Viewable file structure for path array. Used in `FileBook`.
 * @typedef {Object} BookObject
 * @property {String?} startOn Path substring from file that is supposed to be displayed at start.
 * @property {fileAPI.FileObject[]} paths Files parent directory.
 * @property {fileAPI.FileObject[]} files Target folder fileObject.
 */

/**
 * Treat and wrap folders, archives and files in a common object for unpriviledged usage.
 * @param {String[]} paths Array of files/folders paths to open.
 * @param {Number} ownerID Keeps track of temporary folder (archives) ownership.
 * @returns {Promise<BookObject>} New book object data.
 */
async function open(paths, ownerID = 0) {

  /** Temporary folders leased in current block. */
  const workingTmpFolders = []

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
    // check truthy, expand shortcuts & skip if already processed
    if (!path) continue
    path = fileAPI.expandPath(path)
    if (bookObj.paths.find(item => item.path === path)) continue

    // skip if file doesn't exist, else get stat and type
    const pathStat = await new Promise((resolve, reject) => {
      fs.stat(path, (err, stat) => resolve(stat))
    })
    if (!pathStat) continue
    const fileType = fileAPI.fileType(path)

    // Directory, build files array from path
    if (pathStat.isDirectory()) {
      const lsObj = await fileAPI.lsAsync(path)
      if (!lsObj.files.length) continue

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Viewable file, build from parent folder and start on itself
    else if (fileType !== 'archive' && fileType !== 'other') {
      // don't process the same parent directory more than once
      const parentDir = p.dirname(path)
      if (bookObj.paths.find(item => item.path === parentDir)) continue

      // only set startOn file for first path
      const lsObj = await fileAPI.lsAsync(parentDir)
      if (!bookObj.paths.length) bookObj.startOn = path

      bookObj.paths.push(lsObj.target)
      bookObj.files = bookObj.files.concat(lsObj.files)
    }

    // Archive, extract (and prevent extracting directories for ending in '.zip')
    else if (fileType === 'archive' && !pathStat.isDirectory()) {
      const tmpDir = await tmpFolders.leaseTmpFolder(path, ownerID)
      if (tmpDir) {
        workingTmpFolders.push(tmpDir) // prevent clearing working tmp folder
  
        // open folder & append zip path to paths
        const lsObj = await fileAPI.lsAsync(tmpDir)
        bookObj.paths.push(fileAPI.fileObj('archive', p.basename(path), path))
        bookObj.files = bookObj.files.concat(lsObj.files)
      }
    }
  }

  // clear orphan tmp folders on success, if any
  const success = bookObj.paths.length
  if (success) tmpFolders.surrenderTmpFolders(ownerID, workingTmpFolders)

  return bookObj
}


/** Manage temporary folders created to view archives. */
const tmpFolders = new class TemporaryFolders {

  /**
   * Keeps track of leased tmpFolders by ownerID's.
   * @type {Object<string, Set<String>>}
   */
  #leasedFolders = {}

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
   * Create a temporary folder for archive if valid. Returns folder path or empty if invalid.
   * @param {String} archivePath Absolute path to zip file.
   * @param {Number} ownerID Owner ID to register folder.
   * @returns {Promise<String>} Path to temporary folder.
   */
  async leaseTmpFolder(archivePath, ownerID = 0) {

    // only extract archives that contain a viewable file
    const zipFiles = await zipAPI.fileList(archivePath)
    const validFileIdx = zipFiles.findIndex(filePath => {
      if ( p.dirname(filePath) !== '.' ) return false
      const fileType = fileAPI.fileType(filePath)
      return fileType === 'image' || fileType === 'video'
    })

    if (validFileIdx < 0) return ''

    // new unique temp folder (ex: /tmp/prefix-dpC7Id)
    const tmpDir = fs.mkdtempSync(p.join(TMPDIR, TMPPREFIX))
    await zipAPI.extract(archivePath, tmpDir)
    console.log(`Extracted archive to tmp folder ${tmpDir}`)

    // add to #leasedFolders
    if (!this.#leasedFolders[ownerID]) this.#leasedFolders[ownerID] = new Set()
    this.#leasedFolders[ownerID].add(tmpDir)

    return tmpDir
  }

  /**
   * Remove all temporary folders associated with ownerID. Spare array if given.
   * Called after successfuly generating a new book for viewing or when closing the app.
   * @param {Number} ownerID Tab instance to be cleaned.
   * @param {String[]} sparePaths Temporary paths to spare.
   */
  surrenderTmpFolders(ownerID = 0, sparePaths = []) {
    const tmpFolders = this.#leasedFolders[ownerID]
    if (!tmpFolders || !tmpFolders.size) return

    for (const tmpPath of tmpFolders.values() ) {
      const spare = sparePaths.includes(tmpPath)
      if (!spare) this.#deleteTmpFolder(tmpPath, ownerID)
    }
  }

  /**
   * Delete previously leased temporary folder and its contents.
   * @param {String} folder Temporary folder path to remove.
   * @param {Number} ownerID Owner ID to read from storage.
   */
  #deleteTmpFolder(folder, ownerID = 0) {
    let tmpFolders = this.#leasedFolders[ownerID]

    // folder was previously leased?
    if ( !tmpFolders || !tmpFolders.has(folder) ) {
      console.error('FORBIDDEN: Tried to delete unleased temporary folder!', 
      `targeted path: ${folder}`, `ownerID: ${ownerID}`)
      return
    }
    
    // folder resides on TMPDIR, right? RIGHT?
    if (p.dirname(folder) != TMPDIR) {
      console.error('FORBIDDEN: Tried to delete non-temporary folder!', 
      `targeted path: ${folder}`, `ownerID: ${ownerID}`)
      return
    }

    // finally, delete folder recursively and update leasedFolders
    try {
      fs.rmSync(folder, { recursive: true })
      this.#leasedFolders[ownerID].delete(folder)
      if (!this.#leasedFolders[ownerID].size) delete this.#leasedFolders[ownerID]
      console.log(`Deleted tmp folder at ${folder}`)
    } catch {
      console.log('Failed to clear tmp folder')
    }
  }
}

/**
 * Remove all temporary folders associated with ownerID. For unpriviledged contexts.
 * @param {Number} ownerID Tab instance to be cleaned.
 */
function clearTmp(ownerID) {
  tmpFolders.surrenderTmpFolders(ownerID)
}


module.exports = { open, clearTmp }