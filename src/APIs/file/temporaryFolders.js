// @ts-check
import { mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileType } from './fileTools.js';
import { extract, fileList } from '../tool/archive.js';


/**
 * Temporary directory where to extract archives.
 */
const TMPDIR = tmpdir();

/**
 * Prefix for temporarily extracted archives.
 */
const TMPPREFIX = 'mxiv-';

/**
 * Track temporarily extracted archives, their tmp paths and owners.
 * @type {Object<string, {path:string, owners:Set<string>}>}
 */
const openArchives = {};


/**
 * Return either path is from a temporary folder file.
 * @param {string} path Path to file to verify.
 * @returns {boolean}
 */
export function isPathFromTmp(path) {
  const pathIsTmp = path.includes( join(TMPDIR, TMPPREFIX) );
  const type = fileType(path);

  return pathIsTmp && type !== 'other' && type !== 'archive';
}

/**
 * Lease temporary folder for archive files. Returns folder path or empty if invalid.
 * @param {string} archivePath Absolute path to archive.
 * @param {string} ownerID Owner ID to register folder.
 * @returns {Promise<string>} Path to temporary folder. Empty on failure.
 */
export async function leaseArchive(archivePath, ownerID) {
  // currently leased, track new id and return temporary path
  const registry = openArchives[archivePath];
  if (registry) {
    registry.owners.add(ownerID);
    return registry.path;
  }

  // otherwise, validate and extract to unique temp folder (ex: /tmp/prefix-dpC7Id)
  if ( !await archiveIsValid(archivePath) )
    return '';

  let tmpDir = '';
  try {
    tmpDir = mkdtempSync( join(TMPDIR, TMPPREFIX) );
  } catch(err) {
    console.log(`MXIV: Failed to created tmp folder at ${tmpDir}\n`, err);
    return '';
  }

  const success = await extract(archivePath, tmpDir);
  if (!success) {
    console.log(`MXIV: Failed to extract ${archivePath} to ${tmpDir}`);
    return '';
  }

  openArchives[archivePath] = {
    path: tmpDir,
    owners: new Set([ownerID])
  };

  return tmpDir;
}

/**
 * Revoke all archive accesses associated with ownerID. Spare archives if given.
 * @param {string} ownerID Client ID to clear.
 * @param {string[]} [spareArchives] Archive paths to spare.
 */
export function surrenderLeases(ownerID, spareArchives = []) {
  for (const archive in openArchives) {
    const spare = spareArchives.includes(archive);

    if (!spare)
      revokeAccess(archive, ownerID);
  }
}

/**
 * Return either archive has supported viewable files.
 * @param {string} archivePath Absolute path to archive.
 * @returns {Promise<boolean>}
 */
async function archiveIsValid(archivePath) {
  const archivedFiles = await fileList(archivePath);

  return archivedFiles.some(filePath => {
    const type = fileType(filePath);
    return type === 'image' || type === 'video';
  });
}

/**
 * Revoke access to a leased archive. Delete orphaned lease paths.
 * @param {string} archivePath Archive to revoke access to.
 * @param {string} ownerID Consumer UUID.
 */
function revokeAccess(archivePath, ownerID) {
  const registry = openArchives[archivePath];
  registry.owners.delete(ownerID);

  if (registry.owners.size < 1) {
    deleteTmpFolder(registry.path);
    delete openArchives[archivePath];
  }
}

/**
 * Delete temporary folder and its contents.
 * @param {string} folder Temporary folder path to remove.
 */
function deleteTmpFolder(folder) {
  // folder resides on TMPDIR, right? RIGHT?
  if ( dirname(folder) !== TMPDIR ) {
    return console.error('MXIV::FORBIDDEN: Tried to delete non-temporary folder!\n',
      `targeted path: ${folder}`);
  }

  // delete folder recursively
  try {
    rmSync(folder, { recursive: true });
  } catch (err) {
    console.error(`MXIV: Failed to clear tmp folder at ${folder}\n`, err);
  }
}
