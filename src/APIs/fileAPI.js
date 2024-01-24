/** Expand path shortcuts, list files and hint directory trees */

const child_process = require("child_process");
const fs = require('fs');
const os = require('os');
const p = require('path');
const { pathToFileURL } = require("url");


/**
 * LSObject cache for previously listed paths.
 * @type {Object<string, {lastModified:Number, lsObject:LSObject}>}
 */
let lsCache = {}

/**
 * File basenames for previously listed directories.
 * @type {Object<string, {lastModified:Number, hints:string[]}>}
 */
let hintCache = {}

/**
 * Clear all cache objects.
 */
function clearCache() {
  lsCache = {}
  hintCache = {}
}

/**
 * Infer type from supported file extentions.
 * For others such as folders, use async `fs.stat` instead.
 * @param {String} file File path or basename.
 * @returns Type String.
 */
function fileType(file) {

  switch ( p.extname(file) ) {
    case '.jpg': case '.jpeg': case '.png':
    case '.gif': case '.apng': case '.webp':
    case '.svg': case '.icns': case '.ico':
      return 'image';
    case '.mp4': case '.webm':
    case '.mp3': case '.ogg': // lump together for now
      return 'video';
    case '.zip': case '.cbz':
      return 'archive'
  }
  return 'other';
}

/**
 * Expand shortcuts and relative paths into absolute, atomic paths.
 * @param {String} path Path to expand.
 * @returns {String}
 */
function expandPath(path) {
  if (path[0] === '~') path = os.homedir() + path.slice(1);
  return p.resolve(path) // resolve "./", "../" & other relative paths
}

/**
 * Delete file at given path. 
 * * Used by Viewer to delete current file at user order.
 * @param {String} filePath Absolute file path.
 */
function deleteFile(filePath) {
  fs.rmSync(filePath)
  console.log(`Deleted ${filePath}`);
}

/**
 * Run user script on default shell. Interpret `%F`, `%N` as filepath and basename.
 * Aborts if these symbols are used without passing a `FileObject`.
 * - Example: `runOnFile("dolphin --select %F &", <FileObject>)`
 * - Note: `%F` & `%N` are double-quoted, so favor using them as arguments to a script
 * file for complex commands. Ex: `runOnFile("~/myScript.sh %F", <FileObject>)`
 * @param {String} script Command script to run.
 * @param {FileObject} file File to run script on.
 * @returns {Boolean} Success.
 */
function runOnFile(script, file = null) {
  const needFile = script.includes('%F') || script.includes('%N')
  if (needFile && !file) return false

  if (file) {
    script = script.replaceAll('%F', `"${file.path}"`)
    script = script.replaceAll('%N', `"${file.name}"`)
  }

  console.log(`ran user command on file:\n${script}`)
  child_process.exec(script) // not sync
  return true
}

/**
 * Object structure from folder's supported files.
 * @typedef {Object} LSObject
 * @property {FileObject[]} directories Listed directories.
 * @property {FileObject[]} archives Listed archives.
 * @property {FileObject[]} files Listed supported files.
 * @property {FileObject} target Target folder fileObject.
 * @property {FileObject} upperDir Target parent folder fileObject.
 */

/**
 * Asynchronously list directory folders, media contents.
 * @param {String} path Path to folder.
 * @returns {Promise<LSObject>} Listed files separated by category.
 */
