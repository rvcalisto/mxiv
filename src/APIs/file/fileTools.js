const { exec } = require("child_process");
const p = require('path');
const { rmSync } = require('fs');
const { homedir } = require('os');


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
  if (path[0] === '~') path = homedir() + path.slice(1);
  return p.resolve(path) // resolve "./", "../" & other relative paths
}

/**
 * Delete file at given path. 
 * * Used by Viewer to delete current file at user order.
 * @param {String} filePath Absolute file path.
 */
function deleteFile(filePath) {
  rmSync(filePath)
  console.log(`MXIV: Deleted ${filePath}`);
}

/**
 * Run user script on default shell. Interpret `%F`, `%N` as filepath and basename.
 * Aborts if these symbols are used without passing a `FileObject`.
 * - Example: `runOnFile("dolphin --select %F &", <FileObject>)`
 * - Note: `%F` & `%N` are double-quoted, so favor using them as arguments to a script
 * file for complex commands. Ex: `runOnFile("~/myScript.sh %F", <FileObject>)`
 * @param {String} script Command script to run.
 * @param {import("./fileSearch").FileObject} file File to run script on.
 * @returns {Boolean} Success.
 */
function runOnFile(script, file = null) {
  const needFile = script.includes('%F') || script.includes('%N')
  if (needFile && !file) return false

  if (file) {
    script = script.replaceAll('%F', `"${file.path}"`)
    script = script.replaceAll('%N', `"${file.name}"`)
  }

  // console.log(`MXIV: Ran user script:\n${script}`)
  exec(script) // non blocking
  return true
}


module.exports = { expandPath, fileType, deleteFile, runOnFile }