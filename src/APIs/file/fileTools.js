import { exec } from 'child_process';
import p from 'path';
import { rmSync } from 'fs';
import { homedir } from 'os';


/**
 * Infer type from supported file extentions.
 * For others such as folders, use async `fs.stat` instead.
 * @param {String} file File path or basename.
 * @returns Type String.
 */
export function fileType(file) {

  switch ( p.extname(file) ) {
    case '.jpg': case '.jpeg': case '.png':
    case '.gif': case '.apng': case '.webp':
    case '.svg': case '.icns': case '.ico':
      return 'image'
    case '.mp3': case '.ogg': case '.wav':
      return 'audio'
    case '.mp4': case '.webm':
      return 'video';
    case '.zip': case '.cbz':
      return 'archive'
  }
  return 'other'
}

/**
 * Expand shortcuts and relative paths into absolute, atomic paths.
 * @param {String} path Path to expand.
 * @returns {String}
 */
export function expandPath(path) {
  if (path[0] === '~') path = homedir() + path.slice(1);
  return p.resolve(path) // resolve "./", "../" & other relative paths
}

/**
 * Delete file at given path. 
 * - Used in Viewer to delete current file at user order.
 * @param {String} filePath Absolute file path.
 * @returns {Boolean} Success.
 */
export function deleteFile(filePath) {
  try {
    rmSync(filePath)
    return true
  } catch (err) {
    return err.code === 'ENOENT' // already deleted, return true
  }
}

/**
 * Run user script on default shell. 
 * - Interpret `%F`, `%N`, `%T` symbols as filepath, basename & filetype, respectively.
 * - Aborts if symbols are used without passing a filepath.
 * @example
 * runOnFile("dolphin --select %F &", "path/to/file.png")
 * 
 * // %F & %N symbols become double-quoted, so favor their use
 * // as arguments instead of escaping quotes for complex scripts.
 * runOnFile("~/myScript.sh %F", "path/to/file.png")
 * 
 * @param {String} script User script.
 * @param {string} [filepath] Absolute path to file to run script on.
 * @returns {Boolean} Success.
 */
export function runOnFile(script, filepath) {
  const needFile = script.includes('%F') || script.includes('%N') || script.includes('%T')
  if (needFile && !filepath) return false

  if (filepath) {
    script = script.replaceAll('%F', `"${filepath}"`)
    script = script.replaceAll('%N', `"${p.basename(filepath)}"`)
    script = script.replaceAll('%T', fileType(filepath) )
  }

  // console.log(`MXIV: Ran user script:\n${script}`)
  exec(script) // non blocking
  return true
}
