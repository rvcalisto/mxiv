/** Expand path shortcuts, list files and hint directory trees */

const child_process = require("child_process");
const fs = require('fs');
const os = require('os');
const p = require('path');
const { pathToFileURL } = require("url");


/**
 * Store LSObjects for previously listed absolute paths.
 * @type {Object<string, LSObject>}
 */
let lsCache = {}

/**
 * List basenames for files and directories in each absolute path.
 * @type {Object<string, string[]>}
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
  // expand home shortcut
  if (path[0] === '~') path = os.homedir() + path.slice(1);
  // resolve ./ & ../ and handles global & relative paths
  return p.resolve(path)
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
 * Run user script on default shell. Replace `%F` and `%N` symbols as file's path 
 * and basename respectively. Returns false if symbols are used without a file.
 * 
 * * Example: `runOnFile("dolphin --select %F &", <FileObject>)`
 * 
 * * Note: `%F` & `%N` are double-quoted, so favor using them as arguments to a script
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

/** Asynchronous return object from files listed in folder.
 * @param {String} path Path to folder.
 * @returns {Promise<LSObject>} Listed files separated by category.
 */
async function lsAsync(path) {

  // expand shortcuts and links
  path = expandPath(path)

  // try cache first (disabled, async is ok and cache may be dirty)
  // if (lsCache[path]) {
  //   console.log('has lsCache')
  //   return lsCache[path]
  // }

  const upperDir = p.dirname(path)
  const lsObj = {
    directories: [],
    archives: [],
    files: [],
    target: fileObj('folder', p.basename(path), path),
    upperDir: fileObj('folder', p.basename(upperDir), upperDir) // for backward navigation
  }

  /** Dirent array, empty on error. @type {fs.Dirent[]} */
  const files = await new Promise((resolve, reject) => {
    fs.readdir(path, { withFileTypes: true }, (err, files) => resolve(files))
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

  // lsCache[path] = lsObj // store cache for path (disabled)

  return lsObj;
}


/**
 * Treat malformed paths and return a filtered array of similar file paths 
 * to queried path if any, or parent directory files otherwise.
 * * Used on user AppCLI on 'open' to hint folders and directory files.
 * @param {String} queryPath Path to list files.
 * @returns {Promise<String[]>}
 */
async function lsHint(queryPath) {
  if (!queryPath) queryPath = '~/'

  // expand query into working path and check existence
  let workingPath = expandPath(queryPath)
  const pathExists = await new Promise((resolve, reject) => {
    fs.stat(workingPath, (err, stat) => resolve(!err && stat))
  })

  // correct working path to upper directory
  if (!pathExists) workingPath = p.dirname(workingPath)

  // try cache, otherwise build and store entry
  let hints = hintCache[workingPath]
  if (!hints) {
    const lsObj = await lsAsync(workingPath)
    
    // concat in order, append separator to directories
    const directories = lsObj.directories.map(i => i.name + p.sep)
    const archives = lsObj.archives.map(i => i.name)
    const files = lsObj.files.map(i => i.name)
    hints = directories.concat(archives, files)

    // store hints in lsCache
    hintCache[workingPath] = hints
  }
  
  const query = pathExists ? '' : p.basename(queryPath).toLowerCase()
  const hintRoot = pathExists ? queryPath : p.dirname(queryPath)
  const queryIsDot = pathExists ? queryPath.endsWith('.') : query[0] === '.'

  let filteredHints = []
  for (const file of hints) {
    // filter hints skipping query mismatches and unrequested dot files
    if (query && !file.toLowerCase().includes(query)) continue
    if (file[0] === '.' && !queryIsDot) continue
    filteredHints.push(p.join(hintRoot, file))
  }

  return filteredHints
}


/** 
 * Wrapper for common file operations in unprivileged contexts.
 * @typedef {Object} FileObject
 * @property {String} path Absolute path to file.
 * @property {String} name Basename. (Ex: duck.png)
 * @property {'image'|'video'|'folder'|'archive'} category File category.
 * @property {String} [pathURL] Same as path, but encoded for HTML. Only present for `image`, `video`.
 */

/** Wrap file properties in object for use in unprivileged contexts.
 * @param {'image'|'video'|'folder'|'archive'} category File category.
 * @param {String} name Basename. (Ex: `duck.png`)
 * @param {String} fullpath Absolute path. (Ex: `/home/user/Pictures/duck.png`)
 * @returns {FileObject} Wrapped file.
 */
function fileObj(category, name, fullpath) {

  const obj = {
    path : fullpath, // not-relative, atomic
    name : name, // duck.png
    category : category,
  }

  // encoded url for media tag src property
  if (category === 'image' || category === 'video') {
    obj.pathURL = pathToFileURL(fullpath).href
  }

  return obj
}


module.exports = { clearCache, fileType, expandPath, deleteFile, runOnFile, lsAsync, lsHint, fileObj }