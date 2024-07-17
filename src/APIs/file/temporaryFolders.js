const fs = require('fs');
const p = require('path');
const { tmpdir } = require('os');
const { fileType } = require('./fileTools');
const archiveTool = require('../tool/archive');

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
const TemporaryFolders = new class {

  /**
   * Track archives temporarily extracted and their consumers.
   * @type {Object<string, {path:String, owners:Set<string>}>}
   */
  #openArchives = {};

  /**
   * Return either path is from a temporary folder file.
   * @param {String} path Path to file to verify.
   * @returns {Boolean}
   */
  isPathFromTmp(path) {
    const pathIsTmp = path.includes( p.join(TMPDIR, TMPPREFIX) );
    const type = fileType(path);

    return pathIsTmp && type !== 'other' && type !== 'archive';
  }

  /**
   * Revoke access to a leased archive. Delete orphaned lease paths.
   * @param {String} archivePath Archive to revoke access to.
   * @param {String} ownerID Consumer UUID.
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
    })
  }

  /**
   * Lease temporary folder for archive files. Returns folder path or empty if invalid.
   * @param {String} archivePath Absolute path to archive.
   * @param {String} ownerID Owner ID to register folder.
   * @returns {Promise<String>} Path to temporary folder. Empty on failure.
   */
  async leaseArchive(archivePath, ownerID) {

    const registry = this.#openArchives[archivePath];
    if (registry) {
      registry.owners.add(ownerID);
      return registry.path;
    }

    if ( !await this.#archiveIsValid(archivePath) )
      return '';

    // new unique temp folder (ex: /tmp/prefix-dpC7Id)
    const tmpDir = fs.mkdtempSync( p.join(TMPDIR, TMPPREFIX) );
    await archiveTool.extract(archivePath, tmpDir);
    console.log(`MXIV: Created tmp folder at ${tmpDir}`);

    this.#openArchives[archivePath] = {
      path: tmpDir,
      owners: new Set([ownerID])
    };

    return tmpDir;
  }

  /**
   * Revoke all archive accesses associated with ownerID. Spare archives if given.
   * Called after successfuly generating a new book for viewing or when closing the app.
   * @param {String} ownerID Tab instance to be cleaned.
   * @param {String[]} [spareArchives] Archive paths to spare.
   */
  surrenderLeases(ownerID, spareArchives = []) {
    for (const archive in this.#openArchives) {
      const spare = spareArchives.includes(archive);
      if (!spare) this.#revokeAccess(archive, ownerID);
    }
  }

  /**
   * Delete temporary folder and its contents.
   * @param {String} folder Temporary folder path to remove.
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
      console.log(`MXIV: Deleted tmp folder at ${folder}`);
    } catch (err) {
      console.error(`MXIV: Failed to clear tmp folder at ${folder}\n`, err);
    }
  }
};


module.exports = { TemporaryFolders };