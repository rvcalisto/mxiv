import { exec } from 'child_process';
import p from 'path';
import { rmSync } from 'fs';
import { homedir } from 'os';


/**
 * Infer type from supported file extensions.
 * For others such as folders, use async `fs.stat` instead.
 * @param {string} file File path or basename.
 * @returns Type string.
 */
export function fileType(file) {

  switch ( p.extname(file) ) {
    case '.jpg': case '.jpeg': case '.png':
    case '.gif': case '.apng': case '.webp':
    case '.svg': case '.icns': case '.ico':
    case '.avif':
      return 'image';
    case '.mp3': case '.ogg': case '.wav':
    case '.m4a': case '.aac': case '.flac':
    case '.opus':
      return 'audio';
    case '.mp4': case '.webm': case '.mov':
      return 'video';
    case '.zip': case '.cbz':
      return 'archive';
  }

  return 'other';
}

/**
 * Expand shortcuts and relative paths into absolute, atomic paths.
 * @param {string} path Path to expand.
 * @returns {string}
 */
export function expandPath(path) {
  if ( path.startsWith(`~${p.sep}`) )
    path = path.replace('~', homedir() );

  return p.resolve(path); // resolve relative paths
}

/**
 * Delete file at given path. 
 * - Used in Viewer to delete current file at user order.
 * @param {string} filePath Absolute file path.
 * @returns {boolean} Success.
 */
export function deleteFile(filePath) {
  try {
    rmSync(filePath);
    return true;
  } catch (err) {
    return err.code === 'ENOENT'; // already deleted, return true
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
 * @param {string} script User script.
 * @param {string} [filepath] Absolute path to file to run script on.
 * @returns {boolean} Success.
 */
export function runOnFile(script, filepath) {
  const needFile = script.includes('%F') || script.includes('%N') || script.includes('%T');
  if (needFile && !filepath)
    return false;

  if (filepath) {
    script = script.replaceAll('%F', `"${filepath}"`)
                   .replaceAll('%N', `"${p.basename(filepath)}"`)
                   .replaceAll('%T', fileType(filepath) );
  }

  exec(script); // non blocking
  return true;
}
