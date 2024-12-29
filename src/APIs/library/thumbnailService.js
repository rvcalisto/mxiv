// @ts-check
import fs from 'fs';
import p from 'path';
import { fileType } from '../file/fileTools.js';
import * as archiveTool from '../tool/archive.js';
import * as thumbnailTool from '../tool/thumbnail.js';
import { randomUUID } from 'crypto';
import { libraryCoverDirectory } from '../tool/appPaths.js';


/**
 * @typedef {import('../tool/toolCapabilities.js').ToolCapabilities} ToolCapabilities
 */


/**
 * Check if cover thumbnail path exists, try to create it if not found.
 * @returns {Promise<boolean>} Either path exists at the end of execution.
 */
export async function createThumbnailDirectory() {
  const folderExists = await new Promise(resolve => {
    fs.stat( libraryCoverDirectory, (err, stat) => resolve(!err && stat != null) );
  });
  
  return folderExists || new Promise(resolve => {
    fs.mkdir( libraryCoverDirectory, { recursive: true }, (err) => {
      if (err)
        console.log('MXIV: Couldn\'t create thumbnails folder\n', err);
      else
        console.log(`MXIV: Created thumbnails folder at '${libraryCoverDirectory}'`);
      
      resolve(!err);
    });
  });
}

/**
 * Delete entire library & cover thumbnail folder.
 * @returns {Promise<boolean>} Success.
 */
export async function deleteThumbnailDirectory() {
  return await new Promise(resolve => {
    fs.rm(libraryCoverDirectory, { recursive: true }, (err) => {
      if (!err)
        console.log('MXIV: successfuly deleted thumbnail covers folder');
      else
        console.log('MXIV: couldn\'t delete thumbnail covers folder', err);
      
      resolve(!err);
    });
  });
}

/**
 * Create thumbnail from file. Returns thumbnail path.
 * - Use `id` on concurrent threads to prevent overwrites
 *   when extracting archive files. (ex: 01.jpg)
 * @param {string} path Folder/archive path.
 * @param {ToolCapabilities} tools Tool capabilities.
 * @param {number} [id=0] Extraction folder name, used by threads.
 * @returns {Promise<string?>} Path to generated thumbnail.
 */
export async function createThumbnail(path, tools, id = 0) {
  if (!tools.canThumbnail)
    return null;
  else if ( fileType(path) === 'archive' )
    return await coverFromArchive(path, id);
  else
    return await coverFromDirectory(path);
}

/**
 * Delete thumbnail.
 * @param {string} path Path to thumbnail.
 * @returns {Promise<boolean>} Success.
 */
export async function deleteThumbnail(path) {
  if (!path)
    return false;

  const insideCoverDir = p.dirname(path) === libraryCoverDirectory
  if (!insideCoverDir) {
    console.error(`MXIV::FORBIDDEN: Tried to delete non-thumbnail file!\ntargeted path: ${path}`);
    return false;
  }
 
  return new Promise(resolve => {
    fs.rm(path, err => {
      // ENOENT: Thumbnail has already been deleted, ignore.
      if (!err || err.code === 'ENOENT')
        return resolve(true);
      
      console.error(`MXIV: Failed to delete thumbnail at: ${path}\n`, err);
      resolve(false);
    });
  });
}

/**
 * Asynchronously creates cover from directory.
 * @param {string} path Folder Path.
 * @returns {Promise<string?>} Cover Path.
 */
async function coverFromDirectory(path) {
  /** Directory files, only basenames. @type {string[]} */
  const directoryFiles = await new Promise(resolve => {
    fs.readdir( path, (_err, files) => resolve(files) );
  });

  const coverBasename = directoryFiles.find(filepath => {
    const type = fileType(filepath);
    return type === 'image' || type === 'video';
  });
  
  if (coverBasename == null)
    return null;

  // generate cover as UUID.jpg
  const coverSource = p.join(path, coverBasename);
  const coverTarget = p.join(libraryCoverDirectory, `${randomUUID()}.jpg`);
  const thumbnailOK = await thumbnailTool.generateThumbnail(coverSource, coverTarget);

  return coverTarget;
}

/**
 * Asynchronously creates cover from archives.
 * - Use `id` on concurrent threads to prevent overwrites
 *   when extracting archive files. (ex: 01.jpg)
 * @param {string} path Folder Path.
 * @param {number} [id=0] Extraction folder name, used by threads.
 * @returns {Promise<string?>} Cover Path.
 */
async function coverFromArchive(path, id = 0) {
  // find cover file from archive
  const archiveFiles = await archiveTool.fileList(path);
  const coverBasename = archiveFiles.find(filepath => {
    const type = fileType(filepath);
    return type === 'image' || type === 'video';
  });

  if (coverBasename == null)
    return null;

  // extract file and generate cover as UUID.jpg, remove extracted file after
  const extractionFolder = p.join( libraryCoverDirectory, String(id) );
  const coverSource = await archiveTool.extractOnly(coverBasename, path, extractionFolder);
  const coverTarget = p.join(libraryCoverDirectory, `${randomUUID()}.jpg`);
  const thumbnailOK = await thumbnailTool.generateThumbnail(coverSource, coverTarget);
  fs.rmSync(coverSource);
  
  return coverTarget;
}
