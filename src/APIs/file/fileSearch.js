// @ts-check
import fs from 'fs';
import p from 'path';
import { expandPath, fileType } from './fileTools.js';
import { tools } from '../tool/toolCapabilities.js';


/** 
 * Wrapper for common file operations in unprivileged contexts.
 * @typedef FileObject
 * @property {string} path Absolute path to file.
 * @property {string} name Basename. (Ex: duck.png)
 * @property {'image'|'audio'|'video'|'folder'|'archive'} category File category.
 */

/**
 * Object structure from folder's supported files.
 * @typedef LSObject
 * @property {FileObject} target Target folder object.
 * @property {FileObject} upperDir Parent folder object.
 * @property {FileObject[]} directories Listed directories.
 * @property {FileObject[]} archives Supported archives.
 * @property {FileObject[]} files Supported files.
 */


/**
 * LSObject cache for previously listed paths.
 * @type {Object<string, {lastModified:Number, lsObject:LSObject}>}
 */
let lsCache = {};

/**
 * File basenames for previously listed directories.
 * @type {Object<string, {lastModified:Number, hints:string[]}>}
 */
let hintCache = {};

/**
 * Clear all cache objects.
 */
export function clearCache() {
  lsCache = {};
  hintCache = {};
}

/**
 * Wrap file properties in object for use in unprivileged contexts.
 * @param {'image'|'audio'|'video'|'folder'|'archive'} category File category.
 * @param {string} name Basename. (Ex: `duck.png`)
 * @param {string} fullpath Absolute path. (Ex: `/home/user/Pictures/duck.png`)
 * @returns {FileObject} Wrapped file.
 */
export const fileObj = (category, name, fullpath) => ({
  category: category,
  name: name,
  path: fullpath
});

/**
 * Return file stats. Null if unreachable.
 * @param {string} filepath Absolute file path.
 * @return {Promise<fs.Stats?>}
 */
const getFileStats = (filepath) => new Promise(resolve => {
  fs.stat( filepath, (_err, stats) => resolve(stats) );
});

/**
 * Asynchronously list directory folders, media contents.
 * @param {String} path Path to folder.
 * @returns {Promise<LSObject>} Listed files separated by category.
 */
export async function listFiles(path) {
  const absolutePath = expandPath(path);
  const lastModified = ( await getFileStats(absolutePath) )?.mtimeMs;

  // try a valid cached entry, if any
  const cacheEntry = lsCache[absolutePath];
  if (cacheEntry && cacheEntry.lastModified === lastModified)
    return cacheEntry.lsObject;

  const parentDirectory = p.dirname(absolutePath);

  /** @type {LSObject} */
  const lsObj = {
    target: fileObj('folder', p.basename(absolutePath), absolutePath),
    upperDir: fileObj('folder', p.basename(parentDirectory), parentDirectory),
    directories: [],
    archives: [],
    files: []
  };

  /** @type {fs.Dirent[]} */
  const files = await new Promise(resolve => {
    fs.readdir( absolutePath, { withFileTypes: true }, (_err, files) => resolve(files) );
  }) || [];

  // wrap files by category
  for (let file of files) {
    const filepath = p.join(absolutePath, file.name);
    const category = fileType(filepath);

    if ( !file.isFile() ) // assume is a directory
      lsObj.directories.push( fileObj('folder', file.name, filepath) );
    else if (category === 'archive') {
      if (tools.canExtract)
        lsObj.archives.push( fileObj(category, file.name, filepath) );
    }
    else if (category !== 'other')
      lsObj.files.push( fileObj(category, file.name, filepath) );
  }

  // store/update cache
  if (lastModified != null)
    lsCache[absolutePath] = {
      lastModified: lastModified,
      lsObject: lsObj
    };

  return lsObj;
}

/**
 * Return matching file basenames for queried filepath. 
 * * Used on Viewer 'open' action to hint files in a given directory.
 * @param {string} queryPath Path to list files.
 * @returns {Promise<string[]>}
 */
export async function listPaths(queryPath) {
  let workingPath = expandPath( queryPath || process.cwd() );
  const stats = await getFileStats(workingPath);

  // invalid stats may signal a malformed path, use parent's path & last modified
  // timestamp. If parent not in cache, fake last modified timestamp to allow caching.
  let lastModified = stats?.mtimeMs;
  if (stats == null) {
    workingPath = p.dirname(workingPath);
    lastModified = hintCache[workingPath]?.lastModified || 0;
  }

  // try a valid cache entry, otherwise build and store
  let hints;
  const cacheEntry = hintCache[workingPath];
  if (cacheEntry && cacheEntry.lastModified === lastModified) {
    hints = cacheEntry.hints;
  } else {
    const lsObj = await listFiles(workingPath);

    // map to basename, append separator to directories, concat in order
    const directories = lsObj.directories.map(i => i.name + p.sep);
    const archives = lsObj.archives.map(i => i.name);
    const files = lsObj.files.map(i => i.name);
    hints = directories.concat(archives, files);

    if (lastModified != null)
      hintCache[workingPath] = {
        lastModified: lastModified,
        hints: hints
      };
  }

  // filter hints treating stat mismatches and unrequested dot files
  const query = stats ? '' : p.basename(queryPath).toLowerCase();
  const hintRoot = stats ? queryPath : p.dirname(queryPath);
  const queryIsDot = stats ? queryPath.endsWith('.') : query[0] === '.';

  const filteredHints = [];
  for (const basename of hints) {
    if (basename[0] === '.' && !queryIsDot)
      continue;

    if ( basename.toLowerCase().includes(query) )
      filteredHints.push( p.join(hintRoot, basename) );
  }

  return filteredHints;
}
