/** Store, generate and delete library books and cover thumbnails. */

const fs = require('fs');
const os = require('os');
const p = require('path');
const { randomUUID } = require('crypto');
const fileAPI = require('./fileAPI')
const arcAPI = require('./arcAPI');
const magickAPI = require('./magickAPI');
const { pathToFileURL } = require('url');


/** Local folder for cover thumbnail storage. */
const COVERDIR = p.join(os.homedir(), '.local', 'share', 'mxiv', 'covers')
const PLACEHOLDERICON = p.join(__dirname, '../icons/libraryIconPlaceholder.jpg')

/** localStorage item name for LibraryObject. */
const libraryStorage = 'libraryPaths'

let canExtract = undefined
let canMagick = undefined

/**
 * @typedef {Object<string, LibraryEntry>} LibraryObject Hold folder/archive path as keys.
 */

/**
 * Return library object from local storage.
 * @returns {LibraryObject}
 */
function getLibraryObj() {
  const libObj = JSON.parse(localStorage.getItem(libraryStorage))
  return libObj ? libObj : {}
}

/**
 * Store library object in local storage.
 * @param {LibraryObject} libraryObj 
 */
function storeLibraryObj(libraryObj) {
  localStorage.setItem(libraryStorage, JSON.stringify(libraryObj))
}

/**
 * Check if cover thumbnail path exists, try to create it if not found.
 * @returns {Promise<Boolean>} Either path exists or not at the end of execution.
 */
async function initCoverDir() {

  // thumbnails folder nicely located at COVERDIR :)
  const folderExists = await new Promise((resolve, reject) => {
    fs.stat(COVERDIR, (err, stat) => resolve(!err && stat))
  })
  if (folderExists) return true

  // no thumbnail folder? create recursively
  return new Promise((resolve, reject) => {
    fs.mkdir(COVERDIR, { recursive: true }, (err) => {
      if (err) console.log("Couldn't create thumbnails folder \nError: ", err)
      else console.log(`Created thumbnails folder at '${COVERDIR}'`)
      resolve(!err)
    })
  })
}


/**
 * Store archive or folder recursively.
 * @param {String} folderPath Folder/archive path to add.
 * @returns {Promise<Number>} New paths added.
 */
async function addToLibrary(folderPath) {

  // make sure that cover folder exists
  console.time(`addToLib ${folderPath}`)
  if ( !await initCoverDir() ) return -1

  // set tool availability if unset
  if (canExtract === undefined) canExtract = await arcAPI.hasTool()
  if (canMagick === undefined) canMagick = await magickAPI.hasTool()

  // map folder recursively, filter out already added & invalid keys 
  const libObj = getLibraryObj()
  const mappedPaths = await mapFolder(folderPath)
  const pathsToStore = mappedPaths.filter(path => {
    if (libObj[path] != null) return false
    if (fileAPI.fileType(path) === 'archive' && !canExtract) return false
    return true
  })

  // store new paths and emit event for library display 
  for (let i = 0; i < pathsToStore.length; i++) {
    const path = pathsToStore[i]
    await storeEntry(path, libObj)

    const ev = new CustomEvent('bookAdded', { detail: {
      total: pathsToStore.length,
      current: i,
      newPath: path
    }})
    dispatchEvent(ev)
  }

  // store new library object 
  if (pathsToStore.length) storeLibraryObj(libObj)
  console.timeEnd(`addToLib ${folderPath}`)
  return pathsToStore.length
}


/**
 * Map archives and folders (recursively) for valid book entries. Returns array.
 * @param {String} folderPath Path to folder to be mapped recursively.
 * @returns {Promise<String[]>} Mapped paths.
 */
async function mapFolder(folderPath) {
  const mappedPaths = []

  // append valid paths to mappedPaths, recursively
  async function mapRecursive(path) {
    const ls = await fileAPI.lsAsync(path)
  
    // add archives
    for (const archive of ls.archives) mappedPaths.push(archive.path)
  
    // path has viewable files, add absolute path
    if (ls.files.length) mappedPaths.push(ls.target.path)

    // process folders recursively
    for (const dir of ls.directories) await mapRecursive(dir.path)
  }
  
  await mapRecursive(folderPath)
  return mappedPaths
}


/**
 * @typedef LibraryEntry Properties of a library folder/archive.
 * @property {String} name File/folder basename.
 * @property {String} path Absolute path to book file/folder.
 * @property {String} coverPath Absolute path to cover file.
 * @property {String} coverURL Encoded cover path for html display.
 */

/**
 * Create and store a LibraryEntry for folder/archive path in given LibraryObject.
 * @param {String} path Folder/archive path to create a LibraryEntry from.
 * @param {LibraryObject} objRef Refence to LibraryObject.
 * @returns {Promise<true>} Always true.
 */
async function storeEntry(path, objRef) {

  const cover = fileAPI.fileType(path) === 'archive' ?
  await coverFromArc(path) : await coverFromDir(path)

  objRef[path] = {
    'name' : p.basename(path),
    'path' : path,
    'coverPath' : cover,
    'coverURL' : pathToFileURL(cover).href,
  }
  return true
}


/**
 * Asynchronously creates cover from folder's first file.
 * @param {String} path Folder Path.
 * @returns {Promise<String>} Cover Path.
 */
async function coverFromDir(path) {

  // get first file from folder
  const firstFile = await new Promise((resolve, reject) => {
    fs.readdir(path, (err, files) => resolve(p.join(path, files[0])));
  })
  
  // firstFile may not be an image! use placeholder
  const isImg = fileAPI.fileType(firstFile) === 'image'
  if (!isImg || !canMagick) return await coverPlaceholder()

  // generate cover path to be used as UUID.extention
  const ext = p.extname(firstFile)
  const coverPath = p.join(COVERDIR, `${randomUUID()}${ext}`)
  await magickAPI.generateThumbnail(firstFile, coverPath)

  return coverPath
}


/**
 * Asynchronously creates cover from archive's first file.
 * @param {String} path Folder Path.
 * @returns {Promise<String>} Cover Path.
 */
async function coverFromArc(path) {

  // extract first file from archive and get its path
  const firstFile = (await arcAPI.fileList(path))[0]

  // firstFile may not be an image! use placeholder
  const isImg = fileAPI.fileType(firstFile) === 'image'
  if (!isImg || !canMagick) return await coverPlaceholder()

  const extractedPath = await arcAPI.extractOnly(firstFile, path, COVERDIR)

  // generate cover path to be used as UUID.extention. Remove extracted source.
  const ext = p.extname(extractedPath)
  const coverPath = p.join(COVERDIR, `${randomUUID()}${ext}`)
  await magickAPI.generateThumbnail(extractedPath, coverPath)
  fs.rmSync(extractedPath)

  return coverPath
}


/**
 * Generate a cover placeholder and return its path.
 * @returns {Promise<String>} Placeholder thumbnail path.
 */
async function coverPlaceholder() {
  // TODO: generate cover for videos, custom icon for audio
  const placeholderCover = p.join(COVERDIR, `${randomUUID()}.jpg`)
  await new Promise((resolve, reject) => {
    fs.copyFile(PLACEHOLDERICON, placeholderCover, () => resolve())
  })
  return placeholderCover
}


/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<Boolean>} Success.
 */
async function clearLibrary() {
  localStorage.removeItem(libraryStorage)

  return await new Promise((resolve, reject) => {
    fs.rm(COVERDIR, { recursive: true }, (err) => {
      if (!err) console.log('successfuly deleted thumbnail covers folder')
      else console.log('couldn\'t delete thumbnail covers folder', err)
      resolve(!err)
    })
  })
}


/**
 * Remove a library entry and delete cover thumbnail from cache.
 * @param {String} path Library object key. Path to stored book.
 * @returns {Promise<Boolean>} Success.
 */
async function removeFromLibrary(path) {
  if (!path) return false

  const libObj = getLibraryObj()
  if (!libObj) return false

  // get cover properties object
  const bookObj = libObj[path]
  if (!bookObj) {
    console.error(`ERROR: Can't delete entry. Key ${path} is not in library.`)
    return false
  }

  const coverPath = bookObj.coverPath
  const insideCoverDir = p.dirname(coverPath) == COVERDIR
  if (!insideCoverDir) {
    console.error(`FORBIDDEN: Tried to delete non-thumbnail file! \ntargeted path: ${path}`)
    return false
  }

  // don't wait asynchronous fs.rm() to update object
  delete libObj[path]
  storeLibraryObj(libObj)

  // delete thumbnail file 
  return new Promise((resolve, reject) => {
    fs.rm(coverPath, (err) => {
      if (!err) console.log(`successfuly deleted thumbnail ${coverPath}`)
      else console.log(`couldn't delete thumbnail ${coverPath}`, err)
      resolve(!err)
    })
  })
}


// TODO: procedure to clean orphaned entries on sync (end of addToLibrary)
async function listOrphanEntries(removeOrphans = false) {
  const libObj = getLibraryObj()

  const taskPromises = [], orphans = []
  for (const keyPath in libObj) {
    const task = new Promise((resolve) => fs.access(keyPath, (err) => {
      if (err) orphans.push(keyPath)
      resolve()
    }))
    taskPromises.push(task)
  }

  await Promise.all(taskPromises)
  console.log(`${orphans.length} book entries orphaned:`, orphans)
  
  if (removeOrphans) {
    for (const orphanPath of orphans) {
      await removeFromLibrary(orphanPath)
    }
    
    console.log('all orphans removed')
  }
}


// create thumbnail directory as side-effect
initCoverDir()

module.exports = { addToLibrary, removeFromLibrary, clearLibrary, mapFolder, listOrphanEntries }