async function lsAsync(path) {

  path = expandPath(path)

  /**
   * Last modified timestamp. Can be null if disabled or broken symlink.
   * @type {Number?}
   */
  const lastModified = await new Promise(resolve => {
    fs.stat( path, (err, stat) => resolve(stat?.mtimeMs) )
  })
  // if previously cached, use it if last modified match
  const cacheEntry = lsCache[path]
  if (cacheEntry && cacheEntry.lastModified === lastModified)
    return cacheEntry.lsObject

  const upperDir = p.dirname(path)
  const lsObj = {
    directories: [],
    archives: [],
    files: [],
    target: fileObj('folder', p.basename(path), path),
    upperDir: fileObj('folder', p.basename(upperDir), upperDir) // for backward navigation
  }

  /**
   * Dirent array, empty on error.
   * @type {fs.Dirent[]}
   */
  const files = await new Promise(resolve => {
    fs.readdir( path, { withFileTypes: true }, (err, files) => resolve(files) )
  }) || []
  
  // filter items for desired types
  for (let file of files) {
    const fullPath = p.join(path, file.name)
    const category = fileType(fullPath)
    
    if ( !file.isFile() ) // assume is a directory
      lsObj.directories.push( fileObj('folder', file.name, fullPath) )
    else if (category === 'archive')
      lsObj.archives.push( fileObj(category, file.name, fullPath) )
    else if (category !== 'other')
      lsObj.files.push( fileObj(category, file.name, fullPath) )
  }

  // store/update cache for path
  if (lastModified != null) lsCache[path] = {
    lastModified: lastModified,
    lsObject: lsObj
  }

  return lsObj;
}

/**
 * Return matching file basenames for queried filepath. 
 * * Used on Viewer 'open' action to hint files in a given directory.
 * @param {String} queryPath Path to list files.
 * @returns {Promise<String[]>}
 */
async function lsHint(queryPath) {
  // treat working path
  let workingPath = expandPath( queryPath || process.cwd() )

  /**
   * Path FS.Stats. Can be null.
   * @type {fs.Stats?}
   */
  const stats = await new Promise(resolve => {
    fs.stat( workingPath, (err, stat) => resolve(stat) )
  })

  // malformed path, use parent dir and cached lastModified timestamp. 
  // If parent not in cache, fake lastModified to allow caching
  let lastModified = stats?.mtimeMs
  if (!stats) {
    workingPath = p.dirname(workingPath)
    lastModified = hintCache[workingPath]?.lastModified || 0
  }

  // try cache, otherwise build and store
  let hints
  const cacheEntry = hintCache[workingPath]
  if (cacheEntry && cacheEntry.lastModified === lastModified) {
    hints = cacheEntry.hints
  } else {
    const lsObj = await lsAsync(workingPath)
    
    // concat in order, append separator to directories
    const directories = lsObj.directories.map(i => i.name + p.sep)
    const archives = lsObj.archives.map(i => i.name)
    const files = lsObj.files.map(i => i.name)
    hints = directories.concat(archives, files)

    // cache
    if (lastModified != null) hintCache[workingPath] = {
      lastModified: lastModified,
      hints: hints
    }
  }
  
  // filter hints skipping query mismatches and unrequested dot files
  const query = stats ? '' : p.basename(queryPath).toLowerCase()
  const hintRoot = stats ? queryPath : p.dirname(queryPath)
  const queryIsDot = stats ? queryPath.endsWith('.') : query[0] === '.'

  let filteredHints = []
  for (const file of hints) {
    if ( query && !file.toLowerCase().includes(query) ) continue
    if (file[0] === '.' && !queryIsDot) continue
    filteredHints.push( p.join(hintRoot, file) )
  }

  return filteredHints
}

/** 
 * Wrapper for common file operations in unprivileged contexts.
 * @typedef {Object} FileObject
 * @property {String} path Absolute path to file.
 * @property {String} name Basename. (Ex: duck.png)
 * @property {'image'|'video'|'folder'|'archive'} category File category.
 */

/**
 * Wrap file properties in object for use in unprivileged contexts.
 * @param {'image'|'video'|'folder'|'archive'} category File category.
 * @param {String} name Basename. (Ex: `duck.png`)
 * @param {String} fullpath Absolute path. (Ex: `/home/user/Pictures/duck.png`)
 * @returns {FileObject} Wrapped file.
 */
function fileObj(category, name, fullpath) {
  return {
    path : fullpath,
    name : name,
    category : category
  }
}

/**
 * Get path resolved into a POSIX URL for use in HTML.
 * @param {String} path Absolute path to file.
 * @returns {String}
 */
function getFileURL(path) {
  return pathToFileURL(path).href
}


module.exports = { clearCache, fileType, expandPath, deleteFile, runOnFile, lsAsync, lsHint, fileObj, getFileURL }