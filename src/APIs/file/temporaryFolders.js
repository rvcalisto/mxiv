import fs from 'fs';
import p from 'path';
import { tmpdir } from 'os';
import { fileType } from './fileTools.js';
import * as archiveTool from '../tool/archive.js';


/**
 * Temporary directory where to extract archives.
 */
const TMPDIR = tmpdir();

/**
 * Prefix for temporarily extracted archives.
 */
const TMPPREFIX = 'mxiv-';


/**
 * Manage temporary folders created to view archives.
 */
export const TemporaryFolders = new class {

  /**
   * Track archives temporarily extracted and their consumers.
   * @type {Object<string, {path:string, owners:Set<string>}>}
   */
  #openArchives = {};

  /**
   * Return either path is from a temporary folder file.
   * @param {string} path Path to file to verify.
   * @returns {boolean}
   */
  isPathFromTmp(path) {
    const pathIsTmp = path.includes( p.join(TMPDIR, TMPPREFIX) );
    const type = fileType(path);

    return pathIsTmp && type !== 'other' && type !== 'archive';
  }

  /**
   * Revoke access to a leased archive. Delete orphaned lease paths.
   * @param {string} archivePath Archive to revoke access to.
   * @param {string} ownerID Consumer UUID.
   */
  #revokeAccess(archivePath, ownerID) {
    const registry = this.#openArchives[archivePath];
    registry.owners.delete(ownerID);

    if (registry.owners.size < 1) {
      this.#deleteTmpFolder(registry.path);
      delete this.#openArchives[archivePath];
    }
  }

  /**
   * Return either archive has supported viewable files.
   * @param {string} archivePath Absolute path to archive.
   * @returns {Promise<boolean>}
   */
  async #archiveIsValid(archivePath) {
    const archivedFiles = await archiveTool.fileList(archivePath);
    
    return archivedFiles.some(filePath => {
      const type = fileType(filePath);
      return type === 'image' || type === 'video';
    });
  }

  /**
   * Lease temporary folder for archive files. Returns folder path or empty if invalid.
   * @param {string} archivePath Absolute path to archive.
   * @param {string} ownerID Owner ID to register folder.
   * @returns {Promise<string>} Path to temporary folder. Empty on failure.
   */
  async leaseArchive(archivePath, ownerID) {

    const registry = this.#openArchives[archivePath];
    if (registry) {
      registry.owners.add(ownerID);
      return registry.path;
    }

    if ( !await this.#archiveIsValid(archivePath) )
      return '';

    // create unique temporary folder (ex: /tmp/prefix-dpC7Id)
    let tmpDir = '';
    try {
      tmpDir = fs.mkdtempSync( p.join(TMPDIR, TMPPREFIX) );
    } catch(err) {
      console.log(`MXIV: Failed to created tmp folder at ${tmpDir}\n`, err);
      return '';
    }

    const success = await archiveTool.extract(archivePath, tmpDir);
    if (!success) {
      console.log(`MXIV: Failed to extract ${archivePath} to ${tmpDir}`);
      return '';
    }

    this.#openArchives[archivePath] = {
      path: tmpDir,
      owners: new Set([ownerID])
    };

    return tmpDir;
  }

  /**
   * Revoke all archive accesses associated with ownerID. Spare archives if given.
   * Called after successfuly generating a new book for viewing or when closing the app.
   * @param {string} ownerID Tab instance to be cleaned.
   * @param {string[]} [spareArchives] Archive paths to spare.
   */
  surrenderLeases(ownerID, spareArchives = []) {
    for (const archive in this.#openArchives) {
      const spare = spareArchives.includes(archive);
      if (!spare) this.#revokeAccess(archive, ownerID);
    }
  }

  /**
   * Delete temporary folder and its contents.
   * @param {string} folder Temporary folder path to remove.
   */
  #deleteTmpFolder(folder) {
    // folder resides on TMPDIR, right? RIGHT?
    if ( p.dirname(folder) !== TMPDIR ) {
      return console.error('MXIV::FORBIDDEN: Tried to delete non-temporary folder!\n',
        `targeted path: ${folder}`);
    }

    // delete folder recursively
    try {
      fs.rmSync(folder, { recursive: true });
    } catch (err) {
      console.error(`MXIV: Failed to clear tmp folder at ${folder}\n`, err);
    }
  }
};